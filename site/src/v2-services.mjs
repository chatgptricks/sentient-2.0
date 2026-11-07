import { escapeHtml } from './social-meta.mjs';
import { v2Campaigns } from './v2-campaigns.mjs';

const byId = id => {
  const campaign = v2Campaigns.find(item => item.id === id);
  if (!campaign) throw new Error(`V2 campaign missing: ${id}`);
  return campaign;
};

const launchCampaigns = ['1x-neo', 'higgsfield-minecraft', 'decart-realtime', 'meta-glasses'].map(byId);
const growthCampaigns = ['1x-neo', 'higgsfield-minecraft', 'decart-realtime'].map(byId);
const compactImpressions = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1});

function launchCard(campaign) {
  const hasMetric = Number.isFinite(campaign.impressions);
  const result = hasMetric
    ? `<div class="case-result"><strong>${compactImpressions.format(campaign.impressions)}</strong><span>post impressions</span></div>`
    : '';
  const evidence = hasMetric
    ? `${campaign.impressions.toLocaleString('en-US')} impressions · @${escapeHtml(campaign.handle)} · ${escapeHtml(campaign.date)}. Historical post export; not unique reach or a campaign-wide result.`
    : `@${escapeHtml(campaign.handle)} · ${escapeHtml(campaign.date)}. Original campaign post.`;
  return `<article class="case-card compact"><a class="case-image" href="${escapeHtml(campaign.source)}" target="_blank" rel="noopener noreferrer" aria-label="View original ${escapeHtml(campaign.client)} post by @${escapeHtml(campaign.handle)}"><img src="${escapeHtml(campaign.image)}" alt="${escapeHtml(campaign.alt)}" width="720" height="960" loading="lazy"><span class="case-client">${escapeHtml(campaign.client)}</span></a><div class="case-content"><div><span class="eyebrow">${escapeHtml(campaign.category)}</span><h3>${escapeHtml(campaign.context)}</h3></div>${result}</div><details class="case-evidence"><summary>View post details</summary><p>${evidence}</p><a class="text-link" href="${escapeHtml(campaign.source)}" target="_blank" rel="noopener noreferrer">Open original post</a></details></article>`;
}

const growthCard = campaign => `<a href="${escapeHtml(campaign.source)}" target="_blank" rel="noopener noreferrer" aria-label="View original ${escapeHtml(campaign.client)} post by @${escapeHtml(campaign.handle)}"><img src="${escapeHtml(campaign.image)}" alt="${escapeHtml(campaign.alt)}" width="720" height="960" loading="lazy" decoding="async"><span>${escapeHtml(campaign.client)} <small class="v2-campaign-handle">@${escapeHtml(campaign.handle)}</small></span></a>`;

function replaceRail(html, id, cards) {
  // Keep the original rail element, classes and controls. The next control
  // block is the boundary, so nested card divs cannot truncate the replacement.
  const pattern = new RegExp(`(<div\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?<\\/div>(?=\\s*<div\\b[^>]*\\bdata-carousel-controls="${id}")`);
  if (!pattern.test(html)) throw new Error(`V2 campaign rail missing: ${id}`);
  return html.replace(pattern, (_match, opening) => `${opening}${cards}</div>`);
}

export function reviseV2Services(html, page) {
  if (page === 'launch') {
    return replaceRail(html, 'mobile-launch-work', launchCampaigns.map(launchCard).join(''))
      .replace('Individual post results from historical records. This selection does not represent complete launch case studies.', 'Original campaign posts; historical impressions are shown only where available. This selection does not represent complete launch case studies.');
  }
  if (page === 'growth') return replaceRail(html, 'mobile-growth-work', growthCampaigns.map(growthCard).join(''));
  return html;
}
