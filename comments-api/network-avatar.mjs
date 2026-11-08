import { getOwnedAccounts } from './network-accounts.mjs';

const handlePattern = /^[a-z0-9_.]{1,30}$/;
const imageTypes = new Set(['image/jpeg','image/png','image/webp','image/gif']);
const imageLimit = 2 * 1024 * 1024;
const freshFor = 5 * 60 * 1000;

async function imageKey(env, handle) {
  const identity = `${env.SENTIENTDASH_API_URL || 'https://cortex-api-db2e.onrender.com'}\n${env.SENTIENTDASH_API_KEY}`;
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity)))].map(value => value.toString(16).padStart(2,'0')).join('');
  return `https://sentient-network-cache.invalid/v1/avatars/${hash}/${handle}`;
}

async function imageBytes(response) {
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
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return bytes;
}

export async function handleNetworkAccountAvatar(request, env, json, requestCortex, ctx, handle) {
  if (request.method !== 'GET') return json(405,{error:'Method not allowed.'});
  if (new URL(request.url).search || !handlePattern.test(handle || '')) return json(404,{error:'Not found.'});
  try {
    // Check scoped membership even when an image is already cached. This
    // public endpoint cannot turn the website key into an arbitrary reader.
    const snapshot = await getOwnedAccounts(env,requestCortex);
    if (!snapshot.accounts.some(account => account.handle === handle)) return json(404,{error:'Not found.'});
    const cache = globalThis.caches?.default;
    const key = await imageKey(env,handle);
    try {
      const cached = await cache?.match(key);
      const date = Date.parse(cached?.headers.get('X-Network-Image-Fetched-At'));
      const age = Date.now() - date;
      if (cached?.ok && Number.isFinite(date) && age >= 0 && age < freshFor) return cached;
    } catch { /* A cache failure permits a fresh bounded media read. */ }
    const signal = AbortSignal.timeout(12000);
    let upstream = await requestCortex(`/api/dashboard/avatar/${handle}`,{publicMedia:true,redirect:'manual',signal});
    if ([301,302,303,307,308].includes(upstream.status)) {
      const url = new URL(upstream.headers.get('Location'));
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !/(^|\.)r2\.cloudflarestorage\.com$/.test(url.hostname)) throw new Error('Unsupported media redirect');
      // Object storage never receives the Cortex website credential.
      upstream = await fetch(url.href,{redirect:'manual',signal});
    }
    const type = (upstream.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!upstream.ok || !imageTypes.has(type)) return json(upstream.status === 404 ? 404 : 502,{error:'Profile image unavailable.'});
    const bytes = await imageBytes(upstream);
    if (!bytes) return json(502,{error:'Profile image unavailable.'});
    const response = new Response(bytes,{headers:{
      'Content-Type':type,
      'Cache-Control':'public, max-age=300',
      'X-Content-Type-Options':'nosniff',
      'X-Network-Image-Fetched-At':new Date().toISOString(),
      'Access-Control-Allow-Origin':'*',
      'Cross-Origin-Resource-Policy':'cross-origin',
    }});
    if (cache) {
      const store = Promise.resolve().then(() => cache.put(key,response.clone())).catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(store); else await store;
    }
    return response;
  } catch { return json(503,{error:'Profile image unavailable.'}); }
}
