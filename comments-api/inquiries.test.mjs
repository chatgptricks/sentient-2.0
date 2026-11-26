import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './worker.mjs';
import {validateInquiry} from './inquiries.mjs';

const draft = () => ({id:crypto.randomUUID(),name:'Test Reviewer',company:'Example Company',email:'reviewer@example.com',description:'A private brief.\nKeep this text literal <b>please</b>.',budget:'$20,000–$50,000',stage:'Early stage',service:'campaign'});
const request = (body,options={}) => new Request(`https://api.example/inquiries${options.query || ''}`,{
  method:options.method || 'POST',
  headers:{...(options.origin === null ? {} : {Origin:options.origin || 'https://chatgptricks.github.io'}),...(options.type === null ? {} : {'Content-Type':options.type || 'application/json'}),...options.headers},
  ...((options.method || 'POST') === 'POST' ? {body:typeof body === 'string' ? body : JSON.stringify(body)} : {}),
});

function storage(context,extra={}) {
  const database = new DatabaseSync(':memory:');
  for (const migration of ['0006_inquiries.sql', '0008_inquiry_pipedrive.sql']) {
    database.exec(readFileSync(new URL(`./migrations/${migration}`, import.meta.url), 'utf8'));
  }
  context.after(() => database.close());
  return {
    database,
    env:{
      ALLOWED_ORIGINS:'https://chatgptricks.github.io',INQUIRY_TO:'contact@sentientagency.io',
      INQUIRY_RATE:{limit:async () => ({success:true})},
      DB:{prepare(sql) {const statement=database.prepare(sql);return {bind(...values) {return {
        async first() {return statement.get(...values) || null;},
        async all() {return {results:statement.all(...values)};},
        async run() {const result=statement.run(...values);return {meta:{changes:Number(result.changes)}};},
      };}};}},
      ...extra,
    },
  };
}

test('inquiries validate the same required brief fields, dates, frequencies and stable UUID',() => {
  const lead = draft();
  assert.equal(validateInquiry({...lead,name:'  Test Reviewer  '}).name,'Test Reviewer');
  assert.equal(validateInquiry({...lead,service:'launch',launchDate:'2028-02-29'}).launchDate,'2028-02-29');
  assert.equal(validateInquiry({...lead,service:'growth',frequency:'Monthly'}).frequency,'Monthly');
  for(const value of [null,[],{}, {...lead,id:'not-a-uuid'},{...lead,name:''},{...lead,company:''},{...lead,description:''},
    {...lead,email:'invalid'},{...lead,budget:'unknown'},{...lead,stage:'unknown'},{...lead,service:'unknown'},
    {...lead,service:'launch',launchDate:'2026-02-31'},{...lead,service:'growth',frequency:''},
    {...lead,name:'Header\r\nInjection'},{...lead,description:'x'.repeat(2001)},
  ]) assert.equal(validateInquiry(value),null);
});

test('inquiry route enforces origin, POST, preflight, rate limit and bounded input before private storage',async context => {
  const {env} = storage(context);
  const lead=draft();
  assert.equal((await worker.fetch(request(lead,{origin:'https://foreign.example'}),env)).status,403);
  assert.equal((await worker.fetch(request(lead,{origin:null}),env)).status,403);
  assert.equal((await worker.fetch(request(undefined,{method:'GET'}),env)).status,405);
  assert.equal((await worker.fetch(request(lead,{query:'?destination=outside@example.com'}),env)).status,400);
  assert.equal((await worker.fetch(request(lead,{type:'text/plain'}),env)).status,415);
  assert.equal((await worker.fetch(request(lead),{...env,INQUIRY_RATE:{limit:async()=>({success:false})}})).status,429);
  assert.equal((await worker.fetch(request(lead),{...env,INQUIRY_RATE:undefined})).status,503);
  assert.equal((await worker.fetch(request({...lead,description:'x'.repeat(17000)}),env)).status,413);
  assert.equal((await worker.fetch(request(lead,{headers:{'Idempotency-Key':crypto.randomUUID()}}),env)).status,400);
  const preflight=await worker.fetch(request(undefined,{method:'OPTIONS'}),env);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://chatgptricks.github.io');
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'),'POST, OPTIONS');
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Idempotency-Key/);
});

