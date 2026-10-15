import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, {parseInstagramPost, validateComment, validateDeckEdit} from './worker.mjs';
const note = {id:crypto.randomUUID(),page:'home',author:'Reviewer',message:'Change this headline.',anchor:{selector:'main > section:nth-of-type(1)',quote:'Headline',x:.5,y:.5,pageY:.1}};
test('validates untrusted notes and anchors',()=>{
  assert.equal(validateComment(note).author,'Reviewer');
  for (const input of [null,[],{...note,page:'unknown'},{...note,author:' '},{...note,message:'x'.repeat(2001)},{...note,id:'bad'},{...note,anchor:{...note.anchor,x:NaN}},{...note,anchor:{...note.anchor,y:2}},{...note,anchor:{...note.anchor,selector:'x'.repeat(1001)}}]) assert.equal(validateComment(input),null);
});
const env={ALLOWED_ORIGINS:'https://chatgptricks.github.io'};
const req=(method,body,origin='https://chatgptricks.github.io')=>new Request('https://api.example/comments?page=home',{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('blocks foreign origins before accessing storage',async()=>assert.equal((await worker.fetch(req('POST',note,'https://evil.example'),env)).status,403));
test('handles CORS preflight',async()=>{const r=await worker.fetch(req('OPTIONS'),env);assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://chatgptricks.github.io');});
test('rate limits and rejects oversized requests',async()=>{
  assert.equal((await worker.fetch(req('POST',note),{...env,COMMENT_RATE:{limit:async()=>({success:false})}})).status,429);
  assert.equal((await worker.fetch(req('POST',{...note,message:'x'.repeat(17000)}),env)).status,413);
});
test('does not report success on a failed save',async()=>{const r=await worker.fetch(req('POST',note),{...env,DB:{prepare(){throw new Error('offline');}}});assert.equal(r.status,503);});

const editorPassword = 'test-editor-password';
const editorHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(editorPassword)))].map(value=>value.toString(16).padStart(2,'0')).join('');
const deckRequest = (method, body, options={}) => new Request(`https://api.example/decks/${options.slug ?? 'campaign-deck'}`, {
  method,
  headers: {
    ...(options.origin === null ? {} : {Origin:options.origin ?? 'https://chatgptricks.github.io'}),
    ...(options.contentType === null ? {} : {'Content-Type':options.contentType ?? 'application/json'}),
    ...(options.password === null ? {} : {Authorization:`Bearer ${options.password ?? editorPassword}`}),
  },
  ...(body === undefined ? {} : {body:typeof body === 'string' ? body : JSON.stringify(body)}),
});
const deckEnvironment = context => {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('./migrations/0002_deck_edits.sql',import.meta.url),'utf8'));
  context.after(()=>database.close());
  return {...env,DECK_EDITOR_PASSWORD_SHA256:editorHash,DB:{prepare(sql){
    const statement=database.prepare(sql);
    return {bind(...values){return {
      async first(){return statement.get(...values) ?? null;},
      async run(){const result=statement.run(...values);return {meta:{changes:Number(result.changes)}};},
    };}};
  }}};
};

test('validates bounded deck text maps and revisions',()=>{
  const valid=validateDeckEdit({fields:{'cover:title':'Changed headline','slide.8/cpm':'','note:0':'A note'},revision:0});
  assert.equal(valid.fields['cover:title'],'Changed headline');
  assert.equal(valid.fields['slide.8/cpm'],'');
  for (const input of [null,[],{}, {fields:{},revision:-1}, {fields:{},revision:1.5}, {fields:{},revision:Number.MAX_SAFE_INTEGER},
    {fields:[],revision:0}, {fields:{title:100},revision:0}, {fields:{title:'x'.repeat(1001)},revision:0},
    {fields:{'bad key':'text'},revision:0}, {fields:{constructor:'text'},revision:0},
    {fields:Object.fromEntries(Array.from({length:1001},(_,i)=>[`field-${i}`,'text'])),revision:0},
    {fields:Object.fromEntries(Array.from({length:200},(_,i)=>[`field-${i}`,'x'.repeat(1000)])),revision:0},
  ]) assert.equal(validateDeckEdit(input),null);
});

