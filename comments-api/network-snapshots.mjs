// Persistent, authorization-bound copies of validated public Cortex data.
// A savedAt timestamp describes this copy, never a profile/metric observation.
const resources = new Set(['accounts', 'posts']);
const handlePattern = /^[a-z0-9_.]{1,30}$/;
const shortcodePattern = /^[A-Za-z0-9_-]{1,64}$/;
const denied = new Map();
const outages = new Map();
const writes = new Map();
const maximumPayload = 1024 * 1024;
const outageFor = 30000;
const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now() ? value : null;
const text = (value, length) => typeof value === 'string' && value.length <= length ? value : null;
const resourceKey = (resource, fingerprint) => `${resource}:${fingerprint}`;

async function deadline(task, milliseconds) {
  let timer;
  try { return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Snapshot storage timeout.')), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

export async function authorizationFingerprint(env) {
  if (!env.SENTIENTDASH_API_KEY) throw Object.assign(new Error('Network credentials are unavailable.'), { status: 401, networkStage: 'configuration-key-missing' });
  const identity = `${env.SENTIENTDASH_API_URL || 'https://cortex-api-db2e.onrender.com'}\n${env.SENTIENTDASH_API_KEY}`;
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity)));
}

function projectAccount(account) {
  const handle = account?.handle;
  if (typeof handle !== 'string' || !handlePattern.test(handle) || account.relationship !== 'owned' || text(account.name, 200) === null
    || account.profileUrl !== `https://www.instagram.com/${handle}/` || account.avatar !== `/network/accounts/${handle}/avatar`
    || (account.followerCount !== null && (!Number.isSafeInteger(account.followerCount) || account.followerCount < 0))
    || (account.followersAsOf !== null && !date(account.followersAsOf))
    || (account.followerCount !== null && !date(account.followersAsOf))) return null;
  const fallback = account.avatarFallback ?? null;
  if (fallback !== null && !new RegExp(`^/assets/universe/avatar-${handle.replace(/[.]/g, '\\.')}\\.(?:jpg|jpeg|png|webp|gif|svg)$`).test(fallback)) return null;
  return { handle, name: account.name, relationship: 'owned', followerCount: account.followerCount, followersAsOf: account.followersAsOf,
    avatar: account.avatar, avatarFallback: fallback, profileUrl: account.profileUrl };
}

function projectPost(post) {
  const handle = post?.handle, code = post?.shortcode;
  if (typeof handle !== 'string' || typeof code !== 'string' || !handlePattern.test(handle) || !shortcodePattern.test(code) || post.source !== `https://www.instagram.com/p/${code}/`
    || post.image !== `/network/posts/${handle}/${code}/cover` || text(post.caption, 2000) === null || text(post.title, 100) === null
    || !Number.isSafeInteger(post.likes) || post.likes < 0 || !date(post.publishedAt)
    || (post.metricsUpdatedAt !== null && !date(post.metricsUpdatedAt))) return null;
  return { handle, shortcode: code, source: post.source, image: post.image, caption: post.caption, title: post.title,
    likes: post.likes, publishedAt: post.publishedAt, metricsUpdatedAt: post.metricsUpdatedAt };
}

export function projectNetworkSnapshot(resource, value) {
  if (!resources.has(resource) || value?.source !== 'cortex' || value.stale === true || !date(value.fetchedAt)) return null;
  const result = { source: 'cortex', stale: false, fetchedAt: value.fetchedAt };
  if (resource === 'accounts') {
    if (!Array.isArray(value.accounts) || !value.accounts.length || value.accounts.length > 1000) return null;
    const accounts = value.accounts.map(projectAccount);
    if (accounts.some(account => !account) || new Set(accounts.map(account => account.handle)).size !== accounts.length) return null;
    return { ...result, accounts };
  }
  if (!Array.isArray(value.posts) || !value.posts.length || value.posts.length > 20) return null;
  const posts = value.posts.map(projectPost), selection = value.selection;
  if (posts.some(post => !post) || new Set(posts.map(post => post.shortcode)).size !== posts.length
    || selection?.metric !== 'likes' || selection.strategy !== 'best-per-account-then-likes' || selection.poolLimit !== 20 || selection.complete !== true
    || selection.uniqueAccounts !== new Set(posts.map(post => post.handle)).size
    || !['accountsWithPromos', 'eligibleAccounts', 'uniquePromoPosts'].every(key => Number.isSafeInteger(selection[key]) && selection[key] >= 0)
    || !['bulk-posts', 'public-account-posts'].includes(selection.sourceOperation)) return null;
  return { ...result, posts, selection: { metric: 'likes', strategy: selection.strategy, poolLimit: 20,
    uniqueAccounts: selection.uniqueAccounts, accountsWithPromos: selection.accountsWithPromos, eligibleAccounts: selection.eligibleAccounts,
    uniquePromoPosts: selection.uniquePromoPosts, complete: true, sourceOperation: selection.sourceOperation } };
}

