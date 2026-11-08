const handlePattern = /^[a-z0-9_.]{1,30}$/;
const snapshotVersion = 1;
const snapshotPrefix = 'sentient-network:last-good:';
let connection;

function snapshotKey(resource) {
  const config = document.querySelector('link[rel="sentient-api"]')?.href;
  return config ? `${snapshotPrefix}${snapshotVersion}:${config}:${resource}` : null;
}

function validEndpoint(value) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash
      && (url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch { return false; }
}

function readSnapshot(resource, validate, endpoint) {
  try {
    const key = snapshotKey(resource);
    const raw = key && globalThis.localStorage?.getItem(key);
    if (!raw || raw.length > 2 * 1024 * 1024) return null;
    const record = JSON.parse(raw);
    const payload = record.payload;
    if (record.version !== snapshotVersion || !Number.isFinite(Date.parse(record.savedAt))
      || !Number.isFinite(Date.parse(payload?.fetchedAt)) || !validEndpoint(payload?.endpoint)
      || endpoint && payload.endpoint !== endpoint || !validate(payload)) return null;
    return { ...payload, stale:true, fallback:'last-saved', savedAt:record.savedAt };
  } catch { return null; }
}

function saveSnapshot(resource, payload, validate) {
  try {
    if (!Number.isFinite(Date.parse(payload.fetchedAt)) || !validEndpoint(payload.endpoint)) return;
    const key = snapshotKey(resource);
    if (!key) return;
    const previous = readSnapshot(resource, validate, payload.endpoint);
    if (previous && Date.parse(previous.fetchedAt) > Date.parse(payload.fetchedAt)) return;
    const savedAt = payload.savedAt || new Date().toISOString();
    globalThis.localStorage?.setItem(key, JSON.stringify({ version:snapshotVersion, savedAt, payload }));
  } catch { /* Blocked or full browser storage must not stop live data. */ }
}

async function loadSnapshot(resource, validate, fallback, onSaved) {
  const previous = readSnapshot(resource, validate);
  if (previous) onSaved?.(previous);
  let endpoint;
  try {
    endpoint = await networkEndpoint();
    const payload = await fetchNetworkData(resource);
    if (!validate(payload)) throw new Error('Invalid network data');
    // A delayed response or an older server backup must not replace a newer
    // successful snapshot already saved by another page or tab.
    const newer = readSnapshot(resource, validate, endpoint);
    if (newer && Date.parse(newer.fetchedAt) > Date.parse(payload.fetchedAt)) return newer;
    saveSnapshot(resource, payload, validate);
    return payload;
  } catch (error) {
    if ([401,403].includes(error.status)) {
      try { globalThis.localStorage?.removeItem(snapshotKey(resource)); } catch {}
      return { source:'fallback', [resource]:fallback };
    }
    return readSnapshot(resource, validate, endpoint) || { source:'fallback', [resource]:fallback };
  }
}

export function formatFollowers(account) {
  if (account.followerLabel) return account.followerLabel;
  return Number.isSafeInteger(account.followerCount) && account.followerCount >= 0
    ? Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: account.followerCount >= 1e6 ? 2 : 0 }).format(account.followerCount)
    : '';
}

export function installAvatarFallbacks() {
  document.addEventListener('error', event => {
    const image = event.target;
    if (image?.tagName !== 'IMG' || !image.dataset.avatarFallback) return;
    const fallback = image.dataset.avatarFallback;
    delete image.dataset.avatarFallback;
    image.src = fallback;
  }, true);
}

