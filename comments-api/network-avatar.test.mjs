import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import { handleNetworkAccountAvatar } from './network-avatar.mjs';

const environment = () => ({ALLOWED_ORIGINS:'https://chatgptricks.github.io',SENTIENTDASH_API_KEY:`test-only-${crypto.randomUUID()}`,SENTIENTDASH_API_URL:'https://cortex.example'});
const json = (status,body) => Response.json(body,{status});
const request = (handle = 'chatgptricks', suffix = '', method = 'GET') => new Request(`https://api.example/network/accounts/${handle}/avatar${suffix}`,{method,headers:{Origin:'https://chatgptricks.github.io'}});
const tracker = () => Response.json({data:[
  {handle:'chatgptricks',group:'sentient',full_name:'AI / ChatGPT',followers:123,captured_at:'2026-05-02T00:00:00Z',private:false},
  {handle:'competitor',group:'others',full_name:'Competitor',followers:999,captured_at:'2026-05-02T00:00:00Z',private:false},
],pagination:{has_more:false,next_offset:null}});
function source(media) {
  const calls = [];
  const read = async (path,options) => {
    calls.push(path);
    if (path.startsWith('/api/v1/tracker/accounts?')) return tracker();
    assert.equal(path,'/api/dashboard/avatar/chatgptricks');
    assert.equal(options.redirect,'manual');
    assert.ok(options.signal instanceof AbortSignal);
    return media();
  };
  return {read,calls};
}

test('avatar proxy requires owned membership before looking up a cached image and accepts no caller query', async context => {
  const original = globalThis.caches;
  context.after(() => { if (original === undefined) delete globalThis.caches; else globalThis.caches = original; });
  let imageMatches = 0;
  globalThis.caches = {default:{async match(key) { if(key.includes('/avatars/')) imageMatches++; },async put() {}}};
  const env = environment();
  const upstream = source(() => { throw new Error('Must not read an unapproved image'); });
  assert.equal((await handleNetworkAccountAvatar(request('competitor'),env,json,upstream.read,null,'competitor')).status,404);
  assert.equal((await handleNetworkAccountAvatar(request('outside'),env,json,upstream.read,null,'outside')).status,404);
  assert.equal((await handleNetworkAccountAvatar(request('chatgptricks','?url=https://outside.example'),env,json,upstream.read,null,'chatgptricks')).status,404);
  assert.equal((await handleNetworkAccountAvatar(request('chatgptricks','','POST'),env,json,upstream.read,null,'chatgptricks')).status,405);
  assert.equal(imageMatches,0);
  assert.equal(upstream.calls.length,1,'Membership consumers share the scoped bulk profile snapshot');
});

test('avatar reads use only the fixed Cortex path and strip the website credential on signed storage redirects', async context => {
  const env = environment();
  const calls = [];
  context.mock.method(globalThis,'fetch',async (input,options) => {
    const url = new URL(input);
    calls.push(url.origin + url.pathname);
    if (url.origin === 'https://cortex.example') {
      if (url.pathname === '/api/v1/tracker/accounts') {
        assert.equal(options.headers.Authorization,`Bearer ${env.SENTIENTDASH_API_KEY}`);
        return tracker();
      }
      assert.equal(url.pathname,'/api/dashboard/avatar/chatgptricks');
      assert.equal(options.headers.Authorization,undefined,'The existing public image reader rejects website credentials on non-versioned paths');
      assert.equal(options.redirect,'manual');
      return new Response(null,{status:307,headers:{Location:'https://public-bucket.r2.cloudflarestorage.com/avatar.webp?X-Amz-Signature=test'}});
    }
    assert.equal(url.origin,'https://public-bucket.r2.cloudflarestorage.com');
    assert.equal(options.headers,undefined);
    assert.equal(options.redirect,'manual');
    return new Response('WEBP',{headers:{'Content-Type':'image/webp'}});
  });
  const response = await worker.fetch(request(),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Content-Type'),'image/webp');
  assert.equal(response.headers.get('Cache-Control'),'public, max-age=300');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
  assert.equal(await response.text(),'WEBP');
  assert.deepEqual(calls,['https://cortex.example/api/v1/tracker/accounts','https://cortex.example/api/dashboard/avatar/chatgptricks','https://public-bucket.r2.cloudflarestorage.com/avatar.webp']);
});

test('avatar proxy refuses redirect pivots, HTML and oversized images', async context => {
  let outsideReads = 0;
  context.mock.method(globalThis,'fetch',async () => { outsideReads++; throw new Error('No unapproved destination fetch'); });
  for (const media of [
    () => new Response(null,{status:307,headers:{Location:'https://outside.example/avatar.jpg'}}),
    () => new Response('HTML',{headers:{'Content-Type':'text/html'}}),
    () => new Response('x',{headers:{'Content-Type':'image/jpeg','Content-Length':String(2*1024*1024+1)}}),
    () => new Response(new Uint8Array(2*1024*1024+1),{headers:{'Content-Type':'image/jpeg'}}),
  ]) {
    const upstream = source(media);
    assert.ok([502,503].includes((await handleNetworkAccountAvatar(request(),environment(),json,upstream.read,null,'chatgptricks')).status));
  }
  assert.equal(outsideReads,0);
});

test('avatar cache is refreshed after five minutes and cannot outlive renewed ownership authorization', async context => {
  const original = globalThis.caches;
  context.after(() => { if (original === undefined) delete globalThis.caches; else globalThis.caches = original; });
  const images = new Map();
  globalThis.caches = {default:{
    async match(key) { return images.get(key)?.clone(); },
    async put(key,response) { if(key.includes('/avatars/')) images.set(key,response); },
  }};
  const env = environment();
  let reads = 0;
  const upstream = source(() => new Response(`JPEG ${++reads}`,{headers:{'Content-Type':'image/jpeg'}}));
  assert.equal(await (await handleNetworkAccountAvatar(request(),env,json,upstream.read,null,'chatgptricks')).text(),'JPEG 1');
  assert.equal(await (await handleNetworkAccountAvatar(request(),env,json,upstream.read,null,'chatgptricks')).text(),'JPEG 1');
  assert.equal(reads,1);
  for(const [key,response] of images) {
    const headers = new Headers(response.headers);
    headers.set('X-Network-Image-Fetched-At',new Date(Date.now()-301000).toISOString());
    images.set(key,new Response(await response.arrayBuffer(),{headers}));
  }
  assert.equal(await (await handleNetworkAccountAvatar(request(),env,json,upstream.read,null,'chatgptricks')).text(),'JPEG 2');
  const now = Date.now();
  context.mock.method(Date,'now',() => now+301000);
  const revoked = async () => Response.json({detail:'Revoked'},{status:401});
  assert.equal((await handleNetworkAccountAvatar(request(),env,json,revoked,null,'chatgptricks')).status,503);
  assert.equal(reads,2,'Cached image bytes are not returned after membership authorization expires');
});
