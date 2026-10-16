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
  // Links without an account: SentientDash finds it within the key's scope.
  const response = await sentientDash(env, `/api/v1/posts/${post.shortcode}`);
  if (response.status === 404) return null;
  if (!response.ok) throw Object.assign(new Error('upstream'), { status: response.status });
  const { data } = await response.json();
  return data;
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

async function handleAccount(request, env, json, originAllowed) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const rejected = await guardDeckWrite(request, env, json, originAllowed);
  if (rejected) return rejected;
  const password = /^Bearer (.+)$/i.exec(request.headers.get('Authorization') || '')?.[1];
  if (!(await authorizedDeckEditor(password, env.DECK_EDITOR_PASSWORD_SHA256))) return json(401, { error: 'Incorrect editor password.' });
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json(415, { error: 'Use JSON.' });
  const parsed = await readJson(request, 1024);
  if (parsed.error) return json(parsed.status, { error: parsed.error });
  const handle = String(parsed.data?.handle ?? '').trim().replace(/^@/, '').toLowerCase();
  if (!handlePattern.test(handle)) return json(400, { error: 'Use an Instagram handle.' });
  if (!env.SENTIENTDASH_API_KEY) return json(503, { error: 'SentientDash is not connected yet.' });
  try {
    const response = await sentientDash(env, `/api/v1/accounts/${handle}`);
    if (response.status === 404) return json(404, { error: `SentientDash has no data for @${handle} with this API key.` });
    if (response.status === 429) return json(429, { error: 'SentientDash is busy. Try again in a minute.' });
    if (!response.ok) return json(502, { error: 'SentientDash is unavailable right now. Try again.' });
    const { data, data_updated_at: updated } = await response.json();
    if (!Number.isSafeInteger(data?.followers)) return json(404, { error: `SentientDash has no follower count for @${handle}.` });
    return json(200, { handle, followers: data.followers, capturedAt: updated?.profile ?? null });
  } catch {
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

// Deck studio: decks built from the campaign deck's templates and elements,
// published so their link opens anywhere. Reading a published deck and its
// images is public; publishing uses the deck editor password.
const studioDeckLimit = 512 * 1024;
const studioAssetLimit = 1400 * 1024;
const studioAssetTypes = new Set(['image/webp', 'image/png', 'image/jpeg', 'image/gif']);
const studioSlugPattern = /^[a-z0-9][a-z0-9-]{1,63}$/;
const reservedSlugs = new Set([deckSlug, 'studio']);

export function validateStudioDeck(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || !Number.isSafeInteger(data.revision) || data.revision < 0 || data.revision >= Number.MAX_SAFE_INTEGER) return null;
  const { deck } = data;
  if (!deck || typeof deck !== 'object' || Array.isArray(deck)
    || typeof deck.title !== 'string' || !deck.title.trim() || deck.title.length > 200
    || !Array.isArray(deck.slides) || !deck.slides.length || deck.slides.length > 80) return null;
  // Every value is plain data: bounded strings, never inline images or script URLs.
  const plain = (value, depth) => {
    if (depth > 8) return false;
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return true;
    if (typeof value === 'string') return value.length <= 4000 && !/^\s*(data|javascript|vbscript):/i.test(value);
    if (Array.isArray(value)) return value.length <= 200 && value.every(item => plain(item, depth + 1));
    if (typeof value !== 'object') return false;
    return Object.entries(value).every(([key, item]) => /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key) && plain(item, depth + 1));
  };
  const slidesValid = deck.slides.every(slide => slide && typeof slide === 'object' && !Array.isArray(slide)
    && typeof slide.layout === 'string' && Array.isArray(slide.blocks) && slide.blocks.length <= 20
    && slide.blocks.every(block => block && typeof block.type === 'string'));
  if (!slidesValid || !plain(deck.slides, 0)) return null;
  const clean = { title: deck.title.trim(), slides: deck.slides };
  if (new TextEncoder().encode(JSON.stringify(clean)).byteLength > studioDeckLimit) return null;
  return { deck: clean, revision: data.revision };
}

