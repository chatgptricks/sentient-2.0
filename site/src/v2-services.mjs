import { escapeHtml } from './social-meta.mjs';
import { v2Campaigns } from './v2-campaigns.mjs';

// Launch case studies from the Launch Amplification deck (decks/launch-amplification/brief.py).
// X views come from each post's screenshot; LinkedIn views were reported by the
// client or their team; Magic Patterns comes from our launch report.
// Sign-up results stay anonymous and are never placed beside these cards.
const launchCases = [
  {
    client: 'Lotus AI',
    handle: 'kjdhaliwal',
    image: '/assets/v2/launch/kj.png',
    alt: 'Lotus AI founder KJ Dhaliwal’s funding announcement post on X',
    source: 'https://x.com/kjdhaliwal/status/2018731342113247533',
    category: 'FUNDING ANNOUNCEMENT',
    context: 'Funding round, February 2026',
    metric: '8.4M',
    metricLabel: 'views on X and LinkedIn',
    evidence: '7.4M views on X and 1M on LinkedIn for the founder’s announcement.',
  },
  {
    client: 'Decart',
    handle: 'DecartAI',
    image: '/assets/v2/launch/decart.png',
    alt: 'Decart’s Lucy 2.5 model launch post on X',
    source: 'https://x.com/DecartAI/status/2077801728213156044',
    category: 'MODEL LAUNCH',
    context: 'Lucy 2.5, July 2026',
    metric: '6.6M',
    metricLabel: 'views on X and LinkedIn',
    evidence: '4.8M views on X. 1.8M LinkedIn views as reported by Decart.',
  },
  {
    client: 'Magic Patterns',
    handle: 'alexdanilowicz',
    image: '/assets/v2/launch/alex.png',
    alt: 'Magic Patterns co-founder Alex Danilowicz’s MagicOS launch post on X',
    source: 'https://x.com/alexdanilowicz/status/2110030443466940671',
    category: 'PRODUCT LAUNCH',
    context: 'MagicOS, October 2026',
    metric: '1.3M',
    metricLabel: 'views on X',
    evidence: '1.33M views on X across the launch post and 72 creator quote posts, 390× the usual views of his posts.',
  },
];

// Instagram posts from Sentient's network. The label shows total views across
// each client's campaigns on the network (Standard Campaigns deck), not one post.
const byId = id => {
  const campaign = v2Campaigns.find(item => item.id === id);
  if (!campaign) throw new Error(`V2 campaign missing: ${id}`);
  return campaign;
};
const growthCases = [
  { ...byId('higgsfield-minecraft'), result: '150M+ views' },
  {
    client: 'Abacus',
    handle: 'chatgptricks',
    image: '/assets/v2/growth/DVh2jCkgHFC.jpg',
    alt: 'Abacus campaign post on @chatgptricks',
    source: 'https://www.instagram.com/p/DVh2jCkgHFC/',
    result: '50M+ views',
  },
  {
    client: 'Artisan',
    handle: 'chatgptricks',
    image: '/assets/DD6x4v4xHyn.jpg',
    alt: 'Artisan “Stop Hiring Humans” campaign post on @chatgptricks',
    source: 'https://www.instagram.com/p/DD6x4v4xHyn/',
    result: 'Stop Hiring Humans',
  },
];

function launchCard(item) {
  return `<article class="case-card compact"><a class="case-image" href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer" aria-label="View the ${escapeHtml(item.client)} launch post by @${escapeHtml(item.handle)} on X"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" width="568" height="696" loading="lazy"><span class="case-client">${escapeHtml(item.client)}</span></a><div class="case-content"><div><span class="eyebrow">${escapeHtml(item.category)}</span><h3>${escapeHtml(item.context)}</h3></div><div class="case-result"><strong>${escapeHtml(item.metric)}</strong><span>${escapeHtml(item.metricLabel)}</span></div></div><details class="case-evidence"><summary>View launch details</summary><p>${escapeHtml(item.evidence)}</p><a class="text-link" href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">Open the post on X</a></details></article>`;
}

const growthCard = item => `<a href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer" aria-label="View ${escapeHtml(item.client)} campaign post by @${escapeHtml(item.handle)}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" width="720" height="960" loading="lazy" decoding="async"><span>${escapeHtml(item.client)} <small class="v2-campaign-handle">${escapeHtml(item.result)} · @${escapeHtml(item.handle)}</small></span></a>`;

function fillRail(html, id, cards) {
  const pattern = new RegExp(`(<div\\b[^>]*\\bid="${id}"[^>]*>)<\\/div>`);
  if (!pattern.test(html)) throw new Error(`V2 campaign rail missing: ${id}`);
  return html.replace(pattern, (_match, opening) => `${opening}${cards}</div>`);
}

export function reviseV2Services(html, page) {
  if (page === 'launch') return fillRail(html, 'mobile-launch-work', launchCases.map(launchCard).join(''));
  if (page === 'growth') return fillRail(html, 'mobile-growth-work', growthCases.map(growthCard).join(''));
  return html;
}
