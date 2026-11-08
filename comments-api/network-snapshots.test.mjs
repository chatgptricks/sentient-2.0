import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { withSavedNetwork, projectNetworkSnapshot, authorizationFingerprint } from './network-snapshots.mjs';
import { handleNetworkAccountAvatar } from './network-avatar.mjs';
import { handleNetworkPostCover } from './network-posts.mjs';

const ago = milliseconds => new Date(Date.now() - milliseconds).toISOString();
const accounts = (followers = 123, fetchedAt = ago(1000)) => ({ source: 'cortex', stale: false, fetchedAt, accounts: [{
  handle: 'chatgptricks', name: 'AI / ChatGPT', relationship: 'owned', followerCount: followers, followersAsOf: ago(86400000),
  avatar: '/network/accounts/chatgptricks/avatar', avatarFallback: '/assets/universe/avatar-chatgptricks.jpg', profileUrl: 'https://www.instagram.com/chatgptricks/',
}] });
const posts = () => ({ source: 'cortex', fetchedAt: ago(1000), posts: [{ handle: 'chatgptricks', shortcode: 'Campaign',
  source: 'https://www.instagram.com/p/Campaign/', image: '/network/posts/chatgptricks/Campaign/cover',
  caption: 'Public campaign', title: 'Public campaign', likes: 45, publishedAt: ago(86400000), metricsUpdatedAt: ago(3600000) }],
  selection: { metric: 'likes', strategy: 'best-per-account-then-likes', poolLimit: 20, uniqueAccounts: 1,
    accountsWithPromos: 1, eligibleAccounts: 1, uniquePromoPosts: 1, complete: true, sourceOperation: 'public-account-posts' } });
const transient = () => Object.assign(new Error('upstream private text'), { status: 503, networkStage: 'source-status' });
const json = (status, body) => Response.json(body, { status });
const request = path => new Request(`https://api.example${path}`);

function context(read = async () => { throw transient(); }) {
  const tasks = [];
  read.waitUntil = task => tasks.push(task);
  return { read, tasks, async flush() { await Promise.all(tasks); } };
}

function setup(t) {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('./migrations/0007_network_snapshots.sql', import.meta.url), 'utf8'));
  t.after(() => database.close());
  const DB = { prepare(sql) { const statement = database.prepare(sql); return { bind(...values) { return {
    async first() { return statement.get(...values) ?? null; },
    async run() { const result = statement.run(...values); return { meta: { changes: result.changes } }; },
  }; } }; } };
  return { database, env: { DB, SENTIENTDASH_API_KEY: `test-only-${crypto.randomUUID()}` } };
}

test('successful public reads save asynchronously and retain observation dates rather than save time', async t => {
  const { database, env } = setup(t), ctx = context(), value = accounts();
  value.accounts[0].privateCredential = 'CANARY_INTERNAL';
  const live = await withSavedNetwork('accounts', env, ctx.read, async () => value);
  assert.equal(live.stale, false);
  assert.equal(live.accounts[0].followerCount, 123);
  assert.equal(live.savedAt, undefined, 'Only an already-confirmed copy can claim a savedAt');
  assert.doesNotMatch(JSON.stringify(live), /CANARY_INTERNAL|privateCredential/);
  assert.equal(ctx.tasks.length, 1);
  await ctx.flush();
  const row = database.prepare('SELECT * FROM network_snapshots').get();
  assert.ok(row.saved_at && row.signature && row.authorization_fingerprint);
  assert.equal(row.authorization_fingerprint, await authorizationFingerprint(env));
  assert.ok(!JSON.stringify(row).includes(env.SENTIENTDASH_API_KEY));
  const stored = JSON.parse(row.payload);
  assert.equal(stored.accounts[0].followersAsOf, value.accounts[0].followersAsOf);
  assert.notEqual(row.saved_at, stored.accounts[0].followersAsOf);
  const cached = await withSavedNetwork('accounts', env, context().read, async () => value);
  assert.equal(cached.savedAt, row.saved_at);
});

