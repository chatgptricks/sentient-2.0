import test from 'node:test';
import assert from 'node:assert/strict';
import { getNetworkPosts, handleNetworkPosts, handleNetworkPostCover, selectCampaignPool } from './network-posts.mjs';

const json = (status, data) => Response.json(data, { status });
const request = (path = '/network/posts', options) => new Request(`https://api.example${path}`, options);
const ago = offset => new Date(Date.now() - offset).toISOString();
const post = (shortcode, likes, extras = {}) => ({ shortcode, likes, is_promo: true, caption: `Campaign ${shortcode}`, published_at: ago(86400000), metrics_updated_at: ago(3600000), ...extras });
const page = (data, next = null) => ({ data, pagination: { has_more: next !== null, next_offset: next } });

function source({ accounts = [{ handle: 'chatgptricks', group: 'sentient' }], pages = {}, failure = null, cover = null, bulkPages = null, bulkFailure = null } = {}) {
  const calls = [];
  const env = { SENTIENTDASH_API_KEY: crypto.randomUUID() };
  const cortex = async (path, options) => {
    calls.push({ path, options });
    if (failure) return new Response('private upstream failure', { status: failure });
    if (path === '/api/v1/tracker/accounts?limit=100&offset=0') return bulkPages === null
      ? Response.json({ detail: 'Tracker scope not granted' }, { status: 403 })
      : Response.json(page(accounts.map(({ handle, group, private: privateAccount = false }) => ({ handle, group, private: privateAccount, followers: 1234, captured_at: ago(3600000), full_name: handle }))));
    if (path === '/api/v1/accounts') return Response.json({ data: accounts.map(({ handle }) => ({ handle, public_name: handle })) });
    if (path === '/api/v1/settings/accounts?limit=100&offset=0') return Response.json(page(accounts.map(({ handle, group }) => ({ handle, group_name: group, is_active: true }))));
    if (path.startsWith('/api/v1/posts?')) {
      if (bulkFailure) return new Response('private bulk upstream failure', { status: bulkFailure });
      const query = new URL(`https://cortex.example${path}`).searchParams;
      assert.equal(query.get('is_promo'), 'true');
      assert.equal(query.get('sort'), 'likes');
      assert.equal(query.get('limit'), '100');
      return Response.json(bulkPages?.[query.get('offset')] || page([]));
    }
    const match = /^\/api\/v1\/accounts\/([^/]+)\/posts\?is_promo=true&limit=100&offset=(\d+)$/.exec(path);
    if (match) return Response.json(pages[`${match[1]}:${match[2]}`] || page([]));
    if (path.endsWith('/cover') && cover) return cover(path, options);
    throw new Error(`Unexpected route ${path}`);
  };
  return { calls, env, cortex };
}

test('bulk reads only Tracker-confirmed public owned accounts and follows candidate offsets before ranking', async () => {
  const fixture = source({
    accounts: [{ handle: 'chatgptricks', group: 'sentient' }, { handle: 'chatgptips', group: 'sentient' }, { handle: 'privateown', group: 'sentient', private: true }, { handle: 'openai', group: 'competitors' }],
    bulkPages: {
      0: page([], 500),
      500: page([post('First', 100, { account: 'chatgptricks' }), post('Competitor', 999999, { account: 'openai' }), post('Private', 99999, { account: 'privateown' })], 750),
      750: page([post('RetainedWinner', 1000, { account: 'chatgptips' })]),
    },
  });
  const result = await getNetworkPosts(fixture.env, fixture.cortex);
  assert.deepEqual(result.posts.map(value => value.shortcode), ['RetainedWinner', 'First']);
  assert.equal(result.selection.sourceOperation, 'bulk-posts');
  assert.equal(result.selection.uniqueAccounts, 2);
  assert.equal(result.selection.complete, true);
  const reads = fixture.calls.filter(call => call.path.startsWith('/api/v1/posts?'));
  assert.equal(reads.length, 3);
  assert.equal(new URL(`https://cortex.example${reads[0].path}`).searchParams.get('account'), 'chatgptricks,chatgptips');
  assert.equal(new URL(`https://cortex.example${reads[2].path}`).searchParams.get('offset'), '750');
  assert.ok(!fixture.calls.some(call => /^\/api\/v1\/accounts\/[^/]+\/posts/.test(call.path)));
});

test('Research scope gaps use independently authorized public exports without expanding permissions', async () => {
  const fixture = source({ bulkPages: {}, bulkFailure: 403, pages: { 'chatgptricks:0': page([post('Public', 50)]) } });
  const result = await getNetworkPosts(fixture.env, fixture.cortex);
  assert.equal(result.posts[0].shortcode, 'Public');
  assert.equal(result.selection.sourceOperation, 'public-account-posts');
  assert.equal(fixture.calls.filter(call => call.path.startsWith('/api/v1/posts?')).length, 1);
  assert.equal(fixture.calls.filter(call => call.path.includes('/posts?is_promo=true')).length, 1);
});

