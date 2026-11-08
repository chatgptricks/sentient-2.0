import { getOwnedAccountHandles, getPublicOwnedAccountHandles } from './network-accounts.mjs';
import { withSavedNetwork, rejectNetworkAuthorization } from './network-snapshots.mjs';

const handlePattern = /^[a-z0-9_.]{1,30}$/;
const shortcodePattern = /^[A-Za-z0-9_-]{1,64}$/;
const freshFor = 15 * 60 * 1000;
const pendingFor = 28000;
const maxPages = 40;
const imageLimit = 2 * 1024 * 1024;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const snapshots = new Map();
const pending = new Map();
const unavailable = (stage = 'unknown', details = {}) => Object.assign(new Error('Campaign highlights are temporarily unavailable.'), { networkStage: stage, ...details });
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now() ? value : null;

async function bounded(promise, milliseconds, stage) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(unavailable(stage)), milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}

const retainTask = (requestCortex, task) => {
  if (typeof requestCortex.waitUntil === 'function') requestCortex.waitUntil(task.catch(() => {}));
};

async function cacheKey(env) {
  if (!env.SENTIENTDASH_API_KEY) throw unavailable('configuration-key-missing');
  const identity = `${env.SENTIENTDASH_API_URL || 'https://cortex-api-db2e.onrender.com'}\n${env.SENTIENTDASH_API_KEY}`;
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity)))].map(value => value.toString(16).padStart(2, '0')).join('');
  return `https://sentient-network-cache.invalid/v2/posts/${hash}`;
}

function normalizePost(row, handle) {
  if (!row || row.is_promo !== true || row.hidden === true || row.is_deleted === true || row.private === true
    || (row.account && row.account !== handle) || !shortcodePattern.test(row.shortcode || '')
    || !Number.isSafeInteger(row.likes) || row.likes < 0 || !validDate(row.published_at)) return null;
  const caption = typeof row.caption === 'string' ? row.caption.trim().slice(0, 2000) : '';
  return {
    handle,
    shortcode: row.shortcode,
    source: `https://www.instagram.com/p/${row.shortcode}/`,
    image: `/network/posts/${handle}/${row.shortcode}/cover`,
    caption,
    title: caption.split(/\n/).map(line => line.trim()).find(Boolean)?.slice(0, 100) || `Campaign by @${handle}`,
    likes: row.likes,
    publishedAt: row.published_at,
    metricsUpdatedAt: validDate(row.metrics_updated_at),
  };
}

const comparePosts = (left, right) => right.likes - left.likes
  || Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
  || left.handle.localeCompare(right.handle) || left.shortcode.localeCompare(right.shortcode);

// Use one winner per account before filling the remaining places by likes.
// A collaborative shortcode is one public post even when exported for two accounts.
export function selectCampaignPool(posts, limit = 20) {
  const unique = new Map();
  for (const post of [...posts].sort(comparePosts)) if (!unique.has(post.shortcode)) unique.set(post.shortcode, post);
  const ranked = [...unique.values()];
  const byAccount = new Map();
  for (const post of ranked) if (!byAccount.has(post.handle)) byAccount.set(post.handle, post);
  const chosen = [...byAccount.values()].sort(comparePosts).slice(0, limit);
  const codes = new Set(chosen.map(post => post.shortcode));
  for (const post of ranked) {
    if (chosen.length >= limit) break;
    if (!codes.has(post.shortcode)) { chosen.push(post); codes.add(post.shortcode); }
  }
  return { posts: chosen.sort(comparePosts), uniquePromoPosts: ranked.length, accountsWithPromos: byAccount.size };
}

async function readPage(requestCortex, path, signal) {
  const sourcePath = path.split('?')[0];
  let response;
  try { response = await requestCortex(path, { signal }); }
  catch { throw unavailable(signal.aborted ? 'source-timeout' : 'source-request', { sourcePath }); }
  if (!response.ok) throw unavailable('source-status', { sourcePath, status: response.status });
  let body;
  try { body = await response.json(); }
  catch { throw unavailable('source-json', { sourcePath, status: response.status }); }
  if (!Array.isArray(body?.data) || body.data.length > 100 || typeof body.pagination?.has_more !== 'boolean') throw unavailable('posts-page-contract', { sourcePath });
  return body;
}

async function readBulkCampaigns(handles, requestCortex, signal) {
  const allowed = new Set(handles);
  const posts = [];
  let offset = 0;
  for (let count = 0; count < maxPages; count++) {
    const path = `/api/v1/posts?account=${encodeURIComponent(handles.join(','))}&is_promo=true&sort=likes&limit=100&offset=${offset}`;
    let page;
    try { page = await readPage(requestCortex, path, signal); }
    catch (error) {
      // The public account-area export remains independently available when
      // this existing key has not been granted Research. Do not change scopes.
      if (count === 0 && error.status === 403) return null;
      throw error;
    }
    for (const row of page.data) {
      if (!allowed.has(row.account)) continue;
      const post = normalizePost(row, row.account);
      if (post) posts.push(post);
    }
    if (!page.pagination.has_more) return posts;
    const next = page.pagination.next_offset;
    if (!Number.isSafeInteger(next) || next <= offset) throw unavailable('bulk-posts-pagination', { sourcePath: '/api/v1/posts' });
    offset = next;
  }
  throw unavailable('bulk-posts-page-budget', { sourcePath: '/api/v1/posts' });
}

