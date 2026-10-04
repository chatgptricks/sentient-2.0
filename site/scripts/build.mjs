import { build as bundle } from 'esbuild';
import { mkdir, cp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function build() {
  const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');
  if (basePath && (!/^\/[A-Za-z0-9._/-]+$/.test(basePath) || basePath.split('/').some(part => part === '.' || part === '..'))) throw new Error('BASE_PATH must be an absolute URL path without dot segments.');
  const staticHosting = process.env.STATIC_HOSTING === '1';
  const { pages } = await import(`../src/pages.mjs?v=${Date.now()}`);
  const localUrl = url => {
    if (!url.startsWith('/') || url.startsWith('//')) return url;
    const [, path, suffix = ''] = url.match(/^([^?#]*)(.*)$/);
    const routePath = staticHosting && path !== '/' && pages[path] ? `${path}/` : path;
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
  await mkdir(resolve(root, 'dist'), { recursive: true });
  await cp(resolve(root, 'public'), resolve(root, 'dist'), { recursive: true });
  // The preview serves files directly; remove a prior build of a hidden route.
  if (!pages['/universe']) {
    await rm(resolve(root, 'dist/universe'), { recursive: true, force: true });
    await rm(resolve(root, 'dist/js/universe.js'), { force: true });
  }
  for (const [route, html] of Object.entries(pages)) {
    const target = resolve(root, 'dist', route === '/' ? 'index.html' : `${route.slice(1)}/index.html`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, renderHtml(html));
  }
  const entryPoints = [resolve(root, 'src/motion.mjs')];
  if (pages['/universe']) entryPoints.push(resolve(root, 'src/universe.mjs'));
  await bundle({ entryPoints, outdir: resolve(root, 'dist/js'), loader: { '.svg': 'text' }, bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2022'], logLevel: 'warning' });
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
  await writeFile(resolve(root, 'dist/.nojekyll'), '');
  return Object.keys(pages);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Built: ${(await build()).join(', ')}`);