async function signature(env, values) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SENTIENTDASH_API_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify(values))));
}

async function storedRow(env, resource, fingerprint) {
  if (!env.DB?.prepare) return { row: null, unavailable: false };
  try {
    const row = await deadline(Promise.resolve().then(() => env.DB.prepare('SELECT * FROM network_snapshots WHERE resource = ? AND authorization_fingerprint = ?').bind(resource, fingerprint).first()), 800);
    return { row, unavailable: false };
  } catch { return { row: null, unavailable: true }; }
}

async function decodeRow(env, resource, fingerprint, row) {
  if (!row || row.resource !== resource || row.authorization_fingerprint !== fingerprint || row.schema_version !== 1
    || row.authorization_rejected_at || !date(row.saved_at) || !date(row.fetched_at)
    || typeof row.payload !== 'string' || row.payload.length > maximumPayload || !/^[a-f0-9]{64}$/.test(row.signature || '')) return null;
  const expected = await signature(env, [1, resource, fingerprint, row.fetched_at, row.saved_at, row.payload]);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ row.signature.charCodeAt(index);
  if (difference) return null;
  let payload;
  try { payload = JSON.parse(row.payload); } catch { return null; }
  const projected = projectNetworkSnapshot(resource, payload);
  return projected && projected.fetchedAt === row.fetched_at ? { ...projected, savedAt: row.saved_at } : null;
}

async function save(env, resource, fingerprint, payload) {
  const savedAt = new Date().toISOString(), body = JSON.stringify(payload);
  if (!env.DB?.prepare || body.length > maximumPayload) return null;
  const mac = await signature(env, [1, resource, fingerprint, payload.fetchedAt, savedAt, body]);
  const result = await deadline(Promise.resolve().then(() => env.DB.prepare(`INSERT INTO network_snapshots
    (resource, authorization_fingerprint, schema_version, payload, signature, fetched_at, saved_at, authorization_rejected_at, authorization_rejected_status)
    VALUES (?, ?, 1, ?, ?, ?, ?, NULL, NULL)
    ON CONFLICT(resource, authorization_fingerprint) DO UPDATE SET schema_version = 1, payload = excluded.payload, signature = excluded.signature,
      fetched_at = excluded.fetched_at, saved_at = excluded.saved_at, authorization_rejected_at = NULL, authorization_rejected_status = NULL
    WHERE (julianday(network_snapshots.fetched_at) IS NULL OR julianday(excluded.fetched_at) >= julianday(network_snapshots.fetched_at))
      AND (network_snapshots.authorization_rejected_at IS NULL OR julianday(network_snapshots.authorization_rejected_at) IS NULL
        OR julianday(excluded.fetched_at) > julianday(network_snapshots.authorization_rejected_at))`)
    .bind(resource, fingerprint, body, mac, payload.fetchedAt, savedAt).run()), 1500);
  return result?.meta?.changes > 0 ? savedAt : null;
}

function scheduleSave(env, resource, fingerprint, payload, requestCortex) {
  if (!env.DB?.prepare) return;
  const key = `${resourceKey(resource, fingerprint)}:${payload.fetchedAt}`;
  if (writes.has(key)) return;
  const task = save(env, resource, fingerprint, payload).catch(() => null).finally(() => { writes.delete(key); });
  writes.set(key, task);
  requestCortex?.waitUntil?.(task);
}

async function rejectAuthorization(env, fingerprint, status, requestCortex) {
  const rejectedAt = new Date().toISOString();
  denied.set(fingerprint, rejectedAt);
  if (denied.size > 32) denied.delete(denied.keys().next().value);
  for (const resource of resources) outages.delete(resourceKey(resource, fingerprint));
  requestCortex.networkCacheBypass = true;
  if (!env.DB?.prepare) return;
  // Keep a durable rejection marker even when there was no successful copy.
  // A later successful source read must be newer than this marker to replace it.
  try {
    await deadline(Promise.resolve().then(() => env.DB.prepare(`INSERT INTO network_snapshots
      (resource, authorization_fingerprint, schema_version, authorization_rejected_at, authorization_rejected_status)
      VALUES ('accounts', ?, 1, ?, ?), ('posts', ?, 1, ?, ?)
      ON CONFLICT(resource, authorization_fingerprint) DO UPDATE SET authorization_rejected_at = excluded.authorization_rejected_at,
        authorization_rejected_status = excluded.authorization_rejected_status
      WHERE network_snapshots.authorization_rejected_at IS NULL OR excluded.authorization_rejected_at >= network_snapshots.authorization_rejected_at`)
      .bind(fingerprint, rejectedAt, status, fingerprint, rejectedAt, status).run()), 1500);
  } catch { /* The current request and warm isolate still fail closed. */ }
}

export async function rejectNetworkAuthorization(env, requestCortex, status) {
  if (![401, 403].includes(status)) return;
  await rejectAuthorization(env, await authorizationFingerprint(env), status, requestCortex);
}

