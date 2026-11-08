import test from 'node:test';
import assert from 'node:assert/strict';
import { getOwnedAccounts, getOwnedAccountHandles, getPublicOwnedAccountHandles } from './network-accounts.mjs';

const environment = () => ({ SENTIENTDASH_API_KEY:`test-only-${crypto.randomUUID()}`, SENTIENTDASH_API_URL:'https://cortex.example' });
const observedAt = '2026-05-02T10:30:00+00:00';
const page = data => ({ data, pagination:{ has_more:false, next_offset:null } });
const profile = (handle, followers = 12345) => ({ data:{ handle, public_name:`Public ${handle}`, followers, private_internal_value:'do not publish' }, data_updated_at:{ profile:observedAt }, generated_at:'2026-11-08T06:00:00+00:00' });

function source(rows, settings, overrides = {}) {
  const calls = [];
  const read = async (path, options) => {
    calls.push(path);
    assert.ok(options.signal instanceof AbortSignal, 'All upstream reads have a deadline');
    if (overrides[path]) return overrides[path](options);
    if (path.startsWith('/api/v1/tracker/accounts?')) return Response.json({ detail:'Tracker scope not granted' }, { status:403 });
    if (path === '/api/v1/accounts') return Response.json({ data:rows });
    if (path.startsWith('/api/v1/settings/accounts?')) return typeof settings === 'number' ? Response.json({ detail:'Not available' }, { status:settings }) : Response.json(settings);
    const handle = path.split('/').at(-1);
    return Response.json(profile(handle));
  };
  return { read, calls };
}

test('bulk Tracker projects only owned public profiles, follows pagination, and shares one source snapshot', async () => {
  const upstream = source([], page([]), {
    '/api/v1/tracker/accounts?limit=100&offset=0': () => Response.json({
      data:[
        {handle:'chatgptricks',group:'sentient',private:false,full_name:'AI / ChatGPT',followers:3000000,captured_at:observedAt,label:'INTERNAL LABEL',avg_likes_30d:999},
        {handle:'competitor',group:'others',full_name:'Competitor',followers:9999999,captured_at:observedAt},
        {handle:'mindset.therapy',group:'partners',full_name:'Partner',followers:9999999,captured_at:observedAt},
      ], pagination:{has_more:true,next_offset:100}, generated_at:'2026-11-08T06:00:00Z',
    }),
    '/api/v1/tracker/accounts?limit=100&offset=100': () => Response.json(page([
      {handle:'new_owned_page',group:'sentient',private:true,full_name:'New owned page',followers:50,captured_at:null},
      {handle:'no_count',group:'sentient',private:null,full_name:null,followers:null,captured_at:observedAt},
    ])),
  });
  const env = environment();
  const result = await getOwnedAccounts(env, upstream.read);
  assert.deepEqual(result.accounts.map(account => account.handle),['chatgptricks','new_owned_page','no_count']);
  assert.equal(result.accounts[0].followerCount,3000000);
  assert.equal(result.accounts[0].followersAsOf,observedAt);
  assert.equal(result.accounts[0].name,'AI / ChatGPT');
  assert.equal(result.accounts[1].followerCount,null);
  assert.equal(result.accounts[1].followersAsOf,null);
  assert.equal(result.accounts[2].followerCount,null);
  assert.deepEqual(await getOwnedAccountHandles(env,upstream.read),['chatgptricks','new_owned_page','no_count']);
  assert.deepEqual(await getPublicOwnedAccountHandles(env,upstream.read),['chatgptricks']);
  assert.equal(upstream.calls.length,2,'Neither profile fan-out nor a separate ownership read is needed');
  assert.doesNotMatch(JSON.stringify(result),/competitor|mindset|INTERNAL|avg_likes|generated_at|group|publicHandles|private/);
});

test('Tracker failures other than a missing scope fail without opening another source area', async () => {
  for (const status of [401,429,500]) {
    const upstream = source([],page([]), { '/api/v1/tracker/accounts?limit=100&offset=0': () => Response.json({detail:'Unavailable'},{status}) });
    await assert.rejects(getOwnedAccounts(environment(),upstream.read));
    assert.equal(upstream.calls.length,1);
  }
  const malformed = source([],page([]), { '/api/v1/tracker/accounts?limit=100&offset=0': () => Response.json({data:[]}) });
  await assert.rejects(getOwnedAccounts(environment(),malformed.read));
});

