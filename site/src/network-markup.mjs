import { escapeHtml } from './social-meta.mjs';
import { formatFollowers } from '../public/network-data.js';
import { accountSnapshotDate } from './universe-page.mjs';

export function renderAccountCards(accounts) {
  return accounts.map(account => {
    const followers = formatFollowers(account);
    const exact = account.followerSource === 'provided-reference' ? followers : account.followerCount?.toLocaleString('en-US') ?? 'Unknown';
    const title = `${exact} followers${account.followersAsOf ? ` · ${account.followersAsOf}` : ''}`;
    const fallback = account.avatarFallback ? ` data-avatar-fallback="${escapeHtml(account.avatarFallback)}"` : '';
    const date = accountSnapshotDate(account.followersAsOf);
    return `<a href="${escapeHtml(account.profileUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(title)}"><img src="${escapeHtml(account.avatar)}"${fallback} alt="" width="48" height="48" loading="lazy"><strong>@${escapeHtml(account.displayHandle || account.handle)}</strong><span class="v2-account-count"><b>${escapeHtml(followers || '—')}</b><small>${followers ? 'followers' : 'unavailable'}</small></span>${date ? `<time class="v2-account-date" datetime="${escapeHtml(account.followersAsOf)}">Updated ${escapeHtml(date)}</time>` : ''}</a>`;
  }).join('');
}

export function renderCampaignCards(posts, endpoint = '') {
  return posts.map(post => {
    const title = post.client || post.title || post.caption?.split('\n').find(Boolean)?.slice(0, 75) || 'Campaign highlight';
    const image = post.image.startsWith('/network/') ? `${endpoint}${post.image}` : post.image;
    const likes = Number.isSafeInteger(post.likes) ? ` · ${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(post.likes)} likes` : '';
    const metricDate = accountSnapshotDate(post.metricsUpdatedAt);
    const observation = metricDate ? ` title="Likes last recorded ${escapeHtml(metricDate)}"` : '';
    const fallback = post.imageFallback ? ` data-avatar-fallback="${escapeHtml(post.imageFallback)}"` : '';
    return `<a class="v2-post" href="${escapeHtml(post.source)}" target="_blank" rel="noopener noreferrer" aria-label="View campaign by @${escapeHtml(post.handle)}"${observation}><div class="v2-post-image"><img src="${escapeHtml(image)}"${fallback} alt="${escapeHtml(post.alt || title)}" width="720" height="960" loading="lazy" decoding="async"><span><span aria-hidden="true">↗</span></span></div><div class="v2-post-caption"><strong>${escapeHtml(title)}</strong><span>@${escapeHtml(post.handle)}${likes}</span></div></a>`;
  }).join('');
}