function transient(error) {
  if ([408, 425, 429, 500, 502, 503, 504].includes(error?.status)) return true;
  const recoverable = new Set(['source-request', 'source-json', 'source-body', 'snapshot-live-contract',
    'profile-count-contract', 'profile-handle-contract', 'tracker-contract', 'tracker-handle-contract', 'tracker-pagination',
    'listing-contract', 'listing-handle-contract', 'settings-contract', 'settings-pagination',
    'posts-page-contract', 'bulk-posts-pagination', 'public-posts-pagination']);
  return typeof error?.networkStage === 'string' && (recoverable.has(error.networkStage) || /(?:^|-)(?:timeout)$/.test(error.networkStage));
}

export async function withSavedNetwork(resource, env, requestCortex, load) {
  if (!resources.has(resource)) throw new Error('Unsupported network resource.');
  const fingerprint = await authorizationFingerprint(env), key = resourceKey(resource, fingerprint);
  const state = await storedRow(env, resource, fingerprint), row = state.row;
  if (row?.authorization_rejected_at && date(row.authorization_rejected_at)) denied.set(fingerprint, row.authorization_rejected_at);
  const rejectedAt = denied.get(fingerprint);
  if (rejectedAt || row?.authorization_rejected_at || state.unavailable) requestCortex.networkCacheBypass = true;
  const saved = await decodeRow(env, resource, fingerprint, row);
  const asFallback = () => ({ ...saved, source: 'cortex', stale: true, fallback: 'last-saved' });
  if (saved && !rejectedAt && (outages.get(key) || 0) > Date.now()) return asFallback();
  try {
    const live = await load();
    const projected = projectNetworkSnapshot(resource, live);
    if (!projected) throw Object.assign(new Error('Invalid public network response.'), { networkStage: 'snapshot-live-contract' });
    const latest = await storedRow(env, resource, fingerprint);
    const rejectionTimes = [rejectedAt, denied.get(fingerprint), latest.row?.authorization_rejected_at].filter(date);
    const currentRejection = rejectionTimes.sort((left, right) => Date.parse(right) - Date.parse(left))[0];
    // Never treat a pre-rejection edge/memory cache entry as a new grant.
    if (currentRejection && Date.parse(projected.fetchedAt) <= Date.parse(currentRejection)) throw Object.assign(new Error('Network authorization requires revalidation.'), {
      status: [401, 403].includes(latest.row?.authorization_rejected_status) ? latest.row.authorization_rejected_status
        : [401, 403].includes(row?.authorization_rejected_status) ? row.authorization_rejected_status : 403,
      networkStage: 'authorization-revalidation',
    });
    const latestSaved = await decodeRow(env, resource, fingerprint, latest.row) || saved;
    outages.delete(key);
    denied.delete(fingerprint);
    // Edge caches can return an older successful source response. Never send
    // those older figures back to a cold client when D1 already has newer ones.
    if (latestSaved && Date.parse(latestSaved.fetchedAt) > Date.parse(projected.fetchedAt)) return {
      ...latestSaved, source: 'cortex', stale: true, fallback: 'last-saved',
    };
    const alreadySaved = latestSaved && latestSaved.fetchedAt === projected.fetchedAt && JSON.stringify(projectNetworkSnapshot(resource, latestSaved)) === JSON.stringify(projected);
    if (!alreadySaved) scheduleSave(env, resource, fingerprint, projected, requestCortex);
    return { ...projected, ...(alreadySaved ? { savedAt: latestSaved.savedAt } : {}) };
  } catch (error) {
    if ([401, 403].includes(error?.status)) { await rejectAuthorization(env, fingerprint, error.status, requestCortex); throw error; }
    if (rejectedAt) throw Object.assign(new Error('Network authorization requires revalidation.'), {
      status: [401, 403].includes(row?.authorization_rejected_status) ? row.authorization_rejected_status : 403,
      networkStage: 'authorization-revalidation',
    });
    if (transient(error)) {
      // Another request may have saved newer figures while this source read
      // was failing. Prefer that copy rather than the pre-fetch database read.
      const latest = await storedRow(env, resource, fingerprint);
      if (latest.row?.authorization_rejected_at) throw Object.assign(new Error('Network authorization requires revalidation.'), {
        status: [401, 403].includes(latest.row.authorization_rejected_status) ? latest.row.authorization_rejected_status : 403,
        networkStage: 'authorization-revalidation',
      });
      const fallback = await decodeRow(env, resource, fingerprint, latest.row) || saved;
      if (fallback && !denied.has(fingerprint)) {
        outages.set(key, Date.now() + outageFor);
        if (outages.size > 64) outages.delete(outages.keys().next().value);
        return { ...fallback, source: 'cortex', stale: true, fallback: 'last-saved' };
      }
    }
    throw error;
  }
}