test('deck reads are public and saved text persists independently of the client',async context=>{
  const storage=deckEnvironment(context);
  let response=await worker.fetch(deckRequest('GET',undefined,{origin:null,password:null}),storage);
  assert.deepEqual(await response.json(),{deck:'campaign-deck',fields:{},revision:0,updatedAt:null});
  response=await worker.fetch(deckRequest('PUT',{fields:{'cover:title':'<b>Literal text</b>','slide-8:cpm':'$X'},revision:0}),storage);
  assert.equal(response.status,200);
  const saved=await response.json();
  assert.equal(saved.revision,1);
  assert.ok(saved.updatedAt);
  const shared=await worker.fetch(deckRequest('GET',undefined,{password:null}),storage);
  assert.deepEqual(await shared.json(),saved);
  const next=await worker.fetch(deckRequest('PUT',{fields:{'cover:title':'A second edit'},revision:1}),storage);
  assert.equal((await next.json()).revision,2);
});

test('concurrent deck saves reject stale revisions without overwriting the winner',async context=>{
  const storage=deckEnvironment(context);
  const results=await Promise.all([
    worker.fetch(deckRequest('PUT',{fields:{title:'First'},revision:0}),storage),
    worker.fetch(deckRequest('PUT',{fields:{title:'Second'},revision:0}),storage),
  ]);
  assert.deepEqual(results.map(response=>response.status).sort(),[200,409]);
  const winner=await results.find(response=>response.status===200).json();
  const conflict=await results.find(response=>response.status===409).json();
  assert.equal(conflict.revision,winner.revision);
  assert.deepEqual(conflict.fields,winner.fields);
  const update=await worker.fetch(deckRequest('PUT',{fields:{title:'Updated'},revision:1}),storage);
  assert.equal(update.status,200);
  const stale=await worker.fetch(deckRequest('PUT',{fields:{title:'Stale'},revision:1}),storage);
  assert.equal(stale.status,409);
  assert.deepEqual((await stale.json()).fields,{title:'Updated'});
});

test('deck writes require the configured server password and permitted origin',async context=>{
  const storage=deckEnvironment(context), edit={fields:{title:'Private write'},revision:0};
  assert.equal((await worker.fetch(deckRequest('PUT',edit,{password:null}),storage)).status,401);
  assert.equal((await worker.fetch(deckRequest('PUT',edit,{password:'incorrect'}),storage)).status,401);
  assert.equal((await worker.fetch(deckRequest('PUT',edit,{origin:'https://evil.example'}),storage)).status,403);
  assert.equal((await worker.fetch(deckRequest('PUT',edit,{origin:null}),storage)).status,403);
  assert.equal((await worker.fetch(deckRequest('PUT',edit),{...storage,DECK_EDITOR_PASSWORD_SHA256:undefined})).status,503);
  assert.equal((await worker.fetch(deckRequest('PUT',edit),{...storage,DECK_EDIT_RATE:{limit:async()=>({success:false})}})).status,429);
  assert.equal((await worker.fetch(deckRequest('GET'),storage)).status,200);
  assert.equal((await worker.fetch(deckRequest('GET',undefined,{slug:'another-deck'}),storage)).status,404);
});

test('deck editor authentication validates the password without storing or changing text',async context=>{
  const storage=deckEnvironment(context);
  const auth=(password,options={})=>new Request('https://api.example/decks/campaign-deck/auth',{method:'POST',headers:{Origin:options.origin ?? 'https://chatgptricks.github.io','Content-Type':'application/json'},body:JSON.stringify({password})});
  const accepted=await worker.fetch(auth(editorPassword),storage);
  assert.equal(accepted.status,200);
  assert.deepEqual(await accepted.json(),{ok:true});
  assert.equal((await worker.fetch(auth('incorrect'),storage)).status,401);
  assert.equal((await worker.fetch(auth(''),storage)).status,401);
  assert.equal((await worker.fetch(auth(editorPassword,{origin:'https://evil.example'}),storage)).status,403);
  assert.equal((await worker.fetch(auth(editorPassword),{...storage,DECK_EDIT_RATE:{limit:async()=>({success:false})}})).status,429);
  const state=await worker.fetch(deckRequest('GET'),storage);
  assert.deepEqual((await state.json()).fields,{});
  assert.equal((await worker.fetch(new Request('https://api.example/decks/campaign-deck/auth',{method:'OPTIONS',headers:{Origin:'https://chatgptricks.github.io'}}),storage)).headers.get('Access-Control-Allow-Methods'),'POST, OPTIONS');
});

