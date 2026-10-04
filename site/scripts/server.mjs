import http from 'node:http';
import { readFile, appendFile, mkdir, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build, root } from './build.mjs';
await build();
const port = Number(process.env.PORT || 4322);
const publicRoot = resolve(root, 'dist');
const dataRoot = process.env.SENTIENT_LOCAL_DATA_DIR || resolve(root, '.local');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const budgets = ['Under $20,000', '$20,000–$50,000', '$50,000–$100,000', '$100,000–$250,000', '$250,000+', 'Let’s discuss'];
const stages = ['Pre-launch', 'Early stage', 'Growth stage', 'Established'];
http.createServer(async (req, res) => {
  try {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return json(res, 403, { error: 'Local access only.' });
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (url.pathname === '/api/inquiries') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Use POST for a request.' });
      if (req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return json(res, 403, { error: 'Origin not allowed.' });
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16000) return json(res, 413, { error: 'Your request is too long.' });
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      const nativeForm = req.headers['content-type']?.startsWith('application/x-www-form-urlencoded');
      let data;
      try { data = nativeForm ? Object.fromEntries(new URLSearchParams(body)) : JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid request.' }); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return json(res, 400, { error: 'Invalid request.' });
      const fields = ['name', 'company', 'email', 'description', 'budget', 'stage', 'service', 'launchDate', 'frequency'];
      const lead = Object.fromEntries(fields.map(k => [k, typeof data[k] === 'string' ? data[k].trim() : '']));
      if (Object.values(lead).some(v => v.length > 2000)) return json(res, 400, { error: 'Please shorten your response.' });
      if (!lead.name || !lead.company || !lead.description || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) || !budgets.includes(lead.budget) || !stages.includes(lead.stage) || !['campaign', 'launch', 'growth'].includes(lead.service)) return json(res, 400, { error: 'Complete all required fields with a valid email address.' });
      if (lead.service === 'launch' && (!/^\d{4}-\d{2}-\d{2}$/.test(lead.launchDate) || !Number.isFinite(Date.parse(lead.launchDate)) || new Date(lead.launchDate).toISOString().slice(0, 10) !== lead.launchDate)) return json(res, 400, { error: 'Choose your planned launch date.' });
      if (lead.service === 'growth' && !['Weekly', 'Monthly', 'Quarterly', 'Still planning'].includes(lead.frequency)) return json(res, 400, { error: 'Choose your launch frequency.' });
      const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...lead };
      await mkdir(dataRoot, { recursive: true, mode: 0o700 });
      await appendFile(resolve(dataRoot, 'inquiries.jsonl'), `${JSON.stringify(record)}\n`, { mode: 0o600 });
      if (nativeForm) {
        res.writeHead(201, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brief saved — Sentient</title><link rel="stylesheet" href="/styles.css"><main class="shell growth-hero"><h1>Your brief is saved.</h1><p>Saved on this Mac for review. This local preview has not sent your request to Sentient.</p><a class="button" href="/">Back to Sentient</a></main></html>');
      }
      return json(res, 201, { id: record.id, message: 'Saved on this Mac for review. This local preview has not sent your request to Sentient.' });
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end('Method not allowed'); }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
    let path = resolve(publicRoot, `.${pathname}`);
    if (!path.startsWith(publicRoot + sep) && path !== publicRoot) { res.writeHead(403); return res.end('Forbidden'); }
    try { if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html'); } catch { res.writeHead(404); return res.end('Page not found'); }
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    console.error(error.message);
    json(res, 500, { error: 'We could not save your request. Please try again.' });
  }
}).listen(port, '127.0.0.1', () => console.log(`Sentient local preview: http://localhost:${port}`));
