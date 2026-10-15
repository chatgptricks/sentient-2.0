const pages = new Set(['home', 'launch', 'growth', 'about', 'universe']);
const deckSlug = 'campaign-deck';
const deckBodyLimit = 128 * 1024;

export function validateDeckEdit(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || !Number.isSafeInteger(data.revision) || data.revision < 0 || data.revision >= Number.MAX_SAFE_INTEGER
    || !data.fields || typeof data.fields !== 'object' || Array.isArray(data.fields)) return null;
  const entries = Object.entries(data.fields);
  if (entries.length > 1000) return null;
  const fields = Object.create(null);
  for (const [key, value] of entries) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key)
      || typeof value !== 'string' || value.length > 1000) return null;
    fields[key] = value;
  }
  if (new TextEncoder().encode(JSON.stringify(fields)).byteLength > deckBodyLimit) return null;
  return { fields, revision: data.revision };
}

async function readJson(request, limit) {
  const reader = request.body?.getReader();
  if (!reader) return { error: 'Invalid JSON.', status: 400 };
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return { error: 'Request is too large.', status: 413 }; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return { data: JSON.parse(new TextDecoder().decode(bytes)) }; }
  catch { return { error: 'Invalid JSON.', status: 400 }; }
}

async function authorizedDeckEditor(password, passwordHash) {
  if (typeof password !== 'string' || !password || password.length > 256) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  const candidate = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  let difference = 0;
  const expected = passwordHash.toLowerCase();
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ candidate.charCodeAt(index);
  return difference === 0;
}

const publicDeck = row => ({
  deck: deckSlug,
  fields: row ? JSON.parse(row.fields) : {},
  revision: row?.revision ?? 0,
  updatedAt: row?.updated_at ?? null,
});

async function guardDeckWrite(request, env, json, originAllowed) {
  if (!originAllowed) return json(403, { error: 'Origin required.' });
  if (env.DECK_EDIT_RATE && !(await env.DECK_EDIT_RATE.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' })).success) {
    return json(429, { error: 'Too many edit attempts. Please wait a minute.' });
  }
  if (!/^[0-9a-f]{64}$/i.test(env.DECK_EDITOR_PASSWORD_SHA256 || '')) return json(503, { error: 'Deck editing is temporarily unavailable.' });
  return null;
}

async function handleDeckAuth(request, env, json, originAllowed) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const rejected = await guardDeckWrite(request, env, json, originAllowed);
  if (rejected) return rejected;
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json(415, { error: 'Use JSON.' });
  const parsed = await readJson(request, 2048);
  if (parsed.error) return json(parsed.status, { error: parsed.error });
  if (!(await authorizedDeckEditor(parsed.data?.password, env.DECK_EDITOR_PASSWORD_SHA256))) return json(401, { error: 'Incorrect editor password.' });
  return json(200, { ok: true });
}

async function handleDeck(request, env, json, originAllowed) {
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT fields, revision, updated_at FROM deck_edits WHERE slug = ?').bind(deckSlug).first();
    return json(200, publicDeck(row));
  }
  if (request.method !== 'PUT') return json(405, { error: 'Method not allowed.' });
  const rejected = await guardDeckWrite(request, env, json, originAllowed);
  if (rejected) return rejected;
  const password = /^Bearer (.+)$/i.exec(request.headers.get('Authorization') || '')?.[1];
  if (!(await authorizedDeckEditor(password, env.DECK_EDITOR_PASSWORD_SHA256))) return json(401, { error: 'Incorrect editor password.' });
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json(415, { error: 'Use JSON.' });
  const parsed = await readJson(request, deckBodyLimit);
  if (parsed.error) return json(parsed.status, { error: parsed.error });
  const edit = validateDeckEdit(parsed.data);
  if (!edit) return json(400, { error: 'Use a revision and up to 1,000 text fields of at most 1,000 characters each.' });
  const updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(edit.fields);
  // Both statements compare the version in the write itself. A concurrent
  // editor cannot overwrite an accepted save using an earlier revision.
  const saved = edit.revision === 0
    ? await env.DB.prepare('INSERT INTO deck_edits (slug, fields, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(slug) DO NOTHING').bind(deckSlug, serialized, updatedAt).run()
    : await env.DB.prepare('UPDATE deck_edits SET fields = ?, revision = revision + 1, updated_at = ? WHERE slug = ? AND revision = ?').bind(serialized, updatedAt, deckSlug, edit.revision).run();
  if (saved.meta.changes !== 1) {
    const current = await env.DB.prepare('SELECT fields, revision, updated_at FROM deck_edits WHERE slug = ?').bind(deckSlug).first();
    return json(409, { error: 'The deck changed since you opened the editor. Reload its latest content before saving.', ...publicDeck(current) });
  }
  return json(200, { deck: deckSlug, fields: edit.fields, revision: edit.revision + 1, updatedAt });
}