// Origin, rate limit and password, then the JSON body: the common gate of every studio write.
async function studioWrite(request, env, json, originAllowed, limit = 4096) {
  if (!originAllowed) return { response: json(403, { error: 'Origin required.' }) };
  const rate = env.STUDIO_RATE ?? env.DECK_EDIT_RATE;
  if (rate && !(await rate.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' })).success) return { response: json(429, { error: 'Too many requests. Please wait a minute.' }) };
  if (!/^[0-9a-f]{64}$/i.test(env.DECK_EDITOR_PASSWORD_SHA256 || '')) return { response: json(503, { error: 'Publishing is temporarily unavailable.' }) };
  const password = /^Bearer (.+)$/i.exec(request.headers.get('Authorization') || '')?.[1];
  if (!(await authorizedDeckEditor(password, env.DECK_EDITOR_PASSWORD_SHA256))) return { response: json(401, { error: 'Incorrect editor password.' }) };
  if (limit === 0) return {};
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return { response: json(415, { error: 'Use JSON.' }) };
  const parsed = await readJson(request, limit);
  if (parsed.error) return { response: json(parsed.status, { error: parsed.error }) };
  return { data: parsed.data };
}

const studioDeck = row => ({ slug: row.slug, title: row.title, deck: JSON.parse(row.deck), revision: row.revision, publishedAt: row.published_at, updatedAt: row.updated_at });

async function handleStudioDecks(request, env, json, originAllowed) {
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' });
  const gate = await studioWrite(request, env, json, originAllowed, 0);
  if (gate.response) return gate.response;
  const { results } = await env.DB.prepare('SELECT slug, title, deck, revision, published_at, updated_at FROM studio_decks ORDER BY updated_at DESC').all();
  return json(200, { decks: results.map(row => { const { deck, ...rest } = studioDeck(row); return { ...rest, slides: deck.slides.length }; }) });
}

async function handleStudioDeck(request, env, json, originAllowed, slug) {
  if (!studioSlugPattern.test(slug) || reservedSlugs.has(slug)) return json(404, { error: 'Not found.' });
  const read = () => env.DB.prepare('SELECT slug, title, deck, revision, published_at, updated_at FROM studio_decks WHERE slug = ?').bind(slug).first();
  if (request.method === 'GET') {
    const row = await read();
    return row ? json(200, studioDeck(row)) : json(404, { error: 'This deck is not published.' });
  }
  if (request.method === 'DELETE') {
    const gate = await studioWrite(request, env, json, originAllowed, 0);
    if (gate.response) return gate.response;
    await env.DB.prepare('DELETE FROM studio_decks WHERE slug = ?').bind(slug).run();
    return json(200, { slug, deleted: true });
  }
  if (request.method !== 'PUT') return json(405, { error: 'Method not allowed.' });
  const gate = await studioWrite(request, env, json, originAllowed, studioDeckLimit + 4096);
  if (gate.response) return gate.response;
  const edit = validateStudioDeck(gate.data);
  if (!edit) return json(400, { error: 'This deck cannot be published: check it has a title, at most 80 slides, and that every image is uploaded.' });
  const now = new Date().toISOString();
  const serialized = JSON.stringify(edit.deck);
  // As with the campaign deck, the revision in the write itself prevents a
  // stale copy from overwriting a newer publication.
  const saved = edit.revision === 0
    ? await env.DB.prepare('INSERT INTO studio_decks (slug, title, deck, revision, published_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(slug) DO NOTHING').bind(slug, edit.deck.title, serialized, now, now).run()
    : await env.DB.prepare('UPDATE studio_decks SET title = ?, deck = ?, revision = revision + 1, updated_at = ? WHERE slug = ? AND revision = ?').bind(edit.deck.title, serialized, now, slug, edit.revision).run();
  if (saved.meta.changes !== 1) {
    const current = await read();
    return json(409, { error: 'This deck was published from another copy since you last published it.', ...(current ? studioDeck(current) : { revision: 0 }) });
  }
  return json(200, studioDeck(await read()));
}

const base64 = bytes => { let text = ''; for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(text); };
const fromBase64 = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));
const assetUrl = (request, id) => `${new URL(request.url).origin}/studio/assets/${id}`;

async function storeAsset(env, bytes, type) {
  const id = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT OR IGNORE INTO studio_assets (id, type, data, created_at) VALUES (?, ?, ?, ?)').bind(id, type, base64(bytes), new Date().toISOString()).run();
  return id;
}

async function readBytes(request, limit) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); return 'too-large'; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function handleStudioUpload(request, env, json, originAllowed) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const gate = await studioWrite(request, env, json, originAllowed, 0);
  if (gate.response) return gate.response;
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!studioAssetTypes.has(type)) return json(415, { error: 'Upload a WebP, PNG, JPEG or GIF image.' });
  const bytes = await readBytes(request, studioAssetLimit);
  if (bytes === 'too-large') return json(413, { error: 'Images must be 1.4 MB or smaller.' });
  if (!bytes?.length) return json(400, { error: 'The image is empty.' });
  const id = await storeAsset(env, bytes, type);
  return json(201, { id, url: assetUrl(request, id) });
}

