// Ownership is read from Cortex settings when the existing website key grants
// that scope. This verified registry is only the ownership filter when the key
// grants public accounts but not settings; it never supplies profile metrics.
// Registry verified against the Sentient Dashboard group on 2026-11-08.
const verifiedOwnedHandles = new Set([
  'aigleeson', 'ainterestingupdate', 'artificialcoding', 'artificialmente.ia',
  'artificialntellligence', 'chatgptips', 'chatgptricks', 'costarica', 'em3rging',
  'evolving', 'ingenia.ai', 'ivanelgrande', 'millonariosgigantes',
  'passionateincome', 'planet.ai_', 'robotica', 'sergioprompts',
  'stoicreflections', 'tech', 'tecnologia', 'traselveloreal', 'trends', 'woopleai',
]);
const localAvatarPaths = new Map([
  'aigleeson', 'ainterestingupdate', 'artificialmente.ia', 'artificialntellligence',
  'chatgptips', 'chatgptricks', 'costarica', 'em3rging', 'ivanelgrande',
  'planet.ai_', 'sergioprompts', 'stoicreflections', 'tecnologia', 'traselveloreal', 'trends',
].map(handle => [handle, `/assets/universe/avatar-${handle}.jpg`]));
for (const [handle, extension] of [
  ['artificialcoding','jpg'], ['evolving','jpg'], ['passionateincome','jpg'],
  ['ingenia.ai','jpg'], ['millonariosgigantes','jpg'], ['robotica','webp'],
  ['tech','jpg'], ['woopleai','jpg'],
]) localAvatarPaths.set(handle, `/assets/universe/avatar-${handle}.${extension}`);
const handlePattern = /^[a-z0-9_.]{1,30}$/;
const freshFor = 5 * 60 * 1000;
const memory = new Map();
const pending = new Map();
const trackerScopeGaps = new Map();

function unavailable(stage = 'unknown', details = {}) {
  return Object.assign(new Error('Network profiles are temporarily unavailable.'), { networkStage:stage, ...details });
}

const validHandle = value => typeof value === 'string' && handlePattern.test(value) ? value : null;
const publicName = (value, handle) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : `@${handle}`;
const sourceDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now() ? value : null;

async function cacheKey(env, kind) {
  if (!env.SENTIENTDASH_API_KEY) throw unavailable('configuration-key-missing');
  const identity = `${env.SENTIENTDASH_API_URL || 'https://cortex-api-db2e.onrender.com'}\n${env.SENTIENTDASH_API_KEY}`;
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity)))].map(value => value.toString(16).padStart(2, '0')).join('');
  return `https://sentient-network-cache.invalid/v3/${kind}/${hash}`;
}

async function deadline(task, milliseconds, stage) {
  let timer;
  try {
    return await Promise.race([task,new Promise((_,reject) => { timer = setTimeout(() => reject(unavailable(stage)),milliseconds); })]);
  } finally { clearTimeout(timer); }
}

function retain(requestCortex, task) {
  requestCortex?.waitUntil?.(task.catch(() => {}));
}

async function cached(env, kind, load, requestCortex) {
  const key = await cacheKey(env, kind);
  const isFresh = entry => entry && Array.isArray(entry.accounts) && entry.accounts.length > 0 && entry.accounts.length <= 1000
    && entry.accounts.every(account => validHandle(account?.handle))
    && (kind !== 'tracker' || Array.isArray(entry.publicHandles) && entry.publicHandles.every(validHandle))
    && Number.isFinite(Date.parse(entry.fetchedAt)) && Date.now() - Date.parse(entry.fetchedAt) >= 0 && Date.now() - Date.parse(entry.fetchedAt) < freshFor;
  const existing = memory.get(key);
  if (isFresh(existing)) return structuredClone(existing);
  memory.delete(key);
  const lifetime = kind === 'profiles' ? 28000 : 16000;
  const existingTask = pending.get(key);
  if (existingTask && Date.now() - existingTask.startedAt < lifetime) {
    retain(requestCortex,existingTask.task);
    return structuredClone(await deadline(existingTask.task,Math.max(1,lifetime-(Date.now()-existingTask.startedAt)),`pending-${kind}-timeout`));
  }
  pending.delete(key);
  const task = (async () => {
    const edge = globalThis.caches?.default;
    try {
      const response = await deadline(Promise.resolve().then(() => edge?.match(key)),1500,'cache-read-timeout');
      if (response?.ok) {
        const entry = await deadline(response.json(),1500,'cache-body-timeout');
        if (isFresh(entry)) { memory.set(key, entry); return entry; }
      }
    } catch { /* A cache failure does not prevent a source read. */ }
    const loaded = await load();
    // Reusing a bulk snapshot must not reset its source retrieval clock.
    const entry = { ...loaded, fetchedAt:loaded.fetchedAt || new Date().toISOString() };
    memory.set(key, entry);
    // Keep only a bounded number of source configurations in a warm isolate.
    if (memory.size > 16) memory.delete(memory.keys().next().value);
    const write = deadline(Promise.resolve().then(() => edge?.put(key, Response.json(entry, { headers: { 'Cache-Control': 'public, max-age=300' } }))),1500,'cache-write-timeout').catch(() => {});
    if (requestCortex?.waitUntil) retain(requestCortex,write); else await write;
    return entry;
  })();
  const record = { task, startedAt:Date.now() };
  pending.set(key,record);
  retain(requestCortex,task);
  try { return structuredClone(await deadline(task,lifetime,`pending-${kind}-timeout`)); }
  finally { if (pending.get(key) === record) pending.delete(key); }
}

