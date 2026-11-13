import { readFile, stat, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build, root } from './build.mjs';
import { universeAccounts } from '../src/universe-data.mjs';
import { features } from '../src/site-config.mjs';
import { pages as originalPages } from '../src/pages.mjs';
import { createV2Pages } from '../src/v2-pages.mjs';
const staleRoute = resolve(root, 'dist/__stale-route-check__/index.html');
await mkdir(resolve(root, 'dist/__stale-route-check__'), { recursive: true });
await writeFile(staleRoute, 'retired route fixture');
const builtRoutes = await build();
await assert.rejects(stat(staleRoute), { code: 'ENOENT' }, 'Clean builds must not publish stale routes');
const routes = Object.keys(originalPages);
const aliases = routes.map(route => route === '/' ? '/v2' : `/v2${route}`);
assert.deepEqual(new Set(builtRoutes), new Set([...routes, ...aliases]), 'Only current pages and V2 redirects are published');
assert.equal(routes.includes('/universe'), features.universe, 'Universe route follows its feature flag');
if (!features.universe) await assert.rejects(stat(resolve(root, 'dist/universe')), { code: 'ENOENT' });
const routeHtml = new Map();
for (const route of routes) routeHtml.set(route, await readFile(resolve(root, 'dist', route === '/' ? 'index.html' : `${route.slice(1)}/index.html`), 'utf8'));
const selectedWork = html => html.match(/<section\b(?=[^>]*\bid="work")[^>]*>[\s\S]*?<\/section>/)?.[0];
const originalWork = selectedWork(originalPages['/']);
assert.ok(originalWork, 'V1 Selected work exists');
assert.equal(selectedWork(routeHtml.get('/')), originalWork, 'The promoted site preserves the complete original Selected work section');
for (const route of routes) {
  const version = routeHtml.get(route);
  assert.match(version, /data-version="v2"/);
  assert.doesNotMatch(version, /View V1|v2-comparison| · V2<\/title>/, `${route}: no public version comparison`);
  if (route !== '/') {
    assert.match(version, /href="\/comments\.css\?v=[a-f0-9]{12}"/, `${route}: review styles are loaded`);
    assert.match(version, /src="\/comments\.js\?v=[a-f0-9]{12}"/, `${route}: shared review notes are enabled`);
  }
  const canonical = version.match(/<link rel="canonical" href="([^"]+)"/)[1];
  assert.equal(canonical, originalPages[route].match(/<link rel="canonical" href="([^"]+)"/)[1], `${route}: primary canonical URL`);
  assert.match(version, new RegExp(`property="og:url" content="${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  const editableContent = version.replace(selectedWork(version) || '', '');
  assert.doesNotMatch(editableContent, /Get a (?:campaign|launch|distribution) plan/, `${route}: contact CTAs use the shared call offer`);
  assert.doesNotMatch(editableContent, /<span[^>]*>0\d \/ [A-Z]|class="(?:section-index|step-number)"/, `${route}: no decorative section numbering outside protected Selected work`);
  for (const [, href] of version.matchAll(/href="(\/[^"\s]*)"/g)) {
    assert.doesNotMatch(href, /^\/(?:v1|v2|backup)(?:[/?#]|$)/, `${route}: website navigation uses primary routes`);
  }
  const alias = route === '/' ? '/v2' : `/v2${route}`;
  const redirect = await readFile(resolve(root, `dist${alias}/index.html`), 'utf8');
  assert.match(redirect, /data-legacy-redirect="true"/);
  assert.ok(redirect.includes(`rel="canonical" href="${canonical}"`));
  const script = redirect.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const hash of ['#contact', '#/campaign-deck/2', '#/studio']) {
    let destination;
    runInNewContext(script, {location: {search: '?from=shared', hash, replace: value => { destination = value; }}});
    assert.equal(destination, `${route}?from=shared${hash}`, `${alias}: old links retain query and hash`);
  }
}
for (const html of Object.values(createV2Pages(originalPages))) {
  assert.doesNotMatch(html, /View V1|v2-comparison/, 'Internal previews cannot reintroduce public V1 links');
}
for (const hidden of ['v1', 'backup', '.local']) await assert.rejects(stat(resolve(root, 'dist', hidden)), { code: 'ENOENT' });
assert.match(routeHtml.get('/'), /src="\/Decks\/router\.js\?v=[a-f0-9]{12}"/, 'Root uses the current deck and Studio hash router, bypassing older cached bundles');
assert.doesNotMatch(routeHtml.get('/'), /src="\/app\.js"/, 'Root lets the hash router select the website runtime');
let references = 0;
for (const [route, html] of routeHtml) {
  if (!features.universe) assert.doesNotMatch(html, /href="\/universe(?:["/#?])/, `${route}: hidden Universe has no entry points`);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${route}: exactly one H1`);
  if(!route.endsWith('/universe')) assert.match(html, /method="post" action="\/api\/inquiries"/);
  for (const [, url] of html.matchAll(/(?:src|href)="([^"\s]+)"/g)) {
    if (url.startsWith('#')) assert.ok(html.includes(`id="${url.slice(1)}"`), `${route}: missing anchor ${url}`);
    if (!url.startsWith('/') || url === '/api/inquiries') continue;
    const path = url.split(/[?#]/)[0];
    if (routes.includes(path)) continue;
    assert.ok((await stat(resolve(root, 'dist', `.${path}`))).isFile(), `Missing asset ${url}`);
    references++;
  }
}
const growthText = routeHtml.get('/growth-campaigns').split('<div class="growth-content">')[1].split('<section class="contact-wrap')[0].replace(/<[^>]*>/g, ' ').trim().split(/\s+/);
// Service pages carry the deck pillars but stay well short of a deck.
assert.ok(growthText.length < 1100, `Growth body is ${growthText.length} words`);
assert.match(routeHtml.get('/growth-campaigns'), /@artificialntellligence/, '/growth-campaigns: campaign examples include another verified owned account');
for (const source of ['x.com/kjdhaliwal/status/2018731342113247533', 'x.com/DecartAI/status/2077801728213156044', 'x.com/alexdanilowicz/status/2110030443466940671']) {
  assert.ok(routeHtml.get('/viral-launch-campaigns').includes(`https://${source}`), `/viral-launch-campaigns: launch case links to its source post (${source})`);
}
// Louis's feedback, 2026-11-13: no pricing on the launch page, Book a call everywhere, one follower figure.
assert.doesNotMatch(routeHtml.get('/viral-launch-campaigns').split('<main')[1].split('<section class="contact-wrap')[0], /\$\d+(,\d{3}|K\b)/, '/viral-launch-campaigns: no package prices on the page');
for (const route of ['/viral-launch-campaigns', '/growth-campaigns']) assert.ok(routeHtml.get(route).includes('https://calendly.com/sentientagency'), `${route}: Book a call links to the calendar`);
for (const route of ['/', '/growth-campaigns']) assert.doesNotMatch(routeHtml.get(route), /25M\+<\/(span|strong)>/, `${route}: one follower figure (30M+) across the site`);
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
  for (const route of builtRoutes) assert.equal((await fetch(origin+route)).status, 200);
  for (const route of ['/v1/', '/backup/', '/.local/backups/']) assert.equal((await fetch(origin+route)).status, 404);
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
