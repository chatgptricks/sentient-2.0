const handlePattern = /^[a-z0-9_.]{1,30}$/;
let connection;

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
  if (!response.ok) throw new Error('Network data unavailable');
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

export async function loadNetworkAccounts(fallback) {
  try {
    const payload = await fetchNetworkData('accounts');
    if (!validateAccounts(payload)) throw new Error('Invalid network account data');
    const siteBase = new URL('.', document.querySelector('link[rel="sentient-api"]').href);
    payload.accounts = payload.accounts.map(account => ({
      ...account,
      avatar: account.avatar.startsWith('/network/') ? `${payload.endpoint}${account.avatar}` : new URL(account.avatar.slice(1), siteBase).href,
      ...(account.avatarFallback ? { avatarFallback: new URL(account.avatarFallback.slice(1), siteBase).href } : {}),
    }));
    return payload;
  } catch {
    return { source: 'fallback', accounts: fallback };
  }
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