test('deck requests enforce CORS, method, JSON and streamed body limits',async context=>{
  const storage=deckEnvironment(context);
  const preflight=await worker.fetch(deckRequest('OPTIONS'),storage);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'),'GET, PUT, OPTIONS');
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Authorization/);
  assert.equal((await worker.fetch(deckRequest('POST',{fields:{},revision:0}),storage)).status,405);
  assert.equal((await worker.fetch(deckRequest('PUT',{fields:{},revision:0},{contentType:'text/plain'}),storage)).status,415);
  assert.equal((await worker.fetch(deckRequest('PUT','{invalid'),storage)).status,400);
  assert.equal((await worker.fetch(deckRequest('PUT',{fields:{title:'x'.repeat(1001)},revision:0}),storage)).status,400);
  assert.equal((await worker.fetch(deckRequest('PUT',{fields:{title:'x'.repeat(128*1024)},revision:0}),storage)).status,413);
});

test('deck save failures never report success',async()=>{
  const response=await worker.fetch(deckRequest('PUT',{fields:{title:'Change'},revision:0}),{...env,DECK_EDITOR_PASSWORD_SHA256:editorHash,DB:{prepare(){throw new Error('offline');}}});
  assert.equal(response.status,503);
});

// A fake SentientDash website API: two readable accounts, one known post.
const dashKey='sad_api_test';
const dashPost={shortcode:'DalMfBeINkQ',caption:'1X just unveiled the NEO hand\n#aitoolsentient',is_promo:true,published_at:'2026-07-09T11:51:56-06:00',permalink:'https://www.instagram.com/p/DalMfBeINkQ/',format:'reel',likes:10387,comments:254,metrics_updated_at:'2026-10-07T15:10:26+00:00'};
const withDash=(context,overrides={})=>{
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(input);
    calls.push(url.pathname);
    assert.equal(init.headers.Authorization,`Bearer ${dashKey}`);
    if (overrides[url.pathname]) return overrides[url.pathname]();
    if (url.pathname==='/api/v1/accounts') return Response.json({data:[{handle:'artificialntellligence'},{handle:'chatgptricks'}]});
    if (url.pathname==='/api/v1/accounts/chatgptricks') return Response.json({schema_version:'1.0',data:{handle:'chatgptricks',followers:2751234},data_updated_at:{profile:'2026-10-14T16:05:22+00:00',engagement:null}});
    if (url.pathname==='/api/v1/accounts/chatgptricks/posts/DalMfBeINkQ') return Response.json({data:dashPost});
    if (url.pathname==='/api/v1/accounts/chatgptricks/posts/DalMfBeINkQ/cover') return new Response('JPEG',{headers:{'Content-Type':'image/jpeg'}});
    return Response.json({detail:'Not found'},{status:404});
  };
  context.after(()=>{globalThis.fetch=original;});
  return calls;
};
const postRequest=(body,options={})=>new Request('https://api.example/decks/campaign-deck/instagram-post',{method:'POST',headers:{Origin:'https://chatgptricks.github.io','Content-Type':'application/json',...(options.password===null?{}:{Authorization:`Bearer ${options.password ?? editorPassword}`})},body:JSON.stringify(body)});

test('parses Instagram post, reel and account-prefixed links only',()=>{
  assert.deepEqual(parseInstagramPost('https://www.instagram.com/p/DalMfBeINkQ/?igsh=x'),{account:null,shortcode:'DalMfBeINkQ'});
  assert.deepEqual(parseInstagramPost('https://instagram.com/ChatGPTricks/reel/DZV5fOZnQJU'),{account:'chatgptricks',shortcode:'DZV5fOZnQJU'});
  for (const value of ['http://www.instagram.com/p/x/','https://evil.example/p/x/','https://www.instagram.com/chatgptricks/','not a url',null]) assert.equal(parseInstagramPost(value),null);
});

