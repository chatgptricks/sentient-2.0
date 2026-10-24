// Published studio decks and their images live in the deck Worker (D1), so a
// published link opens on any device. Reading is public; publishing, images
// and SentientDash lookups use the deck editor password.
let config;
export const apiBase = async () => {
  config ??= fetch(new URL('../comments-config.json', import.meta.url)).then(response => response.json()).catch(() => ({}));
  const { apiUrl } = await config;
  return apiUrl ? String(apiUrl).replace(/\/+$/, '') : '';
};

export class StudioError extends Error {
  constructor(message, status, payload) { super(message); this.status = status; this.payload = payload; }
}

async function call(path, { method = 'GET', password, body, type = 'application/json', timeout = 30000 } = {}) {
  const base = await apiBase();
  if (!base) throw new StudioError('Publishing is not configured for this site.', 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method, cache:'no-store', credentials:'omit', signal:controller.signal,
      headers:{ ...(body !== undefined ? { 'Content-Type':type } : {}), ...(password ? { Authorization:`Bearer ${password}` } : {}) },
      ...(body !== undefined ? { body:type === 'application/json' ? JSON.stringify(body) : body } : {}),
    });
  } catch {
    throw new StudioError('The publishing service did not answer. Check your connection and try again.', 0);
  } finally { clearTimeout(timer); }
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new StudioError(payload?.error || 'The publishing service is unavailable right now.', response.status, payload);
  return payload;
}

export const checkPassword = password => call('/studio/auth', { method:'POST', password });
export const fetchPublished = slug => call(`/studio/decks/${encodeURIComponent(slug)}`, { timeout:15000 });
export const listPublished = password => call('/studio/decks', { password });
export const publishDeck = (password, slug, deck, revision) => call(`/studio/decks/${encodeURIComponent(slug)}`, { method:'PUT', password, body:{ deck, revision } });
export const unpublishDeck = (password, slug) => call(`/studio/decks/${encodeURIComponent(slug)}`, { method:'DELETE', password });
export const uploadImage = (password, blob) => call('/studio/assets', { method:'POST', password, body:blob, type:blob.type, timeout:60000 });
// SentientDash data through the Worker: an account's exact followers, or a
// pasted Instagram post with its cover stored as a studio image.
export const lookupAccount = (password, handle) => call('/studio/account', { method:'POST', password, body:{ handle }, timeout:90000 });
export const lookupPost = (password, url) => call('/studio/instagram-post', { method:'POST', password, body:{ url }, timeout:60000 });