// Promotional-post lookups. The SentientDash website key stays in this Worker
// (secret SENTIENTDASH_API_KEY); the deck only ever sees the public result.
const sentientDashUrl = env => (env.SENTIENTDASH_API_URL || 'https://cortex-api-db2e.onrender.com').replace(/\/+$/, '');
const handlePattern = /^[a-z0-9_.]{1,30}$/;
const shortcodePattern = /^[A-Za-z0-9_-]{1,64}$/;

export function parseInstagramPost(value) {
  let url;
  try { url = new URL(String(value ?? '').trim()); } catch { return null; }
  if (url.protocol !== 'https:' || !/^(www\.)?instagram\.com$/i.test(url.hostname)) return null;
  const match = /^\/(?:([A-Za-z0-9_.]{1,30})\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{1,64})\/?$/.exec(url.pathname);
  if (!match) return null;
  return { account: match[1]?.toLowerCase() ?? null, shortcode: match[2] };
}

async function sentientDash(env, path) {
  return fetch(`${sentientDashUrl(env)}${path}`, { headers: { Authorization: `Bearer ${env.SENTIENTDASH_API_KEY}`, Accept: 'application/json' }, redirect: 'follow' });
}

async function findPost(env, post) {
  const lookup = async handle => {
    const response = await sentientDash(env, `/api/v1/accounts/${handle}/posts/${post.shortcode}`);
    if (response.status === 404) return null;
    if (!response.ok) throw Object.assign(new Error('upstream'), { status: response.status });
    const { data } = await response.json();
    return { account: handle, ...data };
  };
  if (post.account) return lookup(post.account);
  // Links without an account: check each account the key can read.
  const response = await sentientDash(env, '/api/v1/accounts');
  if (!response.ok) throw Object.assign(new Error('upstream'), { status: response.status });
  const { data } = await response.json();
  for (const { handle } of data ?? []) {
    if (!handlePattern.test(handle)) continue;
    const found = await lookup(handle);
    if (found) return found;
  }
  return null;
}

async function handleInstagramPost(request, env, json, originAllowed) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const rejected = await guardDeckWrite(request, env, json, originAllowed);
  if (rejected) return rejected;
  const password = /^Bearer (.+)$/i.exec(request.headers.get('Authorization') || '')?.[1];
  if (!(await authorizedDeckEditor(password, env.DECK_EDITOR_PASSWORD_SHA256))) return json(401, { error: 'Incorrect editor password.' });
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json(415, { error: 'Use JSON.' });
  const parsed = await readJson(request, 4096);
  if (parsed.error) return json(parsed.status, { error: parsed.error });
  const post = parseInstagramPost(parsed.data?.url);
  if (!post) return json(400, { error: 'Paste an Instagram post or reel link.' });
  if (!env.SENTIENTDASH_API_KEY) return json(503, { error: 'SentientDash is not connected yet.' });
  try {
    const found = await findPost(env, post);
    if (!found) return json(404, { error: 'SentientDash has no data for this post. Check it belongs to a Sentient account the API key can read.' });
    return json(200, {
      account: found.account,
      shortcode: found.shortcode,
      permalink: found.permalink,
      publishedAt: found.published_at,
      likes: found.likes ?? null,
      comments: found.comments ?? null,
      caption: found.caption ?? null,
      isPromo: found.is_promo ?? null,
      metricsUpdatedAt: found.metrics_updated_at ?? null,
      cover: `/decks/${deckSlug}/covers/${found.account}/${found.shortcode}`,
    });
  } catch (error) {
    if (error.status === 429) return json(429, { error: 'SentientDash is busy. Try again in a minute.' });
    return json(502, { error: 'SentientDash is unavailable right now. Try again.' });
  }
}