test('unconfigured notification still persists privately and reports saved without pretending it sent email',async context => {
  let sends=0;
  const {env,database}=storage(context,{INQUIRY_DELIVERY_PROVIDER:'cloudflare',INQUIRY_EMAIL:{send:async()=>{sends++;return {messageId:'must-not-send-without-enabled-sender'};}}});
  const lead=draft();
  const first=await worker.fetch(request(lead),env);
  assert.equal(first.status,202);
  const body=await first.json();
  assert.deepEqual(body,{id:lead.id,saved:true,notificationStatus:'not_configured',message:'Your request is saved. Email notification is currently unavailable.'});
  assert.doesNotMatch(JSON.stringify(body),/reviewer@example|Example Company|private brief|contact@/);
  const second=await worker.fetch(request(lead),env);
  assert.equal(second.status,202);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM inquiries').get().total,1);
  const row=database.prepare('SELECT * FROM inquiries WHERE id=?').get(lead.id);
  assert.equal(row.delivery_status,'saved');
  assert.equal(sends,0,'A prepared binding without INQUIRY_FROM never attempts notification');
  assert.equal(JSON.parse(row.payload_json).email,lead.email);
  assert.equal((await worker.fetch(request(undefined,{method:'GET'}),env)).status,405);
  assert.equal((await worker.fetch(new Request(`https://api.example/inquiries/${lead.id}`,{headers:{Origin:'https://chatgptricks.github.io'}}),env)).status,404);
});

test('URL-encoded submissions preserve the same UUID validation and private persistence',async context => {
  const {env,database}=storage(context);
  const lead={...draft(),service:'growth',frequency:'Monthly'};
  const response=await worker.fetch(request(new URLSearchParams(lead).toString(),{type:'application/x-www-form-urlencoded'}),env);
  assert.equal(response.status,202);
  assert.match(response.headers.get('Content-Type'),/text\/html/);
  const html=await response.text();
  assert.match(html,/Your request is saved\./);
  assert.ok(html.includes(lead.id));
  assert.match(html,/href="https:\/\/chatgptricks.github.io\/sentient-2.0\/"/);
  assert.doesNotMatch(html,/reviewer@example|private brief/);
  assert.equal(JSON.parse(database.prepare('SELECT payload_json FROM inquiries WHERE id=?').get(lead.id).payload_json).frequency,'Monthly');
});

test('a native form without JavaScript gets a fresh server UUID and readable HTML errors',async context => {
  const {env,database}=storage(context);
  const {id,...lead}=draft();
  for(let count=0;count<2;count++) {
    const response=await worker.fetch(request(new URLSearchParams(lead).toString(),{type:'application/x-www-form-urlencoded'}),env);
    assert.equal(response.status,202);
    assert.match(await response.text(),/Reference: [0-9a-f-]{36}/);
  }
  const rows=database.prepare('SELECT id FROM inquiries').all();
  assert.equal(rows.length,2);
  assert.notEqual(rows[0].id,rows[1].id);
  const bad=await worker.fetch(request(new URLSearchParams({...lead,email:'invalid'}).toString(),{type:'application/x-www-form-urlencoded'}),env);
  assert.equal(bad.status,400);
  assert.match(bad.headers.get('Content-Type'),/text\/html/);
  assert.match(await bad.text(),/Complete all required fields/);
});

test('configured Cloudflare sends a real structured notification only to the fixed server destination and deduplicates retries',async context => {
  const messages=[];
  const {env,database}=storage(context,{
    INQUIRY_FROM:'website@sentientagency.io',INQUIRY_DELIVERY_PROVIDER:'cloudflare',
    INQUIRY_EMAIL:{send:async message=>{messages.push(message);return {messageId:'provider-message-1'};}},
  });
  const lead={...draft(),to:'attacker@example.com',from:'attacker@example.com'};
  const first=await worker.fetch(request(lead),env);
  assert.equal(first.status,201);
  assert.equal((await first.json()).notificationStatus,'accepted');
  assert.equal(messages.length,1);
  assert.equal(messages[0].to,'contact@sentientagency.io');
  assert.equal(messages[0].from,'website@sentientagency.io');
  assert.equal(messages[0].replyTo,lead.email);
  assert.equal(messages[0].headers['X-Inquiry-ID'],lead.id);
  assert.match(messages[0].text,/<b>please<\/b>/);
  assert.equal(messages[0].html,undefined);
  assert.equal(messages[0].headers['Message-ID'],undefined);
  const again=await worker.fetch(request(lead),env);
  assert.equal(again.status,200);
  assert.equal(messages.length,1);
  assert.equal(database.prepare('SELECT delivery_status FROM inquiries WHERE id=?').get(lead.id).delivery_status,'accepted');
  assert.equal((await worker.fetch(request({...lead,description:'Changed brief'}),env)).status,409);
  assert.equal(messages.length,1);
});

