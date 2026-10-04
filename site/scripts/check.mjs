import { readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { build, root } from './build.mjs';
import { universeAccounts } from '../src/universe-data.mjs';
import { features } from '../src/site-config.mjs';
const routes = await build();
assert.equal(routes.includes('/universe'), features.universe, 'Universe route follows its feature flag');
if (!features.universe) await assert.rejects(stat(resolve(root, 'dist/universe')), { code: 'ENOENT' });
const routeHtml = new Map();
for (const route of routes) routeHtml.set(route, await readFile(resolve(root, 'dist', route === '/' ? 'index.html' : `${route.slice(1)}/index.html`), 'utf8'));
let references = 0;
for (const [route, html] of routeHtml) {
  if (!features.universe) assert.doesNotMatch(html, /href="\/universe(?:["/#?])/, `${route}: hidden Universe has no entry points`);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${route}: exactly one H1`);
  if(route !== '/universe') assert.match(html, /method="post" action="\/api\/inquiries"/);
  for (const [, url] of html.matchAll(/(?:src|href)="([^"\s]+)"/g)) {
    if (url.startsWith('#')) assert.ok(html.includes(`id="${url.slice(1)}"`), `${route}: missing anchor ${url}`);
    if (!url.startsWith('/') || url === '/api/inquiries') continue;
    if (routes.includes(url.split('#')[0])) continue;
    assert.ok((await stat(resolve(root, 'dist', `.${url}`))).isFile(), `Missing asset ${url}`);
    references++;
  }
}
const growthText = routeHtml.get('/growth-campaigns').split('<div class="growth-content">')[1].split('<section class="contact-wrap')[0].replace(/<[^>]*>/g, ' ').trim().split(/\s+/);
assert.ok(growthText.length < 150, `Growth body is ${growthText.length} words`);
assert.equal(universeAccounts.length,31);
assert.equal(new Set(universeAccounts.map(a=>a.handle)).size,31,'Unique Instagram worlds');
assert.equal(universeAccounts.filter(a=>a.relationship==='owned').length,26);
assert.equal(universeAccounts.filter(a=>a.relationship==='partner').length,5);
for(const account of universeAccounts){
  assert.equal(account.profileUrl,`https://www.instagram.com/${account.handle}/`);
  assert.ok((await stat(resolve(root,'dist',`.${account.avatar}`))).isFile());
  if(Number.isFinite(account.followerCount)) assert.match(account.followersAsOf,/^\d{4}-\d{2}-\d{2}$/,'Follower metrics require a snapshot date');
}
const dataDir = await mkdtemp(join(tmpdir(), 'sentient-check-'));
const testPort = 14322;
const server = spawn(process.execPath, ['scripts/server.mjs'], { cwd: root, env: {...process.env, PORT:String(testPort), SENTIENT_LOCAL_DATA_DIR:dataDir}, stdio:['ignore','pipe','pipe'] });
let output='';
server.stdout.on('data', b=>output+=b);
server.stderr.on('data', b=>output+=b);
const origin = `http://localhost:${testPort}`;
try {
  await new Promise((ok, fail)=> {
    const timer=setTimeout(()=>fail(new Error(`Server did not start: ${output}`)),8000);
    server.stdout.on('data', b=> {if(b.toString().includes('Sentient local preview')) {clearTimeout(timer);ok();}});
    server.on('exit', code=> {clearTimeout(timer);fail(new Error(`Server exit ${code}: ${output}`));});
  });
  for (const route of routes) assert.equal((await fetch(origin+route)).status, 200);
  if (!features.universe) {
    for (const route of ['/universe', '/universe/', '/universe/index.html']) assert.equal((await fetch(origin+route)).status, 404);
  }
  assert.equal((await fetch(origin+'/missing')).status,404);
  assert.equal((await fetch(origin+'/.local/inquiries.jsonl')).status,404);
  assert.equal((await fetch(origin+'/api/inquiries')).status,405);
  const lead={name:'Local QA – José', company:'Example test', email:'test@example.com', description:'Synthetic local test: café, 🚀.', budget:'$20,000–$50,000',stage:'Early stage',service:'campaign'};
  const send=(body, extra={})=>fetch(origin+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...extra},body:JSON.stringify(body)});
  assert.equal((await send({})).status,400);
  assert.equal((await send({...lead,email:'broken'})).status,400);
  assert.equal((await send({...lead,budget:'invalid'})).status,400);
  assert.equal((await send(lead,{Origin:'https://example.com'})).status,403);
  assert.equal((await send({...lead,service:'launch',launchDate:'2026-02-31'})).status,400);
  assert.equal((await send({...lead,service:'growth'})).status,400);
  assert.equal((await send({...lead,description:'x'.repeat(17000)})).status,413);
  for (const value of [lead,{...lead,service:'launch',launchDate:'2026-11-03'},{...lead,service:'growth',frequency:'Monthly'}]) {
    const response=await send(value);
    assert.equal(response.status,201);
    assert.match((await response.json()).message,/has not sent/);
  }
  const native=await fetch(origin+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:origin},body:new URLSearchParams(lead)});
  assert.equal(native.status,201);
  assert.match(await native.text(),/Your brief is saved/);
  const stored=(await readFile(join(dataDir,'inquiries.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(stored.length,4);
  assert.equal(stored[0].name,lead.name);
  assert.equal(stored[0].description,lead.description);
  assert.equal(stored[1].service,'launch');
  assert.equal(stored[2].frequency,'Monthly');
  console.log(`PASS: ${routes.length} routes, ${references} asset references, 31 unique Instagram accounts, ${growthText.length}-word growth body, form validation, local saves, native fallback, private storage and origin checks.`);
} finally {
  server.kill();
  await new Promise(resolve=>server.once('close',resolve));
  await rm(dataDir,{recursive:true,force:true});
}