async function readLegacyCampaigns(handles, requestCortex, signal, controller) {
  if (handles.length > maxPages) throw unavailable('public-account-budget');
  const posts = [];
  let cursor = 0;
  let pagesRead = 0;
  let failed = false;
  // The legacy public export excludes private profiles, hidden/deleted posts,
  // and future dates. It also hydrates retained metrics before pagination.
  try { await Promise.all(Array.from({ length: Math.min(3, handles.length) }, async () => {
    while (!failed && cursor < handles.length) {
      const handle = handles[cursor++];
      let offset = 0;
      while (!failed) {
        if (++pagesRead > maxPages) throw unavailable('public-posts-page-budget');
        const page = await readPage(requestCortex, `/api/v1/accounts/${handle}/posts?is_promo=true&limit=100&offset=${offset}`, signal);
        for (const row of page.data) {
          const post = normalizePost(row, handle);
          if (post) posts.push(post);
        }
        if (!page.pagination.has_more) break;
        const next = page.pagination.next_offset;
        if (!Number.isSafeInteger(next) || next <= offset) throw unavailable('public-posts-pagination', { sourcePath: `/api/v1/accounts/${handle}/posts` });
        offset = next;
      }
    }
  })); }
  catch (error) { failed = true; controller.abort(); throw error; }
  return posts;
}

async function readCampaigns(env, requestCortex) {
  const controller = new AbortController();
  const signal = AbortSignal.any([AbortSignal.timeout(20000), controller.signal]);
  let handles;
  let posts = null;
  let operation = 'bulk-posts';
  try {
    // Unlike the bulk Research projection, the legacy public export itself
    // enforces profile privacy. Only Tracker-confirmed public profiles can
    // use the faster bulk query without exposing a private account's content.
    handles = await getPublicOwnedAccountHandles(env, requestCortex);
    if (!handles.length || handles.some(handle => !handlePattern.test(handle))) throw unavailable('public-ownership-empty');
    posts = await readBulkCampaigns(handles, requestCortex, signal);
  } catch (error) {
    if (error.status !== 403) throw error;
  }
  if (posts === null) {
    handles = await getOwnedAccountHandles(env, requestCortex);
    if (!handles.length || handles.some(handle => !handlePattern.test(handle))) throw unavailable('ownership-empty');
    posts = await readLegacyCampaigns(handles, requestCortex, signal, controller);
    operation = 'public-account-posts';
  }
  const selection = selectCampaignPool(posts);
  if (!selection.posts.length) throw unavailable('campaign-pool-empty', { sourcePath: operation === 'bulk-posts' ? '/api/v1/posts' : '/api/v1/accounts' });
  return {
    source: 'cortex',
    fetchedAt: new Date().toISOString(),
    posts: selection.posts,
    selection: {
      metric: 'likes',
      strategy: 'best-per-account-then-likes',
      poolLimit: 20,
      uniqueAccounts: new Set(selection.posts.map(post => post.handle)).size,
      accountsWithPromos: selection.accountsWithPromos,
      eligibleAccounts: handles.length,
      uniquePromoPosts: selection.uniquePromoPosts,
      complete: true,
      sourceOperation: operation,
    },
  };
}