test('concurrent copies atomically claim one email attempt and retain its result after browser disconnection',async context => {
  let finish;
  let sends=0;
  const tasks=[];
  const {env}=storage(context,{INQUIRY_FROM:'website@sentientagency.io',INQUIRY_EMAIL:{send:async()=>{sends++;return new Promise(resolve=>{finish=resolve;});}}});
  const lead=draft();
  const first=worker.fetch(request(lead),env,{waitUntil:task=>tasks.push(task)});
  while(!finish) await new Promise(resolve=>setImmediate(resolve));
  const second=await worker.fetch(request(lead),env,{waitUntil:task=>tasks.push(task)});
  assert.equal((await second.json()).notificationStatus,'pending');
  assert.equal(sends,1);
  finish({messageId:'one-accepted-message'});
  assert.equal((await (await first).json()).notificationStatus,'accepted');
  assert.equal(tasks.length,1);
  await Promise.all(tasks);
});

test('a notification that completes after the response deadline repairs its durable uncertain status without a duplicate',async context => {
  const originalTimer=globalThis.setTimeout;
  context.mock.method(globalThis,'setTimeout',(callback,milliseconds,...args)=>originalTimer(callback,milliseconds===10000?1:milliseconds,...args));
  let finish;
  let sends=0;
  const tasks=[];
  const {env,database}=storage(context,{INQUIRY_FROM:'website@sentientagency.io',INQUIRY_EMAIL:{send:async()=>{sends++;return new Promise(resolve=>{finish=resolve;});}}});
  const lead=draft();
  const response=await worker.fetch(request(lead),env,{waitUntil:task=>tasks.push(task)});
  assert.equal((await response.json()).notificationStatus,'uncertain');
  assert.equal(database.prepare('SELECT delivery_status FROM inquiries WHERE id=?').get(lead.id).delivery_status,'uncertain');
  finish({messageId:'accepted-after-response'});
  await Promise.all(tasks);
  assert.equal(database.prepare('SELECT delivery_status FROM inquiries WHERE id=?').get(lead.id).delivery_status,'accepted');
  assert.equal((await (await worker.fetch(request(lead),env)).json()).notificationStatus,'accepted');
  assert.equal(sends,1);
});

test('ambiguous Cloudflare errors never cause blind duplicate notifications and definite rejection can retry safely',async context => {
  let sends=0;
  const {env,database}=storage(context,{INQUIRY_FROM:'website@sentientagency.io',INQUIRY_EMAIL:{send:async()=>{sends++;throw new Error('Potentially sensitive provider failure');}}});
  const lead=draft();
  assert.equal((await (await worker.fetch(request(lead),env)).json()).notificationStatus,'uncertain');
  assert.equal((await (await worker.fetch(request(lead),env)).json()).notificationStatus,'uncertain');
  assert.equal(sends,1);
  assert.equal(database.prepare('SELECT delivery_error_code FROM inquiries WHERE id=?').get(lead.id).delivery_error_code,'PROVIDER_REQUEST_UNCONFIRMED');
  const rejected=draft();
  env.INQUIRY_EMAIL.send=async()=>{sends++;throw Object.assign(new Error('Rejected sender'),{code:'E_SENDER_NOT_VERIFIED'});};
  assert.equal((await (await worker.fetch(request(rejected),env)).json()).notificationStatus,'failed');
  env.INQUIRY_EMAIL.send=async()=>{sends++;return {messageId:'accepted-after-configuration-fix'};};
  assert.equal((await (await worker.fetch(request(rejected),env)).json()).notificationStatus,'accepted');
  assert.equal(sends,3);
});