test('reusing the bulk ownership snapshot does not extend its five-minute retrieval age', async context => {
  const env = environment();
  const start = Date.now();
  const upstream = source([],page([]), {
    '/api/v1/tracker/accounts?limit=100&offset=0': () => Response.json(page([{handle:'chatgptricks',group:'sentient',full_name:'AI / ChatGPT',followers:123,captured_at:observedAt}])),
  });
  await getOwnedAccountHandles(env,upstream.read);
  let now = start + 299000;
  context.mock.method(Date,'now',() => now);
  const result = await getOwnedAccounts(env,upstream.read);
  assert.ok(Date.parse(result.fetchedAt) < now - 298000);
  assert.equal(upstream.calls.length,1);
  now = start + 301000;
  await assert.rejects(getOwnedAccounts(env,async () => { throw new Error('Source offline'); }));
});

test('network uses scoped dynamic Sentient ownership and publishes only public profile fields', async () => {
  const upstream = source([
    { handle:'chatgptricks', public_name:'Public account' },
    { handle:'new_sentient_page', public_name:'New page' },
    { handle:'competitor', public_name:'Competitor' },
    { handle:'mindset.therapy', public_name:'Partner' },
    { handle:'inactive', public_name:'Inactive' },
  ], page([
    { handle:'chatgptricks', group_name:'sentient', is_active:true, label:'INTERNAL LABEL' },
    { handle:'new_sentient_page', group_name:'sentient', is_active:true },
    { handle:'competitor', group_name:'others', is_active:true },
    { handle:'mindset.therapy', group_name:'partners', is_active:true },
    { handle:'inactive', group_name:'sentient', is_active:false },
    { handle:'out_of_scope', group_name:'sentient', is_active:true },
  ]));
  const env = environment();
  const result = await getOwnedAccounts(env, upstream.read);
  assert.deepEqual(result.accounts.map(account => account.handle), ['chatgptricks','new_sentient_page']);
  assert.equal(result.source, 'cortex');
  assert.equal(result.stale, false);
  assert.ok(Date.parse(result.fetchedAt) >= Date.parse(observedAt));
  assert.deepEqual(result.accounts[0], {
    handle:'chatgptricks', name:'Public chatgptricks', relationship:'owned', followerCount:12345,
    followersAsOf:observedAt, avatar:'/network/accounts/chatgptricks/avatar', avatarFallback:'/assets/universe/avatar-chatgptricks.jpg',
    profileUrl:'https://www.instagram.com/chatgptricks/',
  });
  assert.equal(result.accounts[1].avatar, '/network/accounts/new_sentient_page/avatar');
  assert.equal(result.accounts[1].avatarFallback, null);
  assert.doesNotMatch(JSON.stringify(result), /INTERNAL|private_internal_value|test-only|cortex\.example|group_name/);
  assert.ok(!upstream.calls.some(path => /competitor|mindset|out_of_scope|inactive/.test(path)));
  assert.deepEqual(await getOwnedAccountHandles(env, upstream.read), ['chatgptricks','new_sentient_page']);
  assert.equal(upstream.calls.length, 5, 'Profile and post consumers reuse ownership and scope discovery');
});

test('network follows settings pagination and filters within the current key selection', async () => {
  const upstream = source([{handle:'chatgptricks'},{handle:'evolving'}], {data:[{handle:'chatgptricks',group_name:'sentient',is_active:true}],pagination:{has_more:true,next_offset:100}}, {
    '/api/v1/settings/accounts?limit=100&offset=100': () => Response.json(page([{handle:'evolving',group_name:'sentient',is_active:true}])),
  });
  assert.deepEqual(await getOwnedAccountHandles(environment(), upstream.read), ['chatgptricks','evolving']);
  assert.equal(upstream.calls.length, 4);
});

test('a settings scope gap uses verified ownership only, never partner or competitor membership', async () => {
  const upstream = source([{handle:'chatgptricks'},{handle:'evolving'},{handle:'passionateincome'},{handle:'mindset.therapy'},{handle:'competitor'}], 403);
  const env = environment();
  assert.deepEqual(await getOwnedAccountHandles(env, upstream.read), ['chatgptricks','evolving','passionateincome']);
  await assert.rejects(getPublicOwnedAccountHandles(env,upstream.read), error => error.status === 403);
});

test('network rejects bad source contracts and failures without substituting hardcoded follower counts', async () => {
  for (const upstream of [
    source([{handle:'chatgptricks'}], 500),
    source([{handle:'chatgptricks'},{handle:'chatgptricks'}], page([])),
    source([{handle:'../../private'}], page([])),
    source([{handle:'competitor'}], 403),
    source([{handle:'chatgptricks'}], page([{handle:'chatgptricks',group_name:'sentient',is_active:true}]), { '/api/v1/accounts/chatgptricks': () => Response.json(profile('wrong_handle')) }),
    source([{handle:'chatgptricks'}], page([{handle:'chatgptricks',group_name:'sentient',is_active:true}]), { '/api/v1/accounts/chatgptricks': () => Response.json(profile('chatgptricks', -1)) }),
    source([{handle:'chatgptricks'}], 403, { '/api/v1/accounts': () => { throw new Error('offline'); } }),
  ]) await assert.rejects(getOwnedAccounts(environment(), upstream.read));
  await assert.rejects(getOwnedAccounts({}, async () => { throw new Error('must not fetch'); }));
});