test('a cold Worker reads the last valid accounts/posts after transient failure without resetting source dates', async t => {
  const { env } = setup(t);
  for (const [resource, value] of [['accounts', accounts()], ['posts', posts()]]) {
    const live = context();
    await withSavedNetwork(resource, env, live.read, async () => value);
    await live.flush();
    const cold = await import(`./network-snapshots.mjs?restart=${crypto.randomUUID()}`);
    const fallback = await cold.withSavedNetwork(resource, env, context().read, async () => { throw transient(); });
    assert.equal(fallback.source, 'cortex');
    assert.equal(fallback.stale, true);
    assert.equal(fallback.fallback, 'last-saved');
    assert.ok(fallback.savedAt);
    assert.equal(fallback.fetchedAt, value.fetchedAt);
    if (resource === 'accounts') assert.deepEqual(fallback.accounts, projectNetworkSnapshot(resource, value).accounts);
    else assert.deepEqual(fallback.posts, value.posts);
  }
});

test('late asynchronous writes cannot replace a newer successful source snapshot', async t => {
  const { database, env } = setup(t), original = env.DB;
  const older = accounts(100, ago(10000)), newer = accounts(200, ago(1000));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  env.DB = { prepare(sql) { const prepared = original.prepare(sql); return { bind(...values) { const bound = prepared.bind(...values); return {
    ...bound, async run() { if (sql.includes('INSERT INTO') && values[4] === older.fetchedAt) await gate; return bound.run(); },
  }; } }; } };
  const first = context(), second = context();
  await withSavedNetwork('accounts', env, first.read, async () => older);
  await withSavedNetwork('accounts', env, second.read, async () => newer);
  await second.flush();
  release(); await first.flush();
  const row = database.prepare('SELECT payload FROM network_snapshots').get();
  assert.equal(JSON.parse(row.payload).accounts[0].followerCount, 200);
});

test('an outage returns the newest figures saved while the failed source request was in flight', async t => {
  const { env } = setup(t), first = context();
  await withSavedNetwork('accounts', env, first.read, async () => accounts(100, ago(10000))); await first.flush();
  const result = await withSavedNetwork('accounts', env, context().read, async () => {
    const newer = context();
    await withSavedNetwork('accounts', env, newer.read, async () => accounts(200, ago(1000))); await newer.flush();
    throw transient();
  });
  assert.equal(result.stale, true);
  assert.equal(result.accounts[0].followerCount, 200);
});

test('an older successful cache result cannot replace newer saved figures in a cold client response', async t => {
  const { database, env } = setup(t), first = context(), newest = accounts(200, ago(1000));
  await withSavedNetwork('accounts', env, first.read, async () => newest); await first.flush();
  const saved = database.prepare('SELECT payload, saved_at FROM network_snapshots').get(), ctx = context();
  const result = await withSavedNetwork('accounts', env, ctx.read, async () => accounts(100, ago(10000)));
  assert.equal(result.accounts[0].followerCount, 200);
  assert.equal(result.fetchedAt, newest.fetchedAt);
  assert.equal(result.savedAt, saved.saved_at);
  assert.equal(result.stale, true);
  assert.equal(result.fallback, 'last-saved');
  assert.equal(ctx.tasks.length, 0);
  assert.deepEqual(database.prepare('SELECT payload, saved_at FROM network_snapshots').get(), saved);
});

test('a newer concurrent save also takes precedence over an older successful source response', async t => {
  const { env } = setup(t), first = context();
  await withSavedNetwork('accounts', env, first.read, async () => accounts(100, ago(10000))); await first.flush();
  const result = await withSavedNetwork('accounts', env, context().read, async () => {
    const newer = context();
    await withSavedNetwork('accounts', env, newer.read, async () => accounts(200, ago(1000))); await newer.flush();
    return accounts(150, ago(5000));
  });
  assert.equal(result.stale, true);
  assert.equal(result.accounts[0].followerCount, 200);
});

