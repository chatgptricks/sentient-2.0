// Service landing pages, rebuilt from the Launch Amplification and Standard
// Campaigns decks (~/Sentient/decks). Every figure here is sourced in those
// decks or their briefs; see SOURCES next to each block. Structure follows
// Louis Gleeson's website feedback (2026-11-13): proof first, little explanation.
import { escapeHtml } from './social-meta.mjs';
import { serviceVisual } from './service-hero.mjs';
import { renderAccountCards } from './network-markup.mjs';
import { fallbackAccounts } from './network-fallback.mjs';
import { universeAccounts } from './universe-data.mjs';
import { clientLogoRow } from './client-carousel.mjs';
import { fallbackCampaignPosts } from './network-post-fallback.mjs';

const e = escapeHtml;
const arrow = '<span aria-hidden="true">↗</span>';
const heading = (eyebrow, title, accent, aside = '', id = '') => `<div class="section-heading"><div><span class="eyebrow">${eyebrow}</span><h2${id ? ` id="${id}"` : ''}>${title}<br><em>${accent}</em></h2></div>${aside ? `<p>${aside}</p>` : ''}</div>`;
export const CALENDAR_URL = 'https://calendly.com/sentientagency';
const bookCall = (extra = '') => `<a class="button${extra}" href="${CALENDAR_URL}" target="_blank" rel="noopener noreferrer"><span>Book a call</span></a>`;
const heroActions = deckLabel => `<div class="sx-hero-actions">${bookCall()}<a class="text-link" href="#contact">${deckLabel} <span aria-hidden="true">→</span></a></div>`;

/* ------------------------------------------------------------------ launch */