test('bulk failure diagnostics contain only safe stage/status/path and do not fall back after partial reads', async context => {
  const fixture = source({ bulkPages: {}, bulkFailure: 503 });
  const logs = [];
  context.mock.method(console, 'warn', (...values) => logs.push(values));
  const response = await handleNetworkPosts(request(), fixture.env, json, fixture.cortex);
  assert.equal(response.status, 503);
  assert.ok(!fixture.calls.some(call => /^\/api\/v1\/accounts\/[^/]+\/posts/.test(call.path)));
  const output = JSON.stringify(logs);
  assert.match(output, /source-status/);
  assert.match(output, /503/);
  assert.match(output, /\/api\/v1\/posts/);
  assert.doesNotMatch(output, /upstream failure|Authorization|account=/);
  assert.ok(!output.includes(fixture.env.SENTIENTDASH_API_KEY));
  const publicError = await response.json();
  assert.deepEqual(publicError, {
    error: 'Campaign highlights are temporarily unavailable.',
    code: 'NETWORK_POSTS_UNAVAILABLE',
    networkStage: 'source-status',
    sourceStatus: 503,
    sourcePath: '/api/v1/posts',
  });
  assert.ok(!JSON.stringify(publicError).includes(fixture.env.SENTIENTDASH_API_KEY));
  assert.doesNotMatch(JSON.stringify(publicError), /upstream failure|Authorization|account=/);
});

test('campaign pool preserves account variety and deduplicates collaborative shortcodes', () => {
  const values = Array.from({ length: 25 }, (_, index) => ({ handle: 'chatgptricks', shortcode: `Code${index}`, likes: 1000 - index, publishedAt: ago(86400000) }));
  values.push({ handle: 'chatgptips', shortcode: 'Tips', likes: 10, publishedAt: ago(86400000) });
  values.push({ handle: 'evolving', shortcode: 'Evolving', likes: 9, publishedAt: ago(86400000) });
  values.push({ handle: 'chatgptips', shortcode: 'Code0', likes: 500, publishedAt: ago(86400000) });
  const result = selectCampaignPool(values);
  assert.equal(result.posts.length, 20);
  assert.equal(new Set(result.posts.map(value => value.shortcode)).size, 20);
  assert.deepEqual(new Set(result.posts.map(value => value.handle)), new Set(['chatgptricks', 'chatgptips', 'evolving']));
  assert.equal(result.uniquePromoPosts, 27);
  assert.equal(result.posts[0].likes, 1000);
});

test('reads complete public promotional pages, includes older winners, and excludes competitors and unsafe rows', async () => {
  const fixture = source({
    accounts: [{ handle: 'chatgptricks', group: 'sentient' }, { handle: 'chatgptips', group: 'sentient' }, { handle: 'openai', group: 'competitors' }],
    pages: {
      'chatgptricks:0': page([
        post('Recent', 10),
        post('NotPromo', 50000, { is_promo: false }),
        post('WrongAccount', 50000, { account: 'openai' }),
        post('Future', 50000, { published_at: new Date(Date.now() + 86400000).toISOString() }),
        post('Unknown', null), post('Hidden', 999, { hidden: true }), post('bad/code', 300),
      ], 100),
      'chatgptricks:100': page([post('OldWinner', 10000, { published_at: ago(8640000000) })]),
      'chatgptips:0': page([post('TipWinner', 2000)]),
    },
  });
  const result = await getNetworkPosts(fixture.env, fixture.cortex);
  assert.deepEqual(result.posts.map(value => value.shortcode), ['OldWinner', 'TipWinner', 'Recent']);
  assert.equal(result.selection.uniqueAccounts, 2);
  assert.equal(result.selection.complete, true);
  assert.equal(result.selection.eligibleAccounts, 2);
  assert.ok(fixture.calls.some(call => call.path.endsWith('offset=100')));
  assert.ok(!fixture.calls.some(call => call.path.startsWith('/api/v1/accounts/openai/')));
  assert.equal(result.posts[0].source, 'https://www.instagram.com/p/OldWinner/');
  assert.equal(result.posts[0].image, '/network/posts/chatgptricks/OldWinner/cover');
  assert.ok(!JSON.stringify(result).includes(fixture.env.SENTIENTDASH_API_KEY));
  assert.ok(!JSON.stringify(result).includes('WrongAccount'));
});

test('concurrent requests share one complete source snapshot without mixing different credentials', async () => {
  const fixture = source({ pages: { 'chatgptricks:0': page([post('One', 20)]) } });
  const [first, second] = await Promise.all([getNetworkPosts(fixture.env, fixture.cortex), getNetworkPosts(fixture.env, fixture.cortex)]);
  assert.deepEqual(first, second);
  const calls = fixture.calls.length;
  first.posts[0].caption = 'caller mutation';
  const cached = await getNetworkPosts(fixture.env, fixture.cortex);
  assert.notEqual(cached.posts[0].caption, 'caller mutation');
  assert.equal(fixture.calls.length, calls);
  const other = source({ pages: { 'chatgptricks:0': page([post('Two', 30)]) } });
  assert.equal((await getNetworkPosts(other.env, other.cortex)).posts[0].shortcode, 'Two');
});