test('an authorization rejection during a cached source read prevents returning the older successful response', async t => {
  const { database, env } = setup(t), first = context();
  await withSavedNetwork('accounts', env, first.read, async () => accounts(123, ago(10000))); await first.flush();
  await assert.rejects(withSavedNetwork('accounts', env, context().read, async () => {
    await assert.rejects(withSavedNetwork('posts', env, context().read, async () => { throw Object.assign(new Error('Revoked'), { status: 401 }); }));
    return accounts(100, ago(10000));
  }), error => error.status === 401);
  assert.deepEqual(database.prepare('SELECT authorization_rejected_status FROM network_snapshots ORDER BY resource').all().map(row => row.authorization_rejected_status), [401, 401]);
});

test('invalid live source JSON/contracts retain the last valid saved copy and never save the malformed response', async t => {
  for (const error of [Object.assign(new Error('Bad JSON'), { networkStage: 'source-json' }), Object.assign(new Error('Bad profile'), { networkStage: 'profile-count-contract' })]) {
    const { database, env } = setup(t), first = context();
    await withSavedNetwork('accounts', env, first.read, async () => accounts()); await first.flush();
    const previous = database.prepare('SELECT payload, saved_at FROM network_snapshots').get();
    const result = await withSavedNetwork('accounts', env, context().read, async () => { throw error; });
    assert.equal(result.stale, true); assert.equal(result.accounts[0].followerCount, 123);
    assert.deepEqual(database.prepare('SELECT payload, saved_at FROM network_snapshots').get(), previous);
  }
});

test('401/403 reject both old snapshots durably and never become stale successes after a restart', async t => {
  for (const status of [401, 403]) {
    const { database, env } = setup(t);
    for (const [resource, value] of [['accounts', accounts()], ['posts', posts()]]) {
      const ctx = context(); await withSavedNetwork(resource, env, ctx.read, async () => value); await ctx.flush();
    }
    const rejected = context();
    await assert.rejects(withSavedNetwork('accounts', env, rejected.read, async () => { throw Object.assign(new Error('Revoked'), { status }); }), error => error.status === status);
    assert.equal(rejected.read.networkCacheBypass, true);
    assert.deepEqual(database.prepare('SELECT authorization_rejected_status FROM network_snapshots ORDER BY resource').all().map(row => row.authorization_rejected_status), [status, status]);
    for (const resource of ['accounts', 'posts']) {
      const cold = await import(`./network-snapshots.mjs?rejected=${crypto.randomUUID()}`), ctx = context();
      await assert.rejects(cold.withSavedNetwork(resource, env, ctx.read, async () => { throw transient(); }), error => error.status === status);
      assert.equal(ctx.read.networkCacheBypass, true);
    }
  }
});

test('a changed credential cannot read another authorization snapshot', async t => {
  const { env } = setup(t), ctx = context();
  await withSavedNetwork('accounts', env, ctx.read, async () => accounts()); await ctx.flush();
  const changed = { ...env, SENTIENTDASH_API_KEY: `different-${crypto.randomUUID()}` };
  await assert.rejects(withSavedNetwork('accounts', changed, context().read, async () => { throw transient(); }));
  assert.notEqual(await authorizationFingerprint(env), await authorizationFingerprint(changed));
});

test('schema or well-shaped payload corruption is rejected even after process restart', async t => {
  for (const corrupt of ['payload', 'schema']) {
    const { database, env } = setup(t), ctx = context();
    await withSavedNetwork('accounts', env, ctx.read, async () => accounts()); await ctx.flush();
    if (corrupt === 'schema') database.exec('UPDATE network_snapshots SET schema_version = 999');
    else {
      const row = database.prepare('SELECT payload FROM network_snapshots').get(), value = JSON.parse(row.payload);
      value.accounts[0].followerCount = 999999;
      database.prepare('UPDATE network_snapshots SET payload = ?').run(JSON.stringify(value));
    }
    const cold = await import(`./network-snapshots.mjs?corrupt=${crypto.randomUUID()}`);
    await assert.rejects(cold.withSavedNetwork('accounts', env, context().read, async () => { throw transient(); }));
  }
});