export async function networkEndpoint() {
  if (!connection) connection = (async () => {
    const configUrl = document.querySelector('link[rel="sentient-api"]')?.href;
    if (!configUrl) throw new Error('No network connection configured');
    const response = await fetch(configUrl, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Network configuration unavailable');
    const { apiUrl } = await response.json();
    const url = new URL(apiUrl);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Invalid network connection');
    return url.href.replace(/\/$/, '');
  })().catch(error => { connection = null; throw error; });
  return connection;
}

export async function fetchNetworkData(resource) {
  const endpoint = await networkEndpoint();
  const response = await fetch(`${endpoint}/network/${resource}`, { signal: AbortSignal.timeout(18000) });
  if (!response.ok) {
    let status = response.status;
    try {
      const error = await response.json();
      if ([401,403].includes(error.sourceStatus)) status = error.sourceStatus;
    } catch {}
    throw Object.assign(new Error('Network data unavailable'), { status });
  }
  return { ...(await response.json()), endpoint };
}

export function validateAccounts(payload) {
  if (payload?.source !== 'cortex' || !Array.isArray(payload.accounts) || !payload.accounts.length || payload.accounts.length > 1000) return false;
  const handles = new Set();
  return payload.accounts.every(account => {
    if (!handlePattern.test(account.handle) || handles.has(account.handle) || account.relationship !== 'owned') return false;
    handles.add(account.handle);
    if (account.profileUrl !== `https://www.instagram.com/${account.handle}/`) return false;
    if (account.followerCount !== null && (!Number.isSafeInteger(account.followerCount) || account.followerCount < 0)) return false;
    if (account.followersAsOf !== null && !Number.isFinite(Date.parse(account.followersAsOf))) return false;
    return typeof account.name === 'string' && typeof account.avatar === 'string'
      && (account.avatar === `/network/accounts/${account.handle}/avatar` || /^\/assets\//.test(account.avatar))
      && (account.avatarFallback == null || /^\/assets\//.test(account.avatarFallback));
  });
}

function resolveAccountImages(payload) {
  if (payload.source === 'cortex') {
    const siteBase = new URL('.', document.querySelector('link[rel="sentient-api"]').href);
    return { ...payload, accounts:payload.accounts.map(account => ({
      ...account,
      avatar: account.avatar.startsWith('/network/') ? `${payload.endpoint}${account.avatar}` : new URL(account.avatar.slice(1), siteBase).href,
      ...(account.avatarFallback ? { avatarFallback: new URL(account.avatarFallback.slice(1), siteBase).href } : {}),
    })) };
  }
  return payload;
}

export async function loadNetworkAccounts(fallback, { onSaved } = {}) {
  return resolveAccountImages(await loadSnapshot('accounts', validateAccounts, fallback,
    onSaved ? payload => onSaved(resolveAccountImages(payload)) : undefined));
}

export async function loadNetworkPosts(fallback, { onSaved } = {}) {
  return loadSnapshot('posts', validatePosts, fallback, onSaved);
}

// Shuffle accounts first, then select one campaign from each account. This
// keeps a heavily represented account from filling several visible slots.
export function selectCampaignPosts(posts, count = 5, random = Math.random) {
  const unique = new Map();
  for (const post of posts) if (!unique.has(post.shortcode)) unique.set(post.shortcode, post);
  const groups = new Map();
  for (const post of unique.values()) {
    if (!groups.has(post.handle)) groups.set(post.handle, []);
    groups.get(post.handle).push(post);
  }
  const accounts = [...groups.values()];
  for (let index = accounts.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [accounts[index], accounts[target]] = [accounts[target], accounts[index]];
  }
  return accounts.slice(0, count).map(group => group[Math.floor(random() * group.length)]);
}

export function validatePosts(payload) {
  if (payload?.source !== 'cortex' || !Array.isArray(payload.posts) || !payload.posts.length || payload.posts.length > 20) return false;
  const shortcodes = new Set();
  return payload.posts.every(post => {
    if (!handlePattern.test(post.handle) || !/^[A-Za-z0-9_-]{1,64}$/.test(post.shortcode) || shortcodes.has(post.shortcode)) return false;
    shortcodes.add(post.shortcode);
    let url;
    try { url = new URL(post.source); } catch { return false; }
    if (url.protocol !== 'https:' || !/^(www\.)?instagram\.com$/.test(url.hostname)) return false;
    if (post.likes !== null && (!Number.isSafeInteger(post.likes) || post.likes < 0)) return false;
    return post.image === `/network/posts/${post.handle}/${post.shortcode}/cover` && typeof post.caption === 'string';
  });
}