// Covers are public because the deck is public, but only for posts the saved
// deck actually shows, so the key cannot be used to browse other posts.
async function handleCover(request, env, json, account, shortcode, ctx) {
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' });
  if (!handlePattern.test(account) || !shortcodePattern.test(shortcode)) return json(404, { error: 'Not found.' });
  const cache = globalThis.caches?.default;
  const cached = await cache?.match(request);
  if (cached) return cached;
  const row = await env.DB.prepare('SELECT fields FROM deck_edits WHERE slug = ?').bind(deckSlug).first();
  const fields = row ? JSON.parse(row.fields) : {};
  const source = `${account}/${shortcode}`;
  if (!Object.entries(fields).some(([key, value]) => key.endsWith('-source') && value === source)) return json(404, { error: 'Not found.' });
  if (!env.SENTIENTDASH_API_KEY) return json(503, { error: 'SentientDash is not connected yet.' });
  const upstream = await sentientDash(env, `/api/v1/accounts/${account}/posts/${shortcode}/cover`);
  const type = upstream.headers.get('Content-Type') || '';
  if (!upstream.ok || !type.startsWith('image/')) return json(upstream.status === 404 ? 404 : 502, { error: 'Cover unavailable.' });
  const response = new Response(upstream.body, { status: 200, headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
  if (cache) ctx?.waitUntil?.(cache.put(request, response.clone()));
  return response;
}

export function validateComment(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { id, page, anchor } = data;
  const author = typeof data.author === 'string' ? data.author.trim() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(id || '') || !pages.has(page) || !author || author.length > 80 || !message || message.length > 2000) return null;
  if (!anchor || typeof anchor.selector !== 'string' || anchor.selector.length > 1000 || typeof anchor.quote !== 'string' || anchor.quote.length > 200) return null;
  if (!['x', 'y', 'pageY'].every(k => typeof anchor[k] === 'number' && Number.isFinite(anchor[k]) && anchor[k] >= 0 && anchor[k] <= 1)) return null;
  return { id, page, author, message, anchor };
}
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
    if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const json = (status, value) => new Response(JSON.stringify(value), { status, headers });
    if (origin && !allowed.includes(origin)) return json(403, {error:'Origin not allowed.'});
    const url = new URL(request.url);
    const deckRoute = url.pathname === `/decks/${deckSlug}`;
    const deckAuthRoute = url.pathname === `/decks/${deckSlug}/auth`;
    const postRoute = url.pathname === `/decks/${deckSlug}/instagram-post`;
    const coverRoute = new RegExp(`^/decks/${deckSlug}/covers/([^/]+)/([^/]+)$`).exec(url.pathname);
    if (coverRoute) {
      try { return await handleCover(request, env, json, coverRoute[1], coverRoute[2], ctx); }
      catch { return json(503, {error:'Cover unavailable.'}); }
    }
    if (url.pathname !== '/comments' && !deckRoute && !deckAuthRoute && !postRoute) return json(404, {error:'Not found.'});
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:{...headers, 'Access-Control-Allow-Methods':deckAuthRoute || postRoute ? 'POST, OPTIONS' : deckRoute ? 'GET, PUT, OPTIONS' : 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':deckRoute || postRoute ? 'Content-Type, Authorization' : 'Content-Type', 'Access-Control-Max-Age':'3600'}});
    try {
      if (deckAuthRoute) return await handleDeckAuth(request, env, json, Boolean(origin && allowed.includes(origin)));
      if (postRoute) return await handleInstagramPost(request, env, json, Boolean(origin && allowed.includes(origin)));
      if (deckRoute) return await handleDeck(request, env, json, Boolean(origin && allowed.includes(origin)));
      if (request.method === 'GET') {
        const page = url.searchParams.get('page');
        if (!pages.has(page)) return json(400, {error:'Unknown page.'});
        const {results} = await env.DB.prepare('SELECT * FROM comments WHERE page = ? ORDER BY created_at, id').bind(page).all();
        return json(200, {comments:results.map(row => ({id:row.id, page:row.page, author:row.author, message:row.message, anchor:JSON.parse(row.anchor), createdAt:row.created_at}))});
      }
      if (request.method !== 'POST') return json(405, {error:'Method not allowed.'});
      if (!origin || !allowed.includes(origin)) return json(403, {error:'Origin required.'});
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json(415, {error:'Use JSON.'});
      if (env.COMMENT_RATE && !(await env.COMMENT_RATE.limit({key:request.headers.get('CF-Connecting-IP') || 'unknown'})).success) return json(429, {error:'Too many notes. Please wait a minute.'});
      const reader = request.body?.getReader();
      if (!reader) return json(400, {error:'Invalid note.'});
      let size = 0; const chunks = [];
      while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 16000) { await reader.cancel(); return json(413,{error:'Note is too long.'}); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
      let data; try {data = JSON.parse(new TextDecoder().decode(bytes));} catch {return json(400,{error:'Invalid JSON.'});}
      const comment = validateComment(data);
      if (!comment) return json(400, {error:'Please enter your name and a suggestion of up to 2,000 characters.'});
      const createdAt = new Date().toISOString();
      // A stable client ID makes retries safe after an interrupted response.
      await env.DB.prepare('INSERT OR IGNORE INTO comments (id,page,author,message,anchor,created_at) VALUES (?,?,?,?,?,?)').bind(comment.id, comment.page, comment.author, comment.message, JSON.stringify(comment.anchor), createdAt).run();
      const row = await env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(comment.id).first();
      return json(201, {comment:{id:row.id,page:row.page,author:row.author,message:row.message,anchor:JSON.parse(row.anchor),createdAt:row.created_at}});
    } catch { return json(503, {error:deckRoute || deckAuthRoute || postRoute ? 'Deck content is temporarily unavailable. Please try again.' : 'Comments are temporarily unavailable. Please try again.'}); }
  }
};