test('observed dates remain separate from fetch time and undated counts stay unknown', async () => {
  const upstream = source([{handle:'chatgptricks'}], 403, {
    '/api/v1/accounts/chatgptricks': () => Response.json({ ...profile('chatgptricks'), data_updated_at:{profile:null} }),
  });
  const result = await getOwnedAccounts(environment(), upstream.read);
  assert.equal(result.accounts[0].followerCount, null);
  assert.equal(result.accounts[0].followersAsOf, null);
  assert.ok(result.fetchedAt);
});

test('warm requests coalesce and cache for five minutes without leaking across keys', async context => {
  const upstream = source([{handle:'chatgptricks'}], 403);
  const env = environment();
  const [first, second] = await Promise.all([getOwnedAccounts(env,upstream.read), getOwnedAccounts(env,upstream.read)]);
  assert.deepEqual(first, second);
  assert.equal(upstream.calls.length, 4);
  first.accounts[0].name = 'Caller mutation';
  assert.equal((await getOwnedAccounts(env,upstream.read)).accounts[0].name,'Public chatgptricks');
  assert.equal(upstream.calls.length, 4);
  await getOwnedAccounts(environment(),upstream.read);
  assert.equal(upstream.calls.length, 8, 'A different credential must perform its own scoped reads');
  const originalNow = Date.now();
  context.mock.method(Date,'now',() => originalNow + 301000);
  await assert.rejects(getOwnedAccounts(env,async () => { throw new Error('offline'); }), 'Expired data must fail so the frontend uses the explicit fallback');
});

test('edge snapshots are bounded by freshness and their cache keys contain no credential', async context => {
  const previous = globalThis.caches;
  context.after(() => { if (previous === undefined) delete globalThis.caches; else globalThis.caches = previous; });
  const snapshot = { source:'cortex', stale:false, fetchedAt:new Date().toISOString(), accounts:[{
    handle:'chatgptricks', name:'AI / ChatGPT', relationship:'owned', followerCount:12345,
    followersAsOf:observedAt, avatar:'/network/accounts/chatgptricks/avatar', avatarFallback:'/assets/universe/avatar-chatgptricks.jpg', profileUrl:'https://www.instagram.com/chatgptricks/',
  }] };
  const env = environment();
  globalThis.caches = { default:{
    async match(key) {
      assert.ok(key.startsWith('https://sentient-network-cache.invalid/v2/profiles/'));
      assert.ok(!key.includes(env.SENTIENTDASH_API_KEY));
      return Response.json(snapshot);
    },
    async put() { throw new Error('Unexpected cache rewrite'); },
  } };
  assert.deepEqual(await getOwnedAccounts(env,async () => { throw new Error('Must use fresh edge snapshot'); }), snapshot);
  globalThis.caches.default.match = async () => Response.json({ ...snapshot, fetchedAt:new Date(Date.now() - 301000).toISOString() });
  await assert.rejects(getOwnedAccounts(environment(), async () => { throw new Error('Source offline'); }), 'An expired edge snapshot cannot replace the explicit frontend fallback');
});

test('source tasks are retained on creation and adoption and cache IO cannot hang the response', async context => {
  const previous = globalThis.caches;
  context.after(() => { if (previous === undefined) delete globalThis.caches; else globalThis.caches = previous; });
  const setTimer = globalThis.setTimeout;
  context.mock.method(globalThis,'setTimeout',(callback,milliseconds,...args) => setTimer(callback,milliseconds === 1500 ? 1 : milliseconds,...args));
  globalThis.caches = {default:{match:() => new Promise(() => {}),put:() => new Promise(() => {})}};
  const tasks = [];
  const upstream = source([],page([]),{
    '/api/v1/tracker/accounts?limit=100&offset=0': () => Response.json(page([{handle:'chatgptricks',group:'sentient',private:false,full_name:'AI / ChatGPT',followers:123,captured_at:observedAt}])),
  });
  upstream.read.waitUntil = task => tasks.push(task);
  const env = environment();
  const [first,second] = await Promise.all([getOwnedAccounts(env,upstream.read),getOwnedAccounts(env,upstream.read)]);
  assert.deepEqual(first,second);
  assert.equal(upstream.calls.length,1);
  assert.ok(tasks.length >= 3,'The initial tasks and the joining request all retain their work');
  await Promise.all(tasks);
});
