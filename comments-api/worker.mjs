const pages = new Set(['home', 'launch', 'growth', 'about', 'universe']);
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
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
    if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const json = (status, value) => new Response(JSON.stringify(value), { status, headers });
    if (origin && !allowed.includes(origin)) return json(403, {error:'Origin not allowed.'});
    const url = new URL(request.url);
    if (url.pathname !== '/comments') return json(404, {error:'Not found.'});
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:{...headers, 'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Max-Age':'3600'}});
    try {
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
    } catch { return json(503, {error:'Comments are temporarily unavailable. Please try again.'}); }
  }
};