test('post lookup finds real SentientDash data from a pasted link',async context=>{
  const storage={...deckEnvironment(context),SENTIENTDASH_API_KEY:dashKey,SENTIENTDASH_API_URL:'https://dash.example'};
  const calls=withDash(context);
  const response=await worker.fetch(postRequest({url:'https://www.instagram.com/p/DalMfBeINkQ/'}),storage);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{account:'chatgptricks',shortcode:'DalMfBeINkQ',permalink:'https://www.instagram.com/p/DalMfBeINkQ/',publishedAt:'2026-07-09T11:51:56-06:00',likes:10387,comments:254,caption:dashPost.caption,isPromo:true,metricsUpdatedAt:'2026-10-07T15:10:26+00:00',cover:'/decks/campaign-deck/covers/chatgptricks/DalMfBeINkQ'});
  assert.deepEqual(calls,['/api/v1/accounts','/api/v1/accounts/artificialntellligence/posts/DalMfBeINkQ','/api/v1/accounts/chatgptricks/posts/DalMfBeINkQ']);
  calls.length=0;
  await worker.fetch(postRequest({url:'https://www.instagram.com/chatgptricks/p/DalMfBeINkQ/'}),storage);
  assert.deepEqual(calls,['/api/v1/accounts/chatgptricks/posts/DalMfBeINkQ']);
});

test('post lookup requires the editor, a valid link and a configured key',async context=>{
  const storage={...deckEnvironment(context),SENTIENTDASH_API_KEY:dashKey};
  withDash(context,{'/api/v1/accounts/chatgptricks/posts/Busy':()=>new Response('{}',{status:429})});
  assert.equal((await worker.fetch(postRequest({url:'https://www.instagram.com/p/DalMfBeINkQ/'},{password:null}),storage)).status,401);
  assert.equal((await worker.fetch(postRequest({url:'https://example.com/p/x/'}),storage)).status,400);
  assert.equal((await worker.fetch(postRequest({url:'https://www.instagram.com/p/Unknown/'}),storage)).status,404);
  assert.equal((await worker.fetch(postRequest({url:'https://www.instagram.com/chatgptricks/p/Busy/'}),storage)).status,429);
  assert.equal((await worker.fetch(postRequest({url:'https://www.instagram.com/p/DalMfBeINkQ/'}),{...storage,SENTIENTDASH_API_KEY:undefined})).status,503);
});

test('covers are served only for posts the saved deck shows',async context=>{
  const storage={...deckEnvironment(context),SENTIENTDASH_API_KEY:dashKey};
  withDash(context);
  const cover=path=>worker.fetch(new Request(`https://api.example/decks/campaign-deck/covers/${path}`),storage);
  assert.equal((await cover('chatgptricks/DalMfBeINkQ')).status,404);
  await worker.fetch(deckRequest('PUT',{fields:{'sentient-promo-results.post-0-source':'chatgptricks/DalMfBeINkQ'},revision:0}),storage);
  const response=await cover('chatgptricks/DalMfBeINkQ');
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Content-Type'),'image/jpeg');
  assert.equal(await response.text(),'JPEG');
  assert.equal((await cover('chatgptricks/Other')).status,404);
  assert.equal((await cover('../secrets/x')).status,404);
});

test('account lookup returns exact SentientDash followers for the editor',async context=>{
  const storage={...deckEnvironment(context),SENTIENTDASH_API_KEY:dashKey};
  withDash(context);
  const lookup=(body,options={})=>new Request('https://api.example/decks/campaign-deck/account',{method:'POST',headers:{Origin:'https://chatgptricks.github.io','Content-Type':'application/json',...(options.password===null?{}:{Authorization:`Bearer ${editorPassword}`})},body:JSON.stringify(body)});
  const response=await worker.fetch(lookup({handle:'@ChatGPTricks'}),storage);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{handle:'chatgptricks',followers:2751234,capturedAt:'2026-10-14T16:05:22+00:00'});
  assert.equal((await worker.fetch(lookup({handle:'chatgptricks'},{password:null}),storage)).status,401);
  assert.equal((await worker.fetch(lookup({handle:'bad handle!'}),storage)).status,400);
  assert.equal((await worker.fetch(lookup({handle:'unknown'}),storage)).status,404);
  assert.equal((await worker.fetch(lookup({handle:'chatgptricks'}),{...storage,SENTIENTDASH_API_KEY:undefined})).status,503);
});
