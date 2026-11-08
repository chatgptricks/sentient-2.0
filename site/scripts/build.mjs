import { build as bundle } from 'esbuild';
import { mkdir, cp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBasePath, escapeHtml } from '../src/social-meta.mjs';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function build() {
  const basePath = normalizeBasePath(process.env.BASE_PATH || '');
  const staticHosting = process.env.STATIC_HOSTING === '1';
  const { pages: originalPages } = await import(`../src/pages.mjs?v=${Date.now()}`);
  const { createV2Pages } = await import('../src/v2-pages.mjs');
  const pages = createV2Pages(originalPages, { primary: true });
  const allPages = { ...pages };
  const localUrl = url => {
    if (!url.startsWith('/') || url.startsWith('//')) return url;
    const [, path, suffix = ''] = url.match(/^([^?#]*)(.*)$/);
    const routePath = staticHosting && path !== '/' && allPages[path] && !path.endsWith('/') ? `${path}/` : path;
    return `${basePath}${routePath}${suffix}`;
  };
  const renderHtml = html => {
    let rendered = html.replace(/\b(href|src|action)=(['"])(\/[^'"\s]*)\2/g, (_, attribute, quote, url) => `${attribute}=${quote}${localUrl(url)}${quote}`);
    // The hidden Universe can be restored with its existing data and behavior.
    rendered = rendered.replace(/("avatar"\s*:\s*")(\/assets\/[^"\s]+)(")/g, (_, before, url, after) => `${before}${localUrl(url)}${after}`);
    if (staticHosting) {
      rendered = rendered.replace('<body ', '<body data-hosting="static" ');
      rendered = rendered.replace(/(<p class="preview-note">)[\s\S]*?(<\/p>)/g, '$1Contact requests are not enabled in this preview.$2');
      rendered = rendered.replace(/<button([^>]*\bclass="[^"]*\bform-submit\b[^"]*"[^>]*)>[\s\S]*?<\/button>/g, '<button$1 disabled>Contact form coming soon</button>');
    }
    return rendered;
  };
  // Previously shared V2 URLs forward to the current site, never to a public
  // copy of V1. Keep query parameters and hash routes (including decks).
  for (const [route, html] of Object.entries(pages)) {
    const alias = route === '/' ? '/v2' : `/v2${route}`;
    const target = localUrl(route);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    allPages[alias] = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Sentient</title><link rel="canonical" href="${canonical}"><script>location.replace(${JSON.stringify(target)}+location.search+location.hash);</script><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}"></head><body data-legacy-redirect="true"><p><a href="${escapeHtml(route)}">Continue to Sentient</a></p></body></html>`;
  }
  // Only generated output is cleared. Backups and private local data live
  // outside dist and cannot enter the deployment through stale build files.
  await rm(resolve(root, 'dist'), { recursive: true, force: true });
  await mkdir(resolve(root, 'dist'), { recursive: true });
  await cp(resolve(root, 'public'), resolve(root, 'dist'), { recursive: true });
  // The preview serves files directly; remove a prior build of a hidden route.
  if (!pages['/universe']) {
    await rm(resolve(root, 'dist/universe'), { recursive: true, force: true });
    await rm(resolve(root, 'dist/js/universe.js'), { force: true });
  }
  for (const [route, html] of Object.entries(allPages)) {
    const target = resolve(root, 'dist', route === '/' ? 'index.html' : `${route.slice(1)}/index.html`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, renderHtml(html));
  }
  const entryPoints = [resolve(root, 'src/motion.mjs')];
  if (pages['/universe']) entryPoints.push(resolve(root, 'src/universe.mjs'));
  await bundle({ entryPoints, outdir: resolve(root, 'dist/js'), loader: { '.svg': 'text' }, bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2022'], logLevel: 'warning' });
  await bundle({ entryPoints: [resolve(root, '../Decks/router.mjs'), resolve(root, '../Decks/studio-frame.mjs')], outdir: resolve(root, 'dist/Decks'), nodePaths:[resolve(root, 'node_modules')], external: ['/assets/*'], loader: { '.svg': 'text' }, bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2022'], logLevel: 'warning' });
  if (basePath) {
    const rewriteAssets = async directory => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) { await rewriteAssets(path); continue; }
        const extension = extname(path);
        if (!['.css', '.js'].includes(extension)) continue;
        const original = await readFile(path, 'utf8');
        const updated = extension === '.css'
          ? original.replace(/url\(\s*(['"]?)(\/(?!\/)[^)'"\s]+)\1\s*\)/g, (_, quote, url) => `url(${quote}${localUrl(url)}${quote})`)
          : original.replace(/\bfetch\(\s*(['"])(\/(?!\/)[^'"\s]*)\1/g, (_, quote, url) => `fetch(${quote}${localUrl(url)}${quote}`);
        if (updated !== original) await writeFile(path, updated);
      }
    };
    await rewriteAssets(resolve(root, 'dist'));
  }
  await writeFile(resolve(root, 'dist/comments-config.json'), JSON.stringify({apiUrl: process.env.COMMENTS_API_URL || JSON.parse(await readFile(resolve(root, 'public/comments-config.json'), 'utf8')).apiUrl}));
  await writeFile(resolve(root, 'dist/.nojekyll'), '');
  return Object.keys(allPages);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Built: ${(await build()).join(', ')}`);