async function readCortex(requestCortex, path, signal) {
  const sourcePath = path.split('?')[0];
  let response;
  try { response = await requestCortex(path, { signal }); }
  catch (error) { throw unavailable(signal.aborted ? 'source-timeout' : 'source-request', { sourcePath }); }
  if (!response.ok) throw unavailable('source-status', { status:response.status, sourcePath });
  let body;
  try { body = await response.json(); }
  catch { throw unavailable(signal.aborted ? 'source-body-timeout' : 'source-json', { status:response.status, sourcePath }); }
  if (!body || typeof body !== 'object') throw unavailable('source-body', { status:response.status, sourcePath });
  return body;
}

async function ownership(env, requestCortex) {
  return cached(env, 'ownership', async () => {
    const signal = AbortSignal.timeout(12000);
    const listing = await readCortex(requestCortex, '/api/v1/accounts', signal);
    if (!Array.isArray(listing.data) || listing.data.length > 1000) throw unavailable('listing-contract');
    const scoped = new Map();
    for (const profile of listing.data) {
      const handle = validHandle(profile?.handle);
      if (!handle || scoped.has(handle)) throw unavailable('listing-handle-contract');
      scoped.set(handle, { handle, name: publicName(profile.public_name, handle) });
    }
    let owned;
    try {
      owned = new Set();
      let offset = 0;
      for (let count = 0; count < 10; count++) {
        const page = await readCortex(requestCortex, `/api/v1/settings/accounts?limit=100&offset=${offset}`, signal);
        if (!Array.isArray(page.data) || page.data.length > 100 || typeof page.pagination?.has_more !== 'boolean') throw unavailable('settings-contract');
        for (const row of page.data) {
          const handle = validHandle(row?.handle);
          if (handle && scoped.has(handle) && row.group_name === 'sentient' && row.is_active === true) owned.add(handle);
        }
        if (!page.pagination?.has_more) break;
        const next = page.pagination.next_offset;
        if (!Number.isSafeInteger(next) || next <= offset || count === 9) throw unavailable('settings-pagination');
        offset = next;
      }
    } catch (error) {
      if (error.status !== 403) throw error;
      owned = verifiedOwnedHandles;
    }
    const accounts = [...scoped.values()].filter(account => owned.has(account.handle));
    if (!accounts.length) throw unavailable('ownership-empty', { scopedCount:scoped.size });
    return { accounts };
  },requestCortex);
}

function projectAccount(handle, name, followers, observedAt) {
  if (followers !== null && (!Number.isSafeInteger(followers) || followers < 0)) throw unavailable('profile-count-contract', { sourcePath:`/api/v1/accounts/${handle}` });
  const followersAsOf = sourceDate(observedAt);
  return {
    handle,
    name:publicName(name, handle),
    relationship:'owned',
    followerCount:followersAsOf ? followers : null,
    followersAsOf,
    avatar:`/network/accounts/${handle}/avatar`,
    avatarFallback:localAvatarPaths.get(handle) || null,
    profileUrl:`https://www.instagram.com/${handle}/`,
  };
}