test('creating and adopting an in-flight campaign read retain it in both request contexts', { timeout: 2000 }, async () => {
  const fixture = source({ pages: { 'chatgptricks:0': page([post('Retained', 20)]) } });
  let release;
  let sourceStarted;
  let adopted;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { sourceStarted = resolve; });
  const retainedBySecond = new Promise(resolve => { adopted = resolve; });
  const retained = [];
  let beforeSecond = null;
  const cortex = async (...args) => {
    if (args[0].includes('/posts?')) { sourceStarted(); await blocked; }
    return fixture.cortex(...args);
  };
  cortex.waitUntil = task => { retained.push(task); if (beforeSecond !== null && retained.length > beforeSecond) adopted(); };
  const first = getNetworkPosts(fixture.env, cortex);
  await started;
  beforeSecond = retained.length;
  const second = getNetworkPosts(fixture.env, cortex);
  await retainedBySecond;
  release();
  const [left, right] = await Promise.all([first, second]);
  assert.deepEqual(left, right);
  assert.ok(beforeSecond >= 1);
  assert.equal(retained.length, beforeSecond + 1);
  assert.equal(fixture.calls.filter(call => call.path.includes('/posts?')).length, 1);
  await Promise.all(retained);
});

test('refuses truncated or cyclic pagination instead of claiming an incomplete top pool', async () => {
  const fixture = source({ pages: { 'chatgptricks:0': page([post('One', 20)], 0) } });
  const response = await handleNetworkPosts(request(), fixture.env, json, fixture.cortex);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Campaign highlights are temporarily unavailable.', code: 'NETWORK_POSTS_UNAVAILABLE', networkStage: 'public-posts-pagination', sourcePath: '/api/v1/accounts/chatgptricks/posts' });
});

test('missing credentials, revoked scope and no eligible campaigns use the static-site failure path', async () => {
  assert.equal((await handleNetworkPosts(request(), {}, json, async () => { throw new Error('must not fetch'); })).status, 401);
  for (const status of [401, 403, 429, 503]) {
    const fixture = source({ failure: status });
    const response = await handleNetworkPosts(request(), fixture.env, json, fixture.cortex);
    assert.equal(response.status, [401, 403].includes(status) ? status : 503);
    assert.ok(!(await response.text()).includes('private upstream'));
  }
  const empty = source();
  assert.equal((await handleNetworkPosts(request(), empty.env, json, empty.cortex)).status, 503);
});

test('fixed public endpoints reject arbitrary parameters and writes before reading Cortex', async () => {
  const fixture = source();
  assert.equal((await handleNetworkPosts(request('/network/posts?account=openai'), fixture.env, json, fixture.cortex)).status, 400);
  assert.equal((await handleNetworkPosts(request('/network/posts', { method: 'POST' }), fixture.env, json, fixture.cortex)).status, 405);
  assert.equal(fixture.calls.length, 0);
});

test('cover proxy only permits current selected posts and strips credentials from storage fetches', async context => {
  const fixture = source({
    pages: { 'chatgptricks:0': page([post('PublicCover', 20)]) },
    cover: (_path, options) => {
      assert.equal(options.redirect, 'manual');
      return new Response(null, { status: 307, headers: { Location: 'https://account.r2.cloudflarestorage.com/public/cover.jpg?signature=secret' } });
    },
  });
  const storage = context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /^https:\/\/account\.r2\.cloudflarestorage\.com\//);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers, undefined);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } });
  });
  const rejected = await handleNetworkPostCover(request('/network/posts/chatgptricks/NotSelected/cover'), fixture.env, json, fixture.cortex, undefined, 'chatgptricks', 'NotSelected');
  assert.equal(rejected.status, 404);
  assert.equal(storage.mock.callCount(), 0);
  const accepted = await handleNetworkPostCover(request('/network/posts/chatgptricks/PublicCover/cover'), fixture.env, json, fixture.cortex, undefined, 'chatgptricks', 'PublicCover');
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(accepted.headers.get('Location'), null);
  assert.equal(accepted.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual([...new Uint8Array(await accepted.arrayBuffer())], [1, 2, 3]);
  assert.equal(storage.mock.callCount(), 1);
});

test('cover proxy refuses redirect pivots, HTML and oversized source images', async context => {
  for (const response of [
    new Response(null, { status: 307, headers: { Location: 'https://evil.example/steal' } }),
    new Response('<html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '3000000' } }),
  ]) {
    const fixture = source({ pages: { 'chatgptricks:0': page([post('Cover', 20)]) }, cover: () => response });
    const external = context.mock.method(globalThis, 'fetch', async () => { throw new Error('must not follow'); });
    const result = await handleNetworkPostCover(request('/network/posts/chatgptricks/Cover/cover'), fixture.env, json, fixture.cortex, undefined, 'chatgptricks', 'Cover');
    assert.ok([502, 503].includes(result.status));
    assert.equal(external.mock.callCount(), 0);
    external.mock.restore();
  }
});