// SOURCES: decks/launch-amplification/brief.py (launch_case slides). X views from
// the post screenshots; LinkedIn views from the team feedback doc; Decart's
// LinkedIn figure reported by Decart; Magic Patterns from its launch report.
// Sign-ups per client: Louis Gleeson's website feedback, 2026-11-13.
const launchCases = [
  { client: 'Lotus AI', meta: 'Funding announcement · Feb 2026', lead: '8.4M', label: 'views across X and LinkedIn',
    standout: ['50,000+', 'sign-ups'], stats: ['7.4M views on X', '1M views on LinkedIn'],
    x: { img: '/assets/v2/launch/kj.png', url: 'https://x.com/kjdhaliwal/status/2018731342113247533', alt: 'KJ Dhaliwal announcing Lotus AI’s $41M round on X' },
    li: { img: '/assets/v2/launch/li_kj.png', url: 'https://www.linkedin.com/posts/kjdhaliwal_today-were-announcing-that-lotus-health-ugcPost-7424499279899324433-TmVA/', alt: 'The same announcement on LinkedIn' } },
  { client: 'Decart', meta: 'Lucy 2.5 model launch · Jul 2026', lead: '6.6M', label: 'views across X and LinkedIn',
    standout: ['5,000+', 'sign-ups'], stats: ['4.8M views on X', '1.8M views on LinkedIn'],
    x: { img: '/assets/v2/launch/decart.png', url: 'https://x.com/DecartAI/status/2077801728213156044', alt: 'Decart introducing Lucy 2.5 on X' } },
  { client: 'Magic Patterns', meta: 'MagicOS launch · Oct 2026', lead: '1.3M+', label: 'views on X',
    standout: ['390×', 'the founder’s usual post views'], stats: ['72 creator quote posts', 'X and LinkedIn'],
    x: { img: '/assets/v2/launch/alex.png', url: 'https://x.com/alexdanilowicz/status/2110030443466940671', alt: 'Alex Danilowicz launching MagicOS on X' },
    li: { img: '/assets/v2/launch/li_alex.png', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7515795582733672448/', alt: 'The MagicOS launch on LinkedIn' } },
];

const launchCase = item => `<article class="lx-case"><div class="lx-case-media">${item.li ? `<a class="lx-shot lx-shot--li" href="${e(item.li.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open the ${e(item.client)} post on LinkedIn"><img src="${e(item.li.img)}" alt="${e(item.li.alt)}" width="616" height="585" loading="lazy"><span>LinkedIn</span></a>` : ''}<a class="lx-shot lx-shot--x" href="${e(item.x.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open the ${e(item.client)} post on X"><img src="${e(item.x.img)}" alt="${e(item.x.alt)}" width="568" height="696" loading="lazy"><span>X</span></a></div><div class="lx-case-copy"><span class="eyebrow">${e(item.meta)}</span><h3>${e(item.client)}</h3><p class="sx-figure"><strong>${e(item.lead)}</strong><span>${e(item.label)}</span></p><p class="lx-standout"><strong>${e(item.standout[0])}</strong><span>${e(item.standout[1])}</span></p><ul>${item.stats.map(stat => `<li>${e(stat)}</li>`).join('')}</ul></div></article>`;

// Wall of real launch posts. Views: X from the post screenshots (2026-11-11) and
// the Magic Patterns launch report; LinkedIn from the team feedback doc.
const wallPosts = {
  x: [
    ['/assets/v2/launch/kj.png', 'https://x.com/kjdhaliwal/status/2018731342113247533', 'KJ Dhaliwal', '@kjdhaliwal', '7.4M views', 'Lotus AI funding announcement on X'],
    ['/assets/v2/launch/decart.png', 'https://x.com/DecartAI/status/2077801728213156044', 'Decart', '@DecartAI', '4.8M views', 'Decart’s Lucy 2.5 launch on X'],
    ['/assets/v2/launch/alex.png', 'https://x.com/alexdanilowicz/status/2110030443466940671', 'Alex Danilowicz', '@alexdanilowicz', '1.33M views', 'The MagicOS launch on X'],
    ['/assets/v2/launch/w_nocontext.png', 'https://x.com/NoContextHumans/status/2110038968393924609', 'Out of Context Human Race', '@NoContextHumans', '44.9K views', 'A creator quote post of the MagicOS launch'],
    ['/assets/v2/launch/w_heyadam.png', 'https://x.com/heyadam_ai/status/2110210572029677828', 'Adam | AI Tools & News', '@heyadam_ai', '19.8K views', 'A creator quote post of the MagicOS launch'],
  ],
  li: [
    ['/assets/v2/launch/li_kj.png', 'https://www.linkedin.com/posts/kjdhaliwal_today-were-announcing-that-lotus-health-ugcPost-7424499279899324433-TmVA/', 'KJ Dhaliwal', 'Lotus AI', '1M views', 'Lotus AI funding announcement on LinkedIn'],
    ['/assets/v2/launch/li_alex.png', 'https://www.linkedin.com/feed/update/urn:li:activity:7515795582733672448/', 'Alex Danilowicz', 'Magic Patterns', '1,224 reactions', 'The MagicOS launch on LinkedIn'],
  ],
};
const wallCard = platform => ([img, url, name, handle, metric, alt]) => `<a class="lx-post lx-post--${platform}" href="${e(url)}" target="_blank" rel="noopener noreferrer" aria-label="${e(name)} (${e(handle)}): ${e(metric)}"><span class="lx-post-head"><span class="lx-post-logo" aria-hidden="true">${platform === 'x' ? '𝕏' : 'in'}</span><span class="lx-post-label">${platform === 'x' ? 'Post on X' : 'Post on LinkedIn'}</span><span class="lx-post-metric">${e(metric)}</span></span><img src="${e(img)}" alt="${e(alt)}" width="568" height="640" loading="lazy"></a>`;

// SOURCES: brief.py creator_grid. X followers read 2026-11-11; LinkedIn from campaign sheets.
// Louis, 2026-11-13: show only the biggest voices.
const creators = [
  ['Out of Context Human Race', 'NoContextHumans', 'https://x.com/NoContextHumans', [['X', '4.2M']], 'img'],
  ['Hasan Toor', 'hasantoxr', 'https://x.com/hasantoxr', [['X', '436K'], ['LinkedIn', '200K']], 'img'],
  ['Alamin Hossain', 'alaminpro', 'https://www.linkedin.com/in/alaminpro/', [['LinkedIn', '212K']], 'AH'],
  ['Alex Moore', 'heyalexmoore', 'https://x.com/heyalexmoore', [['X', '187K']], 'img'],
];
const creatorCard = ([name, handle, url, platforms, avatar]) => `<a class="lx-creator" href="${e(url)}" target="_blank" rel="noopener noreferrer">${avatar === 'img' ? `<img src="/assets/v2/launch/avatars/${e(handle)}.jpg" alt="" width="64" height="64" loading="lazy">` : `<span class="lx-creator-initials" aria-hidden="true">${avatar}</span>`}<span class="lx-creator-id"><strong>${e(name)}</strong><small>${avatar === 'img' ? `@${e(handle)}` : 'LinkedIn'}</small></span><span class="lx-creator-reach">${platforms.map(([platform, followers]) => `<span><small>${platform}</small><b>${followers}</b></span>`).join('')}</span></a>`;

const launchLogos = ['Lotus AI', 'Decart', 'Magic Patterns'];

export function renderLaunchPage(contact) {
  return `<section class="service-landing service-landing--launch sx-hero-quiet"><div class="service-landing-inner shell"><div class="service-landing-copy"><span class="eyebrow">VIRAL LAUNCH CAMPAIGNS</span><h1 class="route-title"><span class="title-line"><span>STRATEGIC</span></span> <span class="title-line"><span>TECH</span></span> <span class="title-line"><span><em>LAUNCHES.</em></span></span></h1><p class="service-desktop-description">Your launch video, amplified across X and LinkedIn by the creators your customers already follow. One launch drove 50,000+ sign-ups.</p><p class="service-mobile-description">Amplified across X and LinkedIn.<br>One launch drove 50,000+ sign-ups.</p>${heroActions('Get the launch deck')}</div>${serviceVisual('launch')}</div></section>`
  + `<section class="sx-logo-row shell" aria-label="Recent launch clients"><span class="eyebrow">RECENT LAUNCHES</span><ul>${launchLogos.map(name => `<li>${e(name)}</li>`).join('')}</ul></section>`
  + `<section class="sx-section shell" id="launch-results" aria-labelledby="launch-results-title"><div class="section-heading"><div><span class="eyebrow">RESULTS</span><h2 id="launch-results-title"><em>Proof.</em></h2></div></div><div class="lx-cases" id="mobile-launch-work" data-mobile-carousel tabindex="0" aria-label="Launch results">${launchCases.map(launchCase).join('')}</div><div class="mobile-rail-controls" data-carousel-controls="mobile-launch-work"><span>Swipe to explore</span><div><button type="button" data-carousel-prev aria-label="Previous launch">←</button><output data-carousel-status aria-live="polite">1 of 3</output><button type="button" data-carousel-next aria-label="Next launch">→</button></div></div><p class="evidence-note">Views from each post or our launch reports.</p></section>`
  + `<section class="sx-section shell" id="launch-wall" aria-labelledby="launch-wall-title">${heading('THE POSTS', 'Real launches.', 'Real views.', '', 'launch-wall-title')}<div class="lx-wall"><input type="radio" name="lx-wall" id="lx-wall-x" checked><input type="radio" name="lx-wall" id="lx-wall-li"><div class="lx-wall-toggle" role="group" aria-label="Choose a platform"><label for="lx-wall-x">X</label><label for="lx-wall-li">LinkedIn</label></div><div class="lx-wall-grid lx-wall-grid--x">${wallPosts.x.map(wallCard('x')).join('')}</div><div class="lx-wall-grid lx-wall-grid--li">${wallPosts.li.map(wallCard('li')).join('')}</div></div></section>`
  + `<section class="sx-section shell" id="launch-how" aria-labelledby="launch-how-title">${heading('HOW IT WORKS', 'Three steps.', 'Launch day.', '', 'launch-how-title')}<ol class="sx-three"><li><span class="sx-step-dot">1</span><p>We pick the creators your customers follow.</p></li><li><span class="sx-step-dot">2</span><p>They post about your launch on the day.</p></li><li><span class="sx-step-dot">3</span><p>You get the views, the traffic and the sign-ups.</p></li></ol></section>`
  + `<section class="sx-section shell" id="launch-creators" aria-labelledby="launch-creators-title">${heading('CREATORS', 'Creators we', 'launch with.', '', 'launch-creators-title')}<div class="lx-creators lx-creators--premium">${creators.map(creatorCard).join('')}</div><p class="evidence-note">X followers as of November 11, 2026. LinkedIn followers from our campaign sheets.</p></section>`
  + `<section class="sx-section shell" id="launch-guarantee" aria-labelledby="launch-guarantee-title">${heading('OUR GUARANTEE', 'Every launch comes', 'with guaranteed views.', '', 'launch-guarantee-title')}<div class="lx-tiers">${['100K', '1M', '2M'].map(views => `<div class="lx-tier"><strong>${views}</strong><span>minimum views</span></div>`).join('')}</div><div class="lx-tiers-cta"><p>Pricing depends on your launch. Book a call and we’ll scope it.</p>${bookCall()}</div></section>`
  + `${contact('launch')}`;
}

/* ------------------------------------------------------------------ growth */

// SOURCES: decks/standard-campaigns/posts.py RESULTS (team feedback doc) and
// web-briefs/growth-campaigns.md section 4 (OpenAI posts sent by Sergio 2026-11-12).
const growthResults = [
  { brand: 'Higgsfield', big: '150M+', label: 'views', shots: [['DeZ7YfHJsoC', 'ingenia.ai'], ['DdZz14knWs5', 'chatgptricks']] },
  { brand: 'OpenAI', big: '15M+', label: 'views through partnerships', shots: [['DNlYktOp8R3', 'chatgptricks'], ['DJ_sxdnAa40', 'chatgptricks']] },
  { brand: 'Abacus', big: '50M+', label: 'views', shots: [['DVh2jCkgHFC', 'chatgptricks'], ['DG3NY12vVW8', 'chatgptricks']] },
];
const resultColumn = item => `<article class="gx-result"><h3>${e(item.brand)}</h3><p class="sx-figure"><strong>${e(item.big)}</strong><span>${e(item.label)}</span></p><div class="gx-result-shots">${item.shots.map(([code, handle]) => `<a href="https://www.instagram.com/p/${code}/" target="_blank" rel="noopener noreferrer" aria-label="Open the ${e(item.brand)} post by @${handle}"><img src="/assets/v2/growth/posts/${code}.jpg" alt="${e(item.brand)} campaign post on @${handle}" width="720" height="900" loading="lazy"><span>@${e(handle)}</span></a>`).join('')}</div></article>`;

// More campaign posts across our pages: the site's campaign pool (network-post-fallback.mjs),
// likes as last exported from SentientDash.
const wallCodes = ['Db6ahVGsMuC', 'DOuYM9JjZYB', 'DEFL6xaRn_E', 'DEuYlr2ATV8', 'DO0aKHUgCdV', 'DcUQdVJgIbd', 'DPklpEngMSC', 'DZV5fOZnQJU'];
const growthWall = () => wallCodes.map(code => {
  const post = fallbackCampaignPosts.find(item => item.shortcode === code);
  if (!post) throw new Error(`Growth wall post missing: ${code}`);
  return `<a class="gx-wall-post" href="${e(post.source)}" target="_blank" rel="noopener noreferrer"><img src="${e(post.image)}" alt="Campaign post on @${e(post.handle)}" width="540" height="675" loading="lazy"><span><b>@${e(post.handle)}</b>${Math.round(post.likes / 100) / 10}K likes</span></a>`;
}).join('');

// The approach visual: our real account pool with the three example picks lit.
const poolHandles = ['trends', 'chatgptricks', 'tecnologia', 'theaipage', 'artificialntellligence', 'chatgptips', 'planet.ai_', 'mindset.therapy', 'sergioprompts'];
const picks = new Set(['chatgptricks', 'artificialntellligence', 'mindset.therapy']);
const pool = () => poolHandles.map(handle => {
  const account = universeAccounts.find(item => item.handle === handle);
  if (!account) throw new Error(`Growth pool account missing: ${handle}`);
  return `<li${picks.has(handle) ? ' class="is-picked"' : ''}><img src="${e(account.avatar)}" alt="@${e(handle)}" width="56" height="56" loading="lazy">${picks.has(handle) ? '<span aria-hidden="true">✓</span>' : ''}</li>`;
}).join('');
const fan = [['DeaPs6jpywh', 'artificialntellligence'], ['De6S4W0Tr-s', 'chatgptricks'], ['Dd92T8kmekf', 'mindset.therapy']];

export function renderGrowthPage(contact) {
  const accounts = [...fallbackAccounts].sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0)).slice(0, 5);
  return `<div class="growth-content"><section class="service-landing service-landing--growth"><div class="service-landing-inner shell"><div class="service-landing-copy"><span class="eyebrow">GROWTH CAMPAIGNS</span><h1 class="route-title"><span class="title-line"><span>ROI AND CPM</span></span> <span class="title-line"><span>DRIVEN</span></span> <span class="title-line"><span><em>CAMPAIGNS.</em></span></span></h1><p class="service-desktop-description">Guaranteed CPMs. We publish your story across a network of 30M+ followers, find the posts that perform and put ad spend behind them.</p><p class="service-mobile-description">Guaranteed CPMs.<br>Ads behind the posts that win.</p>${heroActions('Get the growth deck')}</div>${serviceVisual('growth')}</div></section>`
  + clientLogoRow()
  + `<section class="sx-section sx-section--panel" id="growth-network" aria-labelledby="growth-network-title"><div class="shell">${heading('OUR AUDIENCE', 'Pages people', 'chose to follow.', '', 'growth-network-title')}<div class="gx-figures"><div><strong>30M+</strong><h3>Owned followers</h3><p>Across Sentient’s own pages in AI, tech and business.</p></div><div><strong>1B+</strong><h3>Partner followers</h3><p>Across partner accounts on Instagram, X and LinkedIn.</p></div></div><div class="v2-owned-accounts gx-accounts gx-accounts--top">${renderAccountCards(accounts)}</div></div></section>`
  + `<section class="sx-section shell" id="growth-results" aria-labelledby="growth-results-title"><div class="section-heading"><div><span class="eyebrow">RESULTS</span><h2 id="growth-results-title"><em>Proof.</em></h2></div></div>`
  + `<article class="gx-case"><div class="gx-case-copy"><span class="eyebrow">ARTISAN · “STOP HIRING HUMANS”</span><h3>One line that got San Francisco talking.</h3><dl class="gx-narrative-figures"><div><dt>1B+</dt><dd>Impressions</dd></div><div><dt>$2M+</dt><dd>New ARR</dd></div><div><dt>5→70%</dt><dd>Brand recognition in SF</dd></div></dl><p class="evidence-note">Artisan’s full campaign, including its billboards. We helped build the narrative and ran it across our network.</p></div><div class="gx-narrative-art"><img class="gx-behind gx-behind--l" src="/assets/v2/growth/posts/DDjBmpLJBlq.jpg" alt="" width="720" height="900" loading="lazy"><img class="gx-behind gx-behind--r" src="/assets/v2/growth/posts/DIWJYSwSl2J.jpg" alt="" width="720" height="900" loading="lazy"><a class="gx-ig-card" href="https://www.instagram.com/p/DD6x4v4xHyn/" target="_blank" rel="noopener noreferrer"><span class="gx-ig-head"><img src="/assets/universe/avatar-chatgptricks.jpg" alt="" width="28" height="28">chatgptricks</span><img src="/assets/DD6x4v4xHyn.jpg" alt="@chatgptricks post: “Stop Hiring Humans” ads cover San Francisco streets" width="720" height="900" loading="lazy"><span class="gx-ig-foot"><b>10.9K likes</b> · 495 comments <span>Open post ${arrow}</span></span></a></div></article>`
  + `<div class="gx-results">${growthResults.map(resultColumn).join('')}</div>`
  + `<h3 class="gx-wall-title">More from our pages</h3><div class="gx-wall">${growthWall()}</div></section>`
  + `<section class="sx-section shell" id="growth-approach" aria-labelledby="growth-approach-title">${heading('OUR APPROACH', 'Pick. Publish.', 'Scale the winners.', '', 'growth-approach-title')}<div class="gx-pipeline"><div class="gx-stage gx-stage--pool"><span class="sx-step-dot">1</span><h3>We pick the accounts that fit</h3><ul class="gx-pool" aria-label="Accounts in our network, with three example picks">${pool()}</ul></div><div class="gx-stage gx-stage--fan"><span class="sx-step-dot">2</span><h3>They publish your story</h3><div class="gx-fan">${fan.map(([code, handle], index) => `<img class="${index === 1 ? 'is-winner' : ''}" src="/assets/v2/growth/posts/${code}.jpg" alt="Example post on @${handle}" width="720" height="900" loading="lazy">`).join('')}</div></div><div class="gx-stage gx-stage--ads"><span class="sx-step-dot">3</span><h3>We scale the winner with ads</h3><ul class="gx-ads">${fan.map(([code], index) => `<li class="${index === 1 ? 'is-winner' : ''}"><img src="/assets/v2/growth/posts/${code}.jpg" alt="" width="48" height="60" loading="lazy"><span class="gx-ads-bar"><i style="--w:${[34, 100, 48][index]}%"></i></span>${index === 1 ? '<b>+ Ads</b>' : ''}</li>`).join('')}</ul></div></div></section>`
  + `<section class="sx-section shell" id="growth-cpm" aria-labelledby="growth-cpm-title"><div class="gx-commitment"><div class="sx-orb" aria-hidden="true"><strong>CPM</strong><span>Agreed before launch</span></div><div><span class="eyebrow">CPM BENCHMARK</span><h3 id="growth-cpm-title">A CPM agreed before launch.</h3><p>We agree your investment and minimum impressions up front, so you know exactly what your budget buys.</p>${bookCall()}</div></div></section>`
  + `</div>${contact('growth')}`;
}