async function handleStudioAsset(request, env, json, id) {
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' });
  if (!/^[0-9a-f]{64}$/.test(id)) return json(404, { error: 'Not found.' });
  const row = await env.DB.prepare('SELECT type, data FROM studio_assets WHERE id = ?').bind(id).first();
  if (!row) return json(404, { error: 'Not found.' });
  // Content-addressed, so the bytes behind an id never change.
  return new Response(fromBase64(row.data), { headers: { 'Content-Type': row.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' } });
}

async function handleStudioPost(request, env, json, originAllowed) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const gate = await studioWrite(request, env, json, originAllowed);
  if (gate.response) return gate.response;
  const post = parseInstagramPost(gate.data?.url);
  if (!post) return json(400, { error: 'Paste an Instagram post or reel link.' });
  if (!env.SENTIENTDASH_API_KEY) return json(503, { error: 'SentientDash is not connected yet.' });
  try {
    const found = await findPost(env, post);
    if (!found) return json(404, { error: 'SentientDash has no data for this post. Check it belongs to a Sentient account the API key can read.' });
    // The cover is copied into the studio's images, so the published deck never depends on SentientDash.
    let cover = null;
    const upstream = await sentientDash(env, `/api/v1/accounts/${found.account}/posts/${found.shortcode}/cover`);
    const type = (upstream.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (upstream.ok && studioAssetTypes.has(type)) {
      const bytes = new Uint8Array(await upstream.arrayBuffer());
      if (bytes.length && bytes.length <= studioAssetLimit) cover = assetUrl(request, await storeAsset(env, bytes, type));
    }
    return json(200, {
      account: found.account, shortcode: found.shortcode, permalink: found.permalink, publishedAt: found.published_at,
      likes: found.likes ?? null, comments: found.comments ?? null, caption: found.caption ?? null, cover,
    });
  } catch (error) {
    if (error.status === 429) return json(429, { error: 'SentientDash is busy. Try again in a minute.' });
    return json(502, { error: 'SentientDash is unavailable right now. Try again.' });
  }
}

async function handleStudio(request, env, json, originAllowed, path) {
  if (path === '/studio/auth') {
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
    const gate = await studioWrite(request, env, json, originAllowed, 0);
    return gate.response ?? json(200, { ok: true });
  }
  if (path === '/studio/decks') return handleStudioDecks(request, env, json, originAllowed);
  if (path === '/studio/assets') return handleStudioUpload(request, env, json, originAllowed);
  if (path === '/studio/account') return handleAccount(request, env, json, originAllowed);
  if (path === '/studio/instagram-post') return handleStudioPost(request, env, json, originAllowed);
  const deck = /^\/studio\/decks\/([^/]+)$/.exec(path);
  if (deck) return handleStudioDeck(request, env, json, originAllowed, deck[1]);
  const asset = /^\/studio\/assets\/([^/]+)$/.exec(path);
  if (asset) return handleStudioAsset(request, env, json, asset[1]);
  return json(404, { error: 'Not found.' });
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
    const accountRoute = url.pathname === `/decks/${deckSlug}/account`;
    const coverRoute = new RegExp(`^/decks/${deckSlug}/covers/([^/]+)/([^/]+)$`).exec(url.pathname);
    if (url.pathname.startsWith('/studio/')) {
      if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:{...headers, 'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization', 'Access-Control-Max-Age':'3600'}});
      try { return await handleStudio(request, env, json, Boolean(origin && allowed.includes(origin)), url.pathname); }
      catch { return json(503, {error:'Publishing is temporarily unavailable. Please try again.'}); }
    }
    if (coverRoute) {
      try { return await handleCover(request, env, json, coverRoute[1], coverRoute[2], ctx); }
      catch { return json(503, {error:'Cover unavailable.'}); }
    }
    if (url.pathname !== '/comments' && !deckRoute && !deckAuthRoute && !postRoute && !accountRoute) return json(404, {error:'Not found.'});
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:{...headers, 'Access-Control-Allow-Methods':deckAuthRoute || postRoute || accountRoute ? 'POST, OPTIONS' : deckRoute ? 'GET, PUT, OPTIONS' : 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':deckRoute || postRoute || accountRoute ? 'Content-Type, Authorization' : 'Content-Type', 'Access-Control-Max-Age':'3600'}});
    try {
      if (deckAuthRoute) return await handleDeckAuth(request, env, json, Boolean(origin && allowed.includes(origin)));
      if (postRoute) return await handleInstagramPost(request, env, json, Boolean(origin && allowed.includes(origin)));
      if (accountRoute) return await handleAccount(request, env, json, Boolean(origin && allowed.includes(origin)));
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
    } catch { return json(503, {error:deckRoute || deckAuthRoute || postRoute || accountRoute ? 'Deck content is temporarily unavailable. Please try again.' : 'Comments are temporarily unavailable. Please try again.'}); }
  }
};