test('Resend retries use one stable provider idempotency key and refuse ambiguous retries beyond its safety window',async context => {
  const calls=[];
  context.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');
    calls.push(options);
    return calls.length===1 ? Response.json({message:'Internal failure'},{status:503}) : Response.json({id:'resend-accepted-message'});
  });
  const {env}=storage(context,{INQUIRY_FROM:'website@sentientagency.io',INQUIRY_DELIVERY_PROVIDER:'resend',RESEND_API_KEY:'test-provider-key'});
  const lead=draft();
  assert.equal((await (await worker.fetch(request(lead),env)).json()).notificationStatus,'uncertain');
  assert.equal((await (await worker.fetch(request(lead),env)).json()).notificationStatus,'accepted');
  assert.equal(calls.length,2);
  assert.equal(calls[0].headers['Idempotency-Key'],`inquiry/${lead.id}`);
  assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
  assert.equal(JSON.parse(calls[0].body).to[0],'contact@sentientagency.io');
  const other=draft();
  env.RESEND_API_KEY='another-test-key';
  globalThis.fetch=async()=>Response.json({message:'Unknown outcome'},{status:503});
  assert.equal((await (await worker.fetch(request(other),env)).json()).notificationStatus,'uncertain');
  globalThis.fetch=async()=>Response.json({message:'Temporary authorization issue'},{status:401});
  assert.equal((await (await worker.fetch(request(other),env)).json()).notificationStatus,'failed');
  const now=Date.now();
  context.mock.method(Date,'now',()=>now+24*60*60*1000);
  let retried=false;
  globalThis.fetch=async()=>{retried=true;return Response.json({id:'must-not-send'});};
  assert.equal((await (await worker.fetch(request(other),env)).json()).notificationStatus,'failed');
  assert.equal(retried,false);
});

test('a private storage failure never sends an email or reports successful receipt',async context => {
  let sends=0;
  const env={ALLOWED_ORIGINS:'https://chatgptricks.github.io',INQUIRY_TO:'contact@sentientagency.io',INQUIRY_FROM:'website@sentientagency.io',INQUIRY_RATE:{limit:async()=>({success:true})},INQUIRY_EMAIL:{send:async()=>{sends++;return {messageId:'must-not-send'};}},DB:{prepare(){throw new Error('offline');}}};
  const response=await worker.fetch(request(draft()),env);
  assert.equal(response.status,503);
  assert.equal(sends,0);
  assert.match((await response.json()).error,/same request ID/);
});

function mockPipedrive(context, respond) {
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (target, options) => {
    const url = new URL(target);
    assert.equal(url.origin, 'https://sentient.pipedrive.com');
    assert.equal(options.headers['x-api-token'], 'test-crm-token');
    assert.equal(options.redirect, 'error');
    const call = {method:options.method, path:url.pathname, query:url.searchParams, body:options.body && JSON.parse(options.body)};
    calls.push(call);
    const data = await respond(call);
    return data instanceof Response ? data : Response.json({success:true, data});
  });
  return calls;
}