async function trackerAccounts(env, requestCortex) {
  const scopeKey = await cacheKey(env, 'tracker-permission');
  if ((trackerScopeGaps.get(scopeKey) || 0) > Date.now()) return null;
  try {
    return await cached(env, 'tracker', async () => {
      const signal = AbortSignal.timeout(12000);
      const accounts = [];
      const publicHandles = [];
      const seen = new Set();
      let offset = 0;
      for (let count = 0; count < 10; count++) {
        const body = await readCortex(requestCortex, `/api/v1/tracker/accounts?limit=100&offset=${offset}`, signal);
        if (!Array.isArray(body.data) || body.data.length > 100 || typeof body.pagination?.has_more !== 'boolean') throw unavailable('tracker-contract');
        for (const row of body.data) {
          const handle = validHandle(row?.handle);
          if (!handle || seen.has(handle)) throw unavailable('tracker-handle-contract');
          seen.add(handle);
          // Tracker is itself restricted to the existing key's selected active
          // accounts; only the explicit Sentient group reaches the public feed.
          if (row.group === 'sentient') {
            accounts.push(projectAccount(handle, row.full_name, row.followers, row.captured_at));
            if (row.private === false) publicHandles.push(handle);
          }
        }
        if (!body.pagination.has_more) break;
        const next = body.pagination.next_offset;
        if (!Number.isSafeInteger(next) || next <= offset || count === 9) throw unavailable('tracker-pagination');
        offset = next;
      }
      if (!accounts.length) throw unavailable('tracker-ownership-empty', { scopedCount:seen.size });
      return { source:'cortex', stale:false, accounts, publicHandles };
    },requestCortex);
  } catch (error) {
    // A missing Tracker scope may use the independently authorized public
    // accounts area. Other failures remain failures, never broader reads.
    if (error.status === 403) {
      trackerScopeGaps.set(scopeKey, Date.now() + freshFor);
      if (trackerScopeGaps.size > 16) trackerScopeGaps.delete(trackerScopeGaps.keys().next().value);
      return null;
    }
    throw error;
  }
}

// Reused by promotional-post reads so they share the same scoped ownership
// discovery and cannot query a caller-supplied or competitor handle.
export async function getOwnedAccountHandles(env, requestCortex) {
  const tracker = await trackerAccounts(env, requestCortex);
  if (tracker) return tracker.accounts.map(account => account.handle);
  return (await ownership(env, requestCortex)).accounts.map(account => account.handle);
}

// Research's general post projection is not public-only. Its caller must use
// this stricter selection; unknown/private Tracker profiles cannot enter it.
export async function getPublicOwnedAccountHandles(env, requestCortex) {
  const tracker = await trackerAccounts(env, requestCortex);
  if (!tracker) throw unavailable('tracker-public-ownership-unavailable', { status:403 });
  return [...tracker.publicHandles];
}

export async function getOwnedAccounts(env, requestCortex) {
  return cached(env, 'profiles', async () => {
    const tracker = await trackerAccounts(env, requestCortex);
    if (tracker) {
      tracker.accounts.sort((left, right) => (right.followerCount ?? -1) - (left.followerCount ?? -1) || left.handle.localeCompare(right.handle));
      return { source:tracker.source, stale:tracker.stale, fetchedAt:tracker.fetchedAt, accounts:tracker.accounts };
    }
    const { accounts: roster } = await ownership(env, requestCortex);
    const signal = AbortSignal.timeout(12000);
    const accounts = new Array(roster.length);
    let cursor = 0;
    let failed = false;
    // Four readers bound pressure on Cortex and respect its per-key quota.
    await Promise.all(Array.from({ length: Math.min(4, roster.length) }, async () => {
      while (!failed && cursor < roster.length) {
        const index = cursor++;
        const item = roster[index];
        let body;
        try { body = await readCortex(requestCortex, `/api/v1/accounts/${item.handle}`, signal); }
        catch (error) { failed = true; throw error; }
        const profile = body.data;
        if (profile?.handle !== item.handle) { failed = true; throw unavailable('profile-handle-contract', { sourcePath:`/api/v1/accounts/${item.handle}` }); }
        // Do not attach an undated count or claim that retrieval was observation.
        try { accounts[index] = projectAccount(item.handle, profile.public_name, profile.followers, body.data_updated_at?.profile); }
        catch (error) { failed = true; throw error; }
      }
    }));
    accounts.sort((left, right) => (right.followerCount ?? -1) - (left.followerCount ?? -1) || left.handle.localeCompare(right.handle));
    return { source: 'cortex', stale: false, accounts };
  },requestCortex);
}
