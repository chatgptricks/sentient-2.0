export const DEFAULT_PUBLIC_ORIGIN = 'https://chatgptricks.github.io';
export const DEFAULT_PUBLIC_BASE_PATH = '/sentient-2.0';

export function normalizeBasePath(value = '') {
  const basePath = String(value).replace(/\/+$/, '');
  if (basePath && (!/^\/[A-Za-z0-9._/-]+$/.test(basePath) || basePath.split('/').some(part => part === '.' || part === '..'))) {
    throw new Error('BASE_PATH must be an absolute URL path without dot segments.');
  }
  return basePath;
}

export const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function renderSocialMetadata({ title, description, route = '/', origin = DEFAULT_PUBLIC_ORIGIN, basePath = DEFAULT_PUBLIC_BASE_PATH }) {
  const siteOrigin = new URL(origin);
  if (!['https:', 'http:'].includes(siteOrigin.protocol) || siteOrigin.username || siteOrigin.password || siteOrigin.pathname !== '/' || siteOrigin.search || siteOrigin.hash) {
    throw new Error('PUBLIC_ORIGIN must be an HTTP or HTTPS origin without credentials, a path, query, or fragment.');
  }
  const publicBase = normalizeBasePath(basePath);
  const absoluteUrl = path => `${siteOrigin.origin}${publicBase}${path}`;
  const canonical = absoluteUrl(`${normalizeBasePath(route)}/`);
  const image = absoluteUrl('/assets/social-preview.jpg');
  const imageAlt = 'Sentient — We make tech companies go viral. An agency with its own audience.';
  const meta = (attribute, key, value) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
  return [
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'Sentient'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:url', canonical),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/jpeg'),
    meta('property', 'og:image:width', 1200),
    meta('property', 'og:image:height', 630),
    meta('property', 'og:image:alt', imageAlt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', imageAlt),
  ].join('');
}