test('website forms keep Gmail delivery and queue one Pipedrive lead with the full brief', async context => {
  const mail = [];
  const {env,database} = storage(context, {
    INQUIRY_FROM:'website@sentientagency.io',
    INQUIRY_EMAIL:{send:async message => {mail.push(message); return {messageId:'gmail-notification'};}},
  });
  const inquiry = {...draft(), service:'growth', frequency:'Monthly'};
  const crmId = crypto.randomUUID();
  const calls = mockPipedrive(context, ({method,path}) => {
    if (path === '/api/v2/persons/search') return {items:[]};
    if (method === 'POST' && path === '/api/v2/persons') return {id:42};
    if (method === 'POST' && path === '/api/v1/leads') return {id:crmId};
    if (method === 'POST' && path === '/api/v1/notes') return {id:84};
    assert.fail(`Unexpected CRM call ${method} ${path}`);
  });

  const receipt = await worker.fetch(request(inquiry), env);
  assert.equal(receipt.status, 201);
  assert.equal((await receipt.json()).notificationStatus, 'accepted');
  assert.equal((await worker.fetch(request(inquiry), env)).status, 200);
  await worker.scheduled({}, env);
  assert.equal(calls.length, 0);
  assert.equal(mail.length, 1);
  assert.equal(mail[0].to, 'contact@sentientagency.io');
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM inquiry_pipedrive').get().total, 1);

  env.PIPEDRIVE_API_TOKEN = 'test-crm-token';
  await Promise.all([worker.scheduled({}, env), worker.scheduled({}, env)]);
  await worker.scheduled({}, env);
  assert.deepEqual(calls.map(call => [call.method, call.path]), [
    ['GET', '/api/v2/persons/search'], ['POST', '/api/v2/persons'], ['POST', '/api/v1/leads'], ['POST', '/api/v1/notes'],
  ]);
  assert.deepEqual(Object.fromEntries(calls[0].query), {term:inquiry.email, fields:'email', exact_match:'true', limit:'1'});
  assert.deepEqual(calls[1].body.emails, [{value:inquiry.email, primary:true, label:'work'}]);
  assert.deepEqual(calls[2].body, {title:'Example Company · Website inquiry', person_id:42, origin_id:inquiry.id});
  assert.equal(calls[3].body.lead_id, crmId);
  assert.equal(calls[3].body.pinned_to_lead_flag, 1);
  assert.ok(calls[3].body.content.includes(inquiry.id));
  assert.match(calls[3].body.content, /Launch frequency: Monthly/);
  assert.match(calls[3].body.content, /literal &lt;b&gt;please&lt;\/b&gt;/);
  const sync = database.prepare('SELECT * FROM inquiry_pipedrive WHERE inquiry_id=?').get(inquiry.id);
  assert.ok(sync.synced_at);
  assert.equal(sync.attempt_count, 1);
  assert.equal(sync.pending_write, null);
});

test('Pipedrive reconciles an interrupted lead write and retries a rejected note without duplicating records', async context => {
  const {env,database} = storage(context, {PIPEDRIVE_API_TOKEN:'test-crm-token'});
  const inquiry = {...draft(), service:'launch', launchDate:'2028-02-29'};
  const crmId = crypto.randomUUID();
  let leadVisible = false;
  let noteAttempts = 0;
  const calls = mockPipedrive(context, ({method,path,query,body}) => {
    if (path === '/api/v2/persons/search') return {items:[{item:{id:42}}]};
    if (method === 'POST' && path === '/api/v1/leads') throw new Error('Simulated interruption');
    if (method === 'GET' && path === '/api/v1/leads') {
      assert.equal(query.get('person_id'), '42');
      return leadVisible ? [{id:crmId, origin_id:inquiry.id}] : [];
    }
    if (method === 'POST' && path === '/api/v1/notes') {
      assert.equal(body.lead_id, crmId);
      assert.match(body.content, /Planned launch: 2028-02-29/);
      return ++noteAttempts === 1 ? new Response(null, {status:429}) : {id:84};
    }
    assert.fail(`Unexpected CRM call ${method} ${path}`);
  });
  const read = () => database.prepare('SELECT * FROM inquiry_pipedrive WHERE inquiry_id=?').get(inquiry.id);
  const retry = async () => {
    database.prepare('UPDATE inquiry_pipedrive SET next_attempt_at=? WHERE inquiry_id=?')
      .run('2000-01-01T00:00:00.000Z', inquiry.id);
    await worker.scheduled({}, env);
  };

  assert.equal((await worker.fetch(request(inquiry), env)).status, 202);
  await worker.scheduled({}, env);
  assert.equal(read().pending_write, 'lead');
  assert.equal(read().last_error, 'REQUEST_UNCONFIRMED');
  await worker.scheduled({}, env);
  assert.equal(calls.length, 2, 'The scheduled retry waits for the persisted backoff');
  await retry();
  assert.equal(read().last_error, 'LEAD_UNCONFIRMED');
  leadVisible = true;
  await retry();
  assert.equal(read().lead_id, crmId);
  assert.equal(read().last_error, 'HTTP_429');
  assert.equal(read().pending_write, null);
  await retry();
  assert.ok(read().synced_at);
  assert.equal(read().last_error, null);
  assert.equal(calls.filter(call => call.method === 'POST' && call.path === '/api/v1/leads').length, 1);
  assert.equal(noteAttempts, 2);
});