test('D1 failures do not prevent valid live data and do not turn malformed payloads into saved data', async t => {
  const { env } = setup(t), ctx = context();
  env.DB = { prepare() { throw new Error('Database unavailable'); } };
  const live = await withSavedNetwork('accounts', env, ctx.read, async () => accounts());
  assert.equal(live.stale, false); assert.equal(live.accounts[0].followerCount, 123);
  assert.equal(ctx.read.networkCacheBypass, true); await ctx.flush();
  for (const invalid of [accounts(-1), { ...accounts(), accounts: [{ ...accounts().accounts[0], avatar: 'https://outside.example/secret' }] }]) {
    await assert.rejects(withSavedNetwork('accounts', env, context().read, async () => invalid), error => error.networkStage === 'snapshot-live-contract');
  }
});

test('avatars and cover proxies keep saved membership during an outage without permitting arbitrary handles/codes', async t => {
  const { env } = setup(t);
  for (const [resource, value] of [['accounts', accounts()], ['posts', posts()]]) {
    const ctx = context(); await withSavedNetwork(resource, env, ctx.read, async () => value); await ctx.flush();
  }
  const mediaReads = [];
  const ctx = context(async path => {
    if (path === '/api/dashboard/avatar/chatgptricks' || path === '/api/v1/accounts/chatgptricks/posts/Campaign/cover') {
      mediaReads.push(path); return new Response('JPEG', { headers: { 'Content-Type': 'image/jpeg' } });
    }
    return new Response('unavailable', { status: 503 });
  });
  const avatarPath = '/network/accounts/chatgptricks/avatar';
  assert.equal((await handleNetworkAccountAvatar(request(avatarPath), env, json, ctx.read, null, 'chatgptricks')).status, 200);
  assert.equal((await handleNetworkAccountAvatar(request('/network/accounts/outside/avatar'), env, json, ctx.read, null, 'outside')).status, 404);
  const coverPath = '/network/posts/chatgptricks/Campaign/cover';
  assert.equal((await handleNetworkPostCover(request(coverPath), env, json, ctx.read, null, 'chatgptricks', 'Campaign')).status, 200);
  assert.equal((await handleNetworkPostCover(request('/network/posts/chatgptricks/Outside/cover'), env, json, ctx.read, null, 'chatgptricks', 'Outside')).status, 404);
  assert.deepEqual(mediaReads, ['/api/dashboard/avatar/chatgptricks', '/api/v1/accounts/chatgptricks/posts/Campaign/cover']);
});

test('a website-key rejection from a cover read also invalidates saved data for that authorization', async t => {
  const { database, env } = setup(t);
  for (const [resource, value] of [['accounts', accounts()], ['posts', posts()]]) {
    const ctx = context(); await withSavedNetwork(resource, env, ctx.read, async () => value); await ctx.flush();
  }
  const ctx = context(async path => new Response('unavailable', { status: path.endsWith('/cover') ? 401 : 503 }));
  assert.equal((await handleNetworkPostCover(request('/network/posts/chatgptricks/Campaign/cover'), env, json, ctx.read, null, 'chatgptricks', 'Campaign')).status, 401);
  assert.deepEqual(database.prepare('SELECT authorization_rejected_status FROM network_snapshots ORDER BY resource').all().map(row => row.authorization_rejected_status), [401, 401]);
  await assert.rejects(withSavedNetwork('accounts', env, context().read, async () => { throw transient(); }), error => error.status === 401);
});