async function getLiveNetworkPosts(env, requestCortex) {
  const key = await cacheKey(env);
  const bypass = requestCortex?.networkCacheBypass === true;
  const fresh = value => value?.source === 'cortex' && Array.isArray(value.posts) && value.posts.length > 0 && value.posts.length <= 20
    && Number.isFinite(Date.parse(value.fetchedAt)) && Date.now() - Date.parse(value.fetchedAt) >= 0 && Date.now() - Date.parse(value.fetchedAt) < freshFor;
  const previous = snapshots.get(key);
  if (!bypass && fresh(previous)) return structuredClone(previous);
  snapshots.delete(key);
  const inFlight = pending.get(key);
  if (!bypass && inFlight && Date.now() - inFlight.startedAt >= 0 && Date.now() - inFlight.startedAt < pendingFor) {
    retainTask(requestCortex, inFlight.task);
    return structuredClone(await bounded(inFlight.task, pendingFor - (Date.now() - inFlight.startedAt), 'campaign-pending-timeout'));
  }
  pending.delete(key);
  const startedAt = Date.now();
  const load = (async () => {
    const cache = globalThis.caches?.default;
    try {
      const response = bypass ? null : await bounded(Promise.resolve(cache?.match(key)), 1500, 'cache-match-timeout');
      if (response?.ok) {
        const value = await bounded(response.json(), 1500, 'cache-json-timeout');
        if (fresh(value)) { snapshots.set(key, value); return value; }
      }
    } catch { /* A cache read failure still permits a fresh source request. */ }
    const snapshot = await readCampaigns(env, requestCortex);
    snapshots.set(key, snapshot);
    if (snapshots.size > 16) snapshots.delete(snapshots.keys().next().value);
    try { await bounded(Promise.resolve(cache?.put(key, Response.json(snapshot, { headers: { 'Cache-Control': 'public, max-age=900' } }))), 1500, 'cache-put-timeout'); }
    catch { /* The complete source result remains usable without edge storage. */ }
    return snapshot;
  })();
  const task = bounded(load, pendingFor, 'campaign-load-timeout');
  pending.set(key, { task, startedAt });
  retainTask(requestCortex, task);
  try { return structuredClone(await task); }
  finally { if (pending.get(key)?.task === task) pending.delete(key); }
}

export function getNetworkPosts(env, requestCortex) {
  return withSavedNetwork('posts', env, requestCortex, () => getLiveNetworkPosts(env, requestCortex));
}

export async function handleNetworkPosts(request, env, json, requestCortex) {
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' });
  if (new URL(request.url).search) return json(400, { error: 'This endpoint does not accept query parameters.' });
  try { return json(200, await getNetworkPosts(env, requestCortex)); }
  catch (error) {
    const diagnostics = {
      networkStage: typeof error?.networkStage === 'string' && /^[a-z0-9-]{1,60}$/.test(error.networkStage) ? error.networkStage : 'unexpected',
      ...(Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599 ? { sourceStatus: error.status } : {}),
      ...(typeof error?.sourcePath === 'string' && /^\/api\/v1\/[a-zA-Z0-9_/.-]+$/.test(error.sourcePath) ? { sourcePath: error.sourcePath } : {}),
    };
    console.warn('Network campaigns unavailable', diagnostics);
    return json([401, 403].includes(error?.status) ? error.status : 503, { error: 'Campaign highlights are temporarily unavailable.', code: 'NETWORK_POSTS_UNAVAILABLE', ...diagnostics });
  }
}

async function boundedImage(response) {
  const length = response.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > imageLimit)) return null;
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > imageLimit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  if (!size) return null;
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function handleNetworkPostCover(request, env, json, requestCortex, ctx, handle, shortcode) {
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' });
  if (new URL(request.url).search || !handlePattern.test(handle || '') || !shortcodePattern.test(shortcode || '')) return json(404, { error: 'Not found.' });
  try {
    // Validate membership before consulting the image cache, so an arbitrary
    // request cannot turn this public route into a general website-key proxy.
    const snapshot = await getNetworkPosts(env, requestCortex);
    if (!snapshot.posts.some(post => post.handle === handle && post.shortcode === shortcode)) return json(404, { error: 'Not found.' });
    const cache = globalThis.caches?.default;
    const key = `${await cacheKey(env)}/${handle}/${shortcode}`;
    try {
      const cached = await bounded(Promise.resolve(cache?.match(key)), 1500, 'cover-cache-match-timeout');
      if (cached) return cached;
    } catch { /* A cache read failure still permits a fresh source request. */ }
    const signal = AbortSignal.timeout(12000);
    let upstream = await requestCortex(`/api/v1/accounts/${handle}/posts/${shortcode}/cover`, { redirect: 'manual', signal });
    if ([401, 403].includes(upstream.status)) {
      await rejectNetworkAuthorization(env, requestCortex, upstream.status);
      return json(upstream.status, { error: 'Cover unavailable.' });
    }
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const url = new URL(upstream.headers.get('Location'));
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !/(^|\.)r2\.cloudflarestorage\.com$/.test(url.hostname)) throw unavailable();
      // The stored public cover's signed URL is never sent to the browser,
      // and the website API credential is never forwarded to object storage.
      upstream = await fetch(url.href, { redirect: 'manual', signal });
    }
    const type = (upstream.headers.get('Content-Type') || '').split(';')[0].toLowerCase().trim();
    if (!upstream.ok || !imageTypes.has(type)) return json(upstream.status === 404 ? 404 : 502, { error: 'Cover unavailable.' });
    const bytes = await boundedImage(upstream);
    if (!bytes) return json(502, { error: 'Cover unavailable.' });
    const response = new Response(bytes, { headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=900',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    } });
    if (cache) ctx?.waitUntil?.(bounded(cache.put(key, response.clone()), 1500, 'cover-cache-put-timeout').catch(() => {}));
    return response;
  } catch { return json(503, { error: 'Cover unavailable.' }); }
}
