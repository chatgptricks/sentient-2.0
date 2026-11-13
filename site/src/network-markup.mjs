import { escapeHtml } from './social-meta.mjs';
import { formatFollowers } from '../public/network-data.js';

export function renderAccountCards(accounts) {
  return accounts.map(account => {
    const followers = formatFollowers(account);
    const exact = account.followerSource === 'provided-reference' ? followers : account.followerCount?.toLocaleString('en-US') ?? 'Unknown';
    const title = `${exact} followers`;
    const fallback = account.avatarFallback ? ` data-avatar-fallback="${escapeHtml(account.avatarFallback)}"` : '';
    return `<a href="${escapeHtml(account.profileUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(title)}"><img src="${escapeHtml(account.avatar)}"${fallback} alt="" width="48" height="48" loading="lazy"><strong>@${escapeHtml(account.displayHandle || account.handle)}</strong><span class="v2-account-count"><b>${escapeHtml(followers || '—')}</b><small>${followers ? 'followers' : 'unavailable'}</small></span></a>`;
  }).join('');
}

// Campaign posts as native-looking Instagram cards (same look as the Growth
// page): account, image, likes, the caption's opening and the date.
const igIcons = ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', 'M20 12a8 8 0 1 1-3.1-6.3A8 8 0 0 1 20 12zm0 0v8l-3-2.2', 'M21 3 10 14M21 3l-7 18-4-7-7-4z'];
const igIcon = path => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
// Client-side renders need the site's base path (GitHub Pages serves it under
// /sentient-2.0); the favicon link carries it. Server renders are rewritten by the build.
const sitePrefix = () => typeof document === 'undefined' ? '' : (document.querySelector('link[rel="icon"]')?.getAttribute('href') || '/favicon.svg').replace(/\/favicon\.svg.*$/, '');
export function renderCampaignCards(posts, endpoint = '') {
  const base = sitePrefix();
  return posts.map(post => {
    const caption = (post.caption || post.title || post.client || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const image = post.image.startsWith('/network/') ? `${endpoint}${post.image}` : post.image;
    const likes = Number.isSafeInteger(post.likes) ? `${post.likes.toLocaleString('en-US')} likes` : '';
    const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
    const fallback = post.imageFallback ? ` data-avatar-fallback="${escapeHtml(post.imageFallback)}"` : '';
    const handle = escapeHtml(post.handle);
    return `<a class="v2-post gx-ig" href="${escapeHtml(post.source)}" target="_blank" rel="noopener noreferrer" aria-label="View campaign by @${handle}"><span class="gx-ig-top"><img src="${base}/assets/universe/avatar-${handle}.jpg" data-avatar-fallback="${base}/assets/sentient-symbol.svg" alt="" width="32" height="32" loading="lazy"><b>${handle}</b><i aria-hidden="true">•••</i></span><span class="gx-ig-media"><img src="${escapeHtml(image)}"${fallback} alt="${escapeHtml(post.alt || caption.slice(0, 80) || 'Campaign post')}" width="720" height="900" loading="lazy" decoding="async"></span><span class="gx-ig-actions">${igIcons.map(igIcon).join('')}<span class="gx-ig-save">${igIcon('M6 3h12v18l-6-4-6 4z')}</span></span>${likes ? `<span class="gx-ig-likes">${likes}</span>` : ''}<span class="gx-ig-caption"><b>${handle}</b> ${escapeHtml(caption)}</span>${date ? `<span class="gx-ig-date">${date}</span>` : ''}</a>`;
  }).join('');
}
