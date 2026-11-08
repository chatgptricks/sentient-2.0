import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const request = (path = '/network/accounts', options = {}) => new Request(`https://api.example${path}`, {
  method:options.method ?? 'GET',
  headers:options.origin === null ? {} : { Origin:options.origin ?? 'https://chatgptricks.github.io' },
});
const environment = () => ({
  ALLOWED_ORIGINS:'https://chatgptricks.github.io',
  SENTIENTDASH_API_KEY:`test-only-${crypto.randomUUID()}`,
  SENTIENTDASH_API_URL:'https://cortex.example',
});

test('public network route keeps the key server-side and forwards only fixed Cortex paths', async context => {
  const env = environment();
  const calls = [];
  context.mock.method(globalThis,'fetch',async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://cortex.example');
    assert.equal(options.headers.Authorization, `Bearer ${env.SENTIENTDASH_API_KEY}`);
    calls.push(url.pathname + url.search);
    if (url.pathname === '/api/v1/tracker/accounts') return Response.json({detail:'Tracker scope not granted'},{status:403});
    if (url.pathname === '/api/v1/accounts') return Response.json({ data:[{handle:'chatgptricks',public_name:'AI / ChatGPT'}] });
    if (url.pathname === '/api/v1/settings/accounts') return Response.json({ data:[{handle:'chatgptricks',group_name:'sentient',is_active:true}], pagination:{has_more:false,next_offset:null} });
    if (url.pathname === '/api/v1/accounts/chatgptricks') return Response.json({data:{handle:'chatgptricks',public_name:'AI / ChatGPT',followers:123},data_updated_at:{profile:'2026-05-02T10:30:00Z'}});
    throw new Error('Unexpected path');
  });
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://chatgptricks.github.io');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.text();
  assert.doesNotMatch(body, /test-only|Authorization|cortex\.example|group_name/);
  assert.equal(JSON.parse(body).accounts[0].followerCount, 123);
  assert.deepEqual(calls, ['/api/v1/tracker/accounts?limit=100&offset=0','/api/v1/accounts','/api/v1/settings/accounts?limit=100&offset=0','/api/v1/accounts/chatgptricks']);
});

test('network route enforces CORS, read-only methods and no caller-controlled source query', async context => {
  let calls = 0;
  context.mock.method(globalThis,'fetch',async () => { calls++; throw new Error('No source call expected'); });
  const env = environment();
  assert.equal((await worker.fetch(request('/network/accounts',{origin:'https://foreign.example'}),env)).status,403);
  assert.equal((await worker.fetch(request('/network/accounts?handle=competitor'),env)).status,400);
  assert.equal((await worker.fetch(request('/network/accounts?url=https://foreign.example'),env)).status,400);
  assert.equal((await worker.fetch(request('/network/accounts',{method:'POST'}),env)).status,405);
  const preflight = await worker.fetch(request('/network/accounts',{method:'OPTIONS'}),env);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'),'GET, OPTIONS');
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://chatgptricks.github.io');
  assert.equal((await worker.fetch(request('/network/accounts'),{...env,SENTIENTDASH_API_KEY:undefined})).status,401);
  assert.equal((await worker.fetch(request('/network/accounts',{origin:null}),env)).status,503, 'Public reads need no browser authentication and fail only because the source is unavailable');
  assert.equal(calls,1);
});

test('network failure diagnostics expose stage and HTTP status without credentials or upstream text', async context => {
  const logs = [];
  context.mock.method(console,'warn',(...values) => logs.push(values));
  const env = environment();
  context.mock.method(globalThis,'fetch',async () => Response.json({detail:`Sensitive upstream text ${env.SENTIENTDASH_API_KEY}`},{status:401}));
  const response = await worker.fetch(request(),env);
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{
    error:'Network profiles are temporarily unavailable.',code:'NETWORK_PROFILES_UNAVAILABLE',
    networkStage:'source-status',sourceStatus:401,sourcePath:'/api/v1/tracker/accounts',
  });
  const text = JSON.stringify(logs);
  assert.match(text,/source-status/);
  assert.match(text,/401/);
  assert.match(text,/\/api\/v1\/tracker\/accounts/);
  assert.ok(!text.includes(env.SENTIENTDASH_API_KEY));
  assert.doesNotMatch(text,/Sensitive upstream text|Authorization/);
});
