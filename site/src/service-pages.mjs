// Service landing pages, rebuilt from the Launch Amplification and Standard
// Campaigns decks (~/Sentient/decks). Every figure here is sourced in those
// decks or their briefs; see SOURCES next to each block. Structure follows
// Louis Gleeson's website feedback (2026-11-13): proof first, little explanation.
import { escapeHtml } from './social-meta.mjs';
import { serviceVisual } from './service-hero.mjs';
import { renderAccountCards } from './network-markup.mjs';
import { fallbackAccounts } from './network-fallback.mjs';
import { universeAccounts } from './universe-data.mjs';
import { trustedMarquee } from './client-carousel.mjs';
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
// LinkedIn figure reported by Decart; Magic Patterns from its launch report
// (launch.json: founder post plus network quote posts on X).
// Sign-ups per client: Louis Gleeson's website feedback, 2026-11-13.
const launchCases = [
  { id: 'lotus', month: 'Feb 2026', client: 'Lotus AI', meta: 'Funding announcement · Feb 2026', lead: '8.4M', label: 'views across X and LinkedIn',
    standout: ['50,000+', 'sign-ups'], stats: ['7.4M views on X', '1M views on LinkedIn'],
    about: 'KJ Dhaliwal announced Lotus AI’s $41M round from Kleiner Perkins and CRV. We amplified his founder post across X and LinkedIn on launch day.',
    x: { img: '/assets/v2/launch/kj.png', url: 'https://x.com/kjdhaliwal/status/2018731342113247533', alt: 'KJ Dhaliwal announcing Lotus AI’s $41M round on X' },
    li: { img: '/assets/v2/launch/li_kj.png', url: 'https://www.linkedin.com/posts/kjdhaliwal_today-were-announcing-that-lotus-health-ugcPost-7424499279899324433-TmVA/', alt: 'The same announcement on LinkedIn' } },
  { id: 'decart', month: 'Jul 2026', client: 'Decart', meta: 'Lucy 2.5 model launch · Jul 2026', lead: '6.6M', label: 'views across X and LinkedIn',
    standout: ['5,000+', 'sign-ups'], stats: ['4.8M views on X', '1.8M views on LinkedIn'],
    about: 'Decart launched Lucy 2.5, its live AI model that edits video in real time. Creators and media accounts quoted and shared the launch across X and LinkedIn.',
    x: { img: '/assets/v2/launch/decart.png', url: 'https://x.com/DecartAI/status/2077801728213156044', alt: 'Decart introducing Lucy 2.5 on X' },
    li: { img: '/assets/v2/launch/li_decart.png', url: 'https://www.linkedin.com/posts/kfir-aberman-502703131_today-at-decart-were-introducing-lucy-ugcPost-7483894835591004160-rlkk/', alt: 'The Lucy 2.5 launch on LinkedIn' } },
  { id: 'magic', month: 'Oct 2026', client: 'Magic Patterns', meta: 'MagicOS launch · Oct 2026', lead: '1.3M+', label: 'views on X across the launch',
    standout: ['390×', 'the founder’s usual post views'], stats: ['72 creator quote posts', 'Amplified on X and LinkedIn'],
    about: 'Alex Danilowicz launched MagicOS, a canvas where designers and AI agents work together. 72 creators quoted his post in coordinated waves.',
    x: { img: '/assets/v2/launch/alex.png', url: 'https://x.com/alexdanilowicz/status/2110030443466940671', alt: 'Alex Danilowicz launching MagicOS on X' },
    li: { img: '/assets/v2/launch/li_alex.png', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7515795582733672448/', alt: 'The MagicOS launch on LinkedIn' } },
];

const launchCase = item => `<article class="lx-case" id="case-${item.id}"><div class="lx-case-media"><a class="lx-shot lx-shot--li" href="${e(item.li.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open the ${e(item.client)} post on LinkedIn"><img src="${e(item.li.img)}" alt="${e(item.li.alt)}" width="616" height="585" loading="lazy"><span>LinkedIn</span></a><a class="lx-shot lx-shot--x" href="${e(item.x.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open the ${e(item.client)} post on X"><img src="${e(item.x.img)}" alt="${e(item.x.alt)}" width="568" height="696" loading="lazy"><span>X</span></a></div><div class="lx-case-copy"><span class="eyebrow">${e(item.meta)}</span><h3>${e(item.client)}</h3><p class="lx-case-about">${e(item.about)}</p><p class="sx-figure"><strong>${e(item.lead)}</strong><span>${e(item.label)}</span></p><p class="lx-standout"><strong>${e(item.standout[0])}</strong><span>${e(item.standout[1])}</span></p><ul>${item.stats.map(stat => `<li>${e(stat)}</li>`).join('')}</ul></div></article>`;

// Clients as a row of tabs: choosing one opens its case below (CSS only, no script).
const launchProof = () => `<div class="lx-proof">${launchCases.map((item, index) => `<input type="radio" name="lx-case" id="lx-tab-${item.id}"${index === 0 ? ' checked' : ''}>`).join('')}<div class="lx-tabs" role="group" aria-label="Choose a launch">${launchCases.map(item => `<label for="lx-tab-${item.id}"><em class="lx-tab-date">${e(item.month)}</em><span>${e(item.client)}</span><small>${e(item.lead)} views</small></label>`).join('')}</div><div class="lx-case-panels">${launchCases.map(launchCase).join('')}</div></div>`;

// Wall of real launch posts as native-looking cards. Text, date and counts are
// transcribed from the post screenshots (X, 2026-11-11); LinkedIn views from the
// team feedback doc (Decart's reported by Decart). Media and avatars are crops
// of those screenshots.
const W = '/assets/v2/launch/wall/';
const xPosts = [
  { name: 'KJ Dhaliwal', handle: 'kjdhaliwal', avatar: `${W}kj-avatar.jpg`, date: 'Feb 3, 2026', url: 'https://x.com/kjdhaliwal/status/2018731342113247533', media: `${W}kj-media.jpg`,
    text: '100M Americans don’t have a primary care doctor, so we built @Lotus, the first AI doctor powered by real doctors. Leading investors just backed us with $41M.', counts: ['563', '1.3K', '6K', '7.4M'] },
  { name: 'Decart', handle: 'DecartAI', avatar: `${W}decart-avatar.jpg`, date: 'Jul 16, 2026', url: 'https://x.com/DecartAI/status/2077801728213156044', media: `${W}decart-media.jpg`,
    text: 'Meet Lucy 2.5, our most advanced Live AI model yet. Lucy edits videos in realtime, now with more capabilities and greater control.', counts: ['414', '745', '3.6K', '4.8M'] },
  { name: 'Alex Danilowicz', handle: 'alexdanilowicz', avatar: `${W}alex-avatar.jpg`, date: 'Oct 13, 2026', url: 'https://x.com/alexdanilowicz/status/2110030443466940671', media: `${W}alex-media.jpg`,
    text: 'Today we’re launching MagicOS. And we’ve come to the conclusion that designers are NOT getting replaced.', counts: ['158', '309', '1K', '465.9K'] },
  { name: 'Out of Context Human Race', handle: 'NoContextHumans', avatar: '/assets/v2/launch/avatars/NoContextHumans.jpg', date: 'Oct 13, 2026', url: 'https://x.com/NoContextHumans/status/2110038968393924609', media: `${W}nocontext-media.jpg`,
    text: 'designers after moving a button 2px with their voice @magicpatterns', quote: 'alexdanilowicz', counts: ['1', '1', '18', '45.2K'] },
  { name: 'Adam | AI Tools & News', handle: 'heyadam_ai', avatar: '/assets/v2/launch/avatars/heyadam_ai.jpg', date: 'Oct 13, 2026', url: 'https://x.com/heyadam_ai/status/2110210572029677828', media: `${W}heyadam-media.jpg`,
    text: 'We’ve all lost a useful idea somewhere in a long conversation or a pile of files. A workspace that keeps the whole exploration together is appealing.', quote: 'alexdanilowicz', counts: ['16', '6', '92', '19.9K'] },
];
const liPosts = [
  { name: 'KJ Dhaliwal', role: 'Lotus AI', avatar: `${W}li-kj-avatar.jpg`, date: 'Feb 2026', url: 'https://www.linkedin.com/posts/kjdhaliwal_today-were-announcing-that-lotus-health-ugcPost-7424499279899324433-TmVA/', media: `${W}li-kj-media.jpg`,
    text: 'Today, we’re announcing that Lotus Health AI has raised $41M from Kleiner Perkins and CRV to build the future of primary care.', reactions: '1,340', comments: '258', views: '1M' },
  { name: 'Kfir Aberman', role: 'Decart', avatar: `${W}li-decart-avatar.jpg`, date: 'Jul 2026', url: 'https://www.linkedin.com/posts/kfir-aberman-502703131_today-at-decart-were-introducing-lucy-ugcPost-7483894835591004160-rlkk/', media: `${W}li-decart-media.jpg`,
    text: 'Today, at Decart, we’re introducing Lucy 2.5. Lucy represents a paradigm shift in world models.', reactions: '3,279', comments: '147', views: '1.8M' },
  { name: 'Alexander Danilowicz', role: 'Magic Patterns', avatar: `${W}li-alex-avatar.jpg`, date: 'Oct 2026', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7515795582733672448/', media: `${W}li-alex-media.jpg`,
    text: 'Today we’re launching MagicOS. And we’ve come to the conclusion that designers are NOT getting replaced.', reactions: '1,301', comments: '207' },
];
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${{ reply: 'M4 5h16v11H8l-4 4z', repost: 'M7 7h10l-3-3M17 17H7l3 3M7 7v6M17 17v-6', like: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', views: 'M5 20V10M10 20V4M15 20v-8M20 20v-5' }[name]}"/></svg>`;
const xCard = post => `<a class="lx-tweet" href="${e(post.url)}" target="_blank" rel="noopener noreferrer" aria-label="${e(post.name)} on X: ${e(post.counts[3])} views"><span class="lx-tweet-head"><img src="${e(post.avatar)}" alt="" width="40" height="40" loading="lazy"><span><b>${e(post.name)} <i class="lx-verified" aria-hidden="true"></i></b><small>@${e(post.handle)} · ${e(post.date)}</small></span><span class="lx-tweet-logo" aria-hidden="true">𝕏</span></span><span class="lx-tweet-text">${e(post.text)}</span>${post.quote ? `<span class="lx-tweet-quote">Quoting @${e(post.quote)}</span>` : ''}<span class="lx-tweet-media"><img src="${e(post.media)}" alt="" width="560" height="315" loading="lazy"></span><span class="lx-tweet-counts">${['reply', 'repost', 'like', 'views'].map((name, index) => `<span${name === 'views' ? ' class="is-views"' : ''}>${icon(name)}${e(post.counts[index])}</span>`).join('')}</span></a>`;
const liCard = post => `<a class="lx-tweet lx-tweet--li" href="${e(post.url)}" target="_blank" rel="noopener noreferrer" aria-label="${e(post.name)} on LinkedIn${post.views ? `: ${e(post.views)} views` : ''}"><span class="lx-tweet-head"><img src="${e(post.avatar)}" alt="" width="40" height="40" loading="lazy"><span><b>${e(post.name)}</b><small>${e(post.role)} · ${e(post.date)}</small></span><span class="lx-tweet-logo lx-tweet-logo--li" aria-hidden="true">in</span></span><span class="lx-tweet-text">${e(post.text)}</span><span class="lx-tweet-media"><img src="${e(post.media)}" alt="" width="616" height="282" loading="lazy"></span><span class="lx-tweet-counts"><span>${icon('like')}${e(post.reactions)}</span><span>${icon('reply')}${e(post.comments)}</span>${post.views ? `<span class="is-views">${icon('views')}${e(post.views)} views</span>` : ''}</span></a>`;
const railControls = id => `<div class="sx-rail-arrows" data-rail-for="${id}"><button type="button" data-rail-prev aria-label="Previous posts">←</button><button type="button" data-rail-next aria-label="Next posts">→</button></div>`;
const launchWall = () => `<div class="lx-wall"><input type="radio" name="lx-wall" id="lx-wall-x" checked><input type="radio" name="lx-wall" id="lx-wall-li"><div class="lx-wall-bar"><div class="lx-wall-toggle" role="group" aria-label="Choose a platform"><label for="lx-wall-x">X</label><label for="lx-wall-li">LinkedIn</label></div></div><div class="lx-wall-pane lx-wall-pane--x">${railControls('lx-rail-x')}<div class="lx-rail" id="lx-rail-x" data-rail tabindex="0" aria-label="Launch posts on X">${xPosts.map(xCard).join('')}</div></div><div class="lx-wall-pane lx-wall-pane--li">${railControls('lx-rail-li')}<div class="lx-rail" id="lx-rail-li" data-rail tabindex="0" aria-label="Launch posts on LinkedIn">${liPosts.map(liCard).join('')}</div></div></div>`;

// Founder testimonials: placeholders until the quotes arrive (Louis's asset list).
// They render as grey skeletons and must be replaced before this goes live.
const testimonialSlots = ['Lotus AI', 'Decart', 'Magic Patterns'];
const launchTestimonials = () => `<div class="lx-quotes">${testimonialSlots.map(company => `<figure class="lx-quote is-pending"><span class="lx-quote-mark" aria-hidden="true">“</span><span class="sx-skeleton-lines" aria-hidden="true"><i></i><i></i><i></i><i style="width:62%"></i></span><figcaption><span class="sx-skeleton-avatar" aria-hidden="true"></span><span><span class="sx-skeleton-line" aria-hidden="true"></span><small>Founder · ${e(company)}</small></span></figcaption><span class="lx-quote-pending">Quote pending</span></figure>`).join('')}</div>`;

// Creators: the 20 biggest X and LinkedIn creators who delivered in our launch
// campaigns (deliverables marked delivered in ~/Sentient/launches/*/launch.json).
// X followers read live via fxtwitter 2026-11-13 (brief.py values from 2026-11-11
// where the live read failed); LinkedIn followers from the campaign sheets.
const compact = value => value >= 1e6 ? `${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M` : `${Math.round(value / 1e3)}K`;
const A = '/assets/v2/launch/avatars/';
const voice = (name, handle, reach, avatar = `${A}${handle}.jpg`) => ({ name, handle: `@${handle}`, url: `https://x.com/${handle}`, avatar, reach });
const topVoices = () => [
  voice('Out of Context Human Race', 'NoContextHumans', [['X', 4240580]]),
  voice('Hasan Toor', 'hasantoxr', [['X', 436361], ['LinkedIn', 200000]]),
  { name: 'Alamin Hossain', handle: 'LinkedIn', url: 'https://www.linkedin.com/in/alaminpro/', initials: 'AH', reach: [['LinkedIn', 212000]] },
  voice('Alex Moore', 'heyalexmoore', [['X', 186523]]),
  voice('Jay', 'jaysmith_ai', [['X', 159192]]),
  voice('Adam | AI Tools & News', 'heyadam_ai', [['X', 158302]]),
  voice('Atul Kumar', 'atulkumarzz', [['X', 141011]]),
  voice('Bishal Nandi', 'LearnWithBishal', [['X', 118935]]),
  voice('Alif Hossain', 'alifcoder', [['X', 107668]]),
  voice('Alamin', 'iam_chonchol', [['X', 105918]]),
  voice('Shruti Codes', 'Shruti_0810', [['X', 105253]]),
  voice('Parul Gautam', 'Parul_Gautam7', [['X', 85409]]),
  voice('Gina Acosta', 'ginacostag_', [['X', 65594]]),
  voice('Markandey Sharma', 'TechByMarkandey', [['X', 64592]]),
  voice('Jafar Najafov', 'JafarNajafov', [['X', 61266]]),
  voice('SCARLETT AI', 'Beast_85', [['X', 53729]]),
  voice('Manish Kumar Shah', 'manishkumar_dev', [['X', 52903]]),
  voice('Your Tech Girl', 'yourtechgirl24', [['X', 43197]]),
  voice('Rajesh Kumar', 'therjrajesh', [['X', 41669]]),
  voice('Tom Rei', 'tomreiai', [['X', 31068]]),
];
const voiceCard = voice => `<li><a class="lx-creator" href="${e(voice.url)}" target="_blank" rel="noopener noreferrer" draggable="false">${voice.avatar ? `<img src="${e(voice.avatar)}" alt="" width="64" height="64" loading="lazy" draggable="false">` : `<span class="lx-creator-initials" aria-hidden="true">${voice.initials}</span>`}<span class="lx-creator-id"><strong>${e(voice.name)}</strong><small>${e(voice.handle)}</small></span><span class="lx-creator-reach">${voice.reach.map(([platform, followers]) => `<span><small>${platform}</small><b>${compact(followers)}</b></span>`).join('')}</span></a></li>`;
const creatorStrip = () => `<div class="sx-marquee lx-voices" data-marquee aria-label="The 20 biggest creators from our X and LinkedIn launches"><ul class="sx-marquee-track">${topVoices().map(voiceCard).join('')}</ul></div>`;

// How it works, drawn like the Growth pipeline. Everything is from the Magic
// Patterns launch (Oct 2026): the creators who posted, Alex's post and two of
// the 72 quote posts, and the views of each quote post over the first 24 hours
// (launches/magic-patterns/launch.json via decks/launch-amplification/brief.py).
const flowPool = ['NoContextHumans', 'hasantoxr', 'LearnWithBishal', 'heyadam_ai', 'Parul_Gautam7', 'heyalexmoore', 'alifcoder', 'atulkumarzz', 'iam_chonchol', 'jaysmith_ai', 'therjrajesh', 'nolancarterai', 'AvabrooksAI', 'sambrownai', 'aiwithnatalia'];
const flowPicks = new Set(['NoContextHumans', 'hasantoxr', 'heyadam_ai', 'heyalexmoore']);
const wave = [[0.41, 6354], [0.46, 912], [0.47, 1313], [0.48, 8456], [0.49, 896], [0.49, 9686], [0.5, 595], [0.51, 7243], [0.53, 8404], [0.53, 9450], [0.53, 7636], [0.54, 446], [0.55, 7304], [0.56, 7438], [0.56, 44895], [0.57, 7529], [0.58, 10435], [0.58, 7402], [0.59, 7263], [0.59, 7236], [0.62, 1918], [0.64, 7927], [0.67, 9208], [0.67, 38491], [0.7, 25785], [0.74, 11239], [0.77, 11841], [0.78, 10671], [0.78, 10305], [0.79, 9915], [0.83, 13258], [0.93, 19655], [0.94, 7872], [0.96, 8744], [0.99, 9171], [1.0, 13262], [1.12, 9370], [1.13, 19753], [1.25, 17670], [1.45, 22070], [1.94, 9093], [2.0, 8688], [2.0, 6392], [2.02, 7255], [2.05, 8463], [2.08, 8287], [2.09, 7763], [2.12, 8525], [2.15, 9385], [2.21, 13691], [2.22, 8316], [2.26, 7358], [2.29, 7317], [2.41, 8686], [2.56, 33315], [7.25, 12782], [11.75, 21768], [11.81, 22619], [11.93, 19792], [13.26, 17850], [13.28, 14196], [13.29, 22563], [13.45, 23706], [13.91, 27243], [14.18, 15748], [14.24, 17807], [14.48, 18637], [17.12, 33908], [19.37, 6002], [20.93, 388], [20.94, 1426], [23.78, 7906]];
// Hours on a square-root axis so the first-hour waves stay readable.
const waveChart = () => `<svg class="lx-flow-chart" viewBox="0 0 300 110" role="img" aria-label="Views of each of the 72 creator quote posts in the first 24 hours after launch"><line x1="0" y1="100" x2="300" y2="100"/>${wave.map(([hour, views]) => `<rect x="${(Math.sqrt(hour / 24) * 292).toFixed(1)}" y="${(100 - Math.sqrt(views / 44895) * 92).toFixed(1)}" width="3" height="${(Math.sqrt(views / 44895) * 92).toFixed(1)}" rx="1"/>`).join('')}${[[0, 'Launch'], [1, '1h'], [6, '6h'], [24, '24h']].map(([hour, label]) => `<text x="${(Math.sqrt(hour / 24) * 292).toFixed(1)}" y="109"${hour === 24 ? ' text-anchor="end"' : ''}>${label}</text>`).join('')}</svg>`;
const flowQuote = (handle, avatar, text) => `<span class="lx-flow-quote"><img src="${avatar}" alt="" width="28" height="28" loading="lazy"><span><b>@${handle}</b>${text}</span></span>`;
const launchFlow = () => `<div class="gx-pipeline lx-flow"><div class="gx-stage"><span class="sx-step-dot">1</span><h3>We pick the creators your customers follow</h3><ul class="gx-pool lx-flow-pool" aria-label="Creators from our launches, with four example picks">${flowPool.map(handle => `<li${flowPicks.has(handle) ? ' class="is-picked"' : ''}><img src="/assets/v2/launch/avatars/${handle}.jpg" alt="@${handle}" width="56" height="56" loading="lazy">${flowPicks.has(handle) ? '<span aria-hidden="true">✓</span>' : ''}</li>`).join('')}</ul></div><div class="gx-stage"><span class="sx-step-dot">2</span><h3>They post about your launch on the day</h3><div class="lx-flow-posts"><span class="lx-flow-founder"><span class="lx-flow-founder-head"><img src="${W}alex-avatar.jpg" alt="" width="32" height="32" loading="lazy"><span><b>Alex Danilowicz</b><small>@alexdanilowicz · Founder</small></span></span><span class="lx-flow-founder-text">Today we’re launching MagicOS.</span><img class="lx-flow-founder-media" src="${W}alex-media.jpg" alt="Alex Danilowicz launching MagicOS on X" width="560" height="315" loading="lazy"></span>${flowQuote('NoContextHumans', '/assets/v2/launch/avatars/NoContextHumans.jpg', 'Quote post · 45.2K views')}${flowQuote('heyadam_ai', '/assets/v2/launch/avatars/heyadam_ai.jpg', 'Quote post · 19.9K views')}</div></div><div class="gx-stage"><span class="sx-step-dot">3</span><h3>You get the views, the traffic and the sign-ups</h3><div class="lx-flow-result"><p class="lx-flow-result-head"><span>Magic Patterns · first 24h</span><b>72 quote posts</b></p>${waveChart()}<p class="lx-flow-result-total"><strong>1.3M+</strong><span>views on X across the launch</span></p></div></div></div>`;

// Packages (Louis: no prices). Names, guarantees and scope from the deck's
// packages slide (brief.py); scope stays qualitative (Sergio, 2026-11-11).
const packages = [
  { name: 'Launch', views: '100K', scale: 0.05, scope: 'Focused account selection' },
  { name: 'Launch Plus', views: '1M', scale: 0.5, scope: 'Expanded account selection' },
  { name: 'Launch Scale', views: '2M', scale: 1, scope: 'Broadest account selection' },
];
const included = ['Creator coordination', 'Creator copy guidance', 'Campaign report'];
const launchPackages = () => `<div class="lx-packs">${packages.map((pack, index) => `<article class="lx-pack${index === 2 ? ' is-top' : ''}"><header><span class="lx-pack-tier">0${index + 1}</span><h3>${pack.name}</h3></header><p class="lx-pack-views"><strong>${pack.views}</strong><span>guaranteed views</span></p><span class="lx-pack-meter" aria-hidden="true"><i style="--s:${pack.scale}"></i></span><ul><li class="is-scope">${pack.scope}</li>${included.map(item => `<li>${item}</li>`).join('')}<li>X and LinkedIn</li></ul></article>`).join('')}</div><p class="lx-packs-note">Launch video production available as an upgrade on any package.</p>`;

export function renderLaunchPage(contact) {
  return `<section class="service-landing service-landing--launch sx-hero"><div class="service-landing-inner shell"><div class="service-landing-copy"><span class="eyebrow">VIRAL LAUNCH CAMPAIGNS</span><h1 class="route-title"><span class="title-line"><span>STRATEGIC</span></span> <span class="title-line"><span>TECH</span></span> <span class="title-line"><span><em>LAUNCHES.</em></span></span></h1><p class="service-desktop-description">Your launch video, amplified across X and LinkedIn by the creators your customers already follow. One launch drove 50,000+ sign-ups.</p><p class="service-mobile-description">Amplified across X and LinkedIn.<br>One launch drove 50,000+ sign-ups.</p>${heroActions('Get the launch deck')}</div>${serviceVisual('launch')}</div></section>`
  + trustedMarquee()
  + `<section class="sx-section shell lx-proof-section" id="launch-results" aria-labelledby="launch-results-title"><div class="section-heading lx-proof-heading"><div><span class="eyebrow">PROOF · 2026 LAUNCHES</span><h2 id="launch-results-title">Recent <em>launches.</em></h2></div></div>${launchProof()}</section>`
  + `<section class="sx-section shell" id="launch-wall" aria-labelledby="launch-wall-title">${heading('THE POSTS', 'Real launches.', 'Real views.', '', 'launch-wall-title')}${launchWall()}</section>`
  + `<section class="sx-section shell" id="launch-testimonials" aria-labelledby="launch-testimonials-title">${heading('TESTIMONIALS', 'What founders', 'say after launch.', '', 'launch-testimonials-title')}${launchTestimonials()}</section>`
  + `<section class="sx-section shell" id="launch-how" aria-labelledby="launch-how-title">${heading('HOW IT WORKS', 'Three steps.', 'Launch day.', '', 'launch-how-title')}${launchFlow()}</section>`
  + `<section class="sx-section shell" id="launch-creators" aria-labelledby="launch-creators-title"><div class="section-heading"><div><span class="eyebrow">CREATORS</span><h2 id="launch-creators-title">Creators we <em>launch with.</em></h2></div></div>${creatorStrip()}</section>`
  + `<section class="sx-section shell" id="launch-guarantee" aria-labelledby="launch-guarantee-title">${heading('OUR GUARANTEE', 'Every launch comes', 'with guaranteed views.', '', 'launch-guarantee-title')}${launchPackages()}<div class="lx-tiers-cta"><p>Pricing depends on your launch. Book a call and we’ll scope it.</p>${bookCall()}</div></section>`
  + `${contact('launch')}`;
}

/* ------------------------------------------------------------------ growth */

// SOURCES: decks/standard-campaigns/posts.py RESULTS (team feedback doc) and
// web-briefs/growth-campaigns.md section 4 (OpenAI posts sent by Sergio 2026-11-12).
// Post metrics read from SentientDash (public likes and comments, 2026-11-13);
// captions are the opening of each post's own caption.
const igPosts = {
  DWl7nJhjZgh: ['ingenia.ai', 832416, 9204, 'Apr 1, 2026', '🤯 IA recrea una pelea de UFC en medio del océano.'],
  DMI1FPEvsps: ['chatgptricks', 2028, 95, 'Jul 15, 2025', 'Surprise!'],
  DJWvGUITmGI: ['chatgptricks', 10696, 4719, 'May 7, 2025', 'Meet the God Tier AI Agent that does it all.'],
  DeZ7YfHJsoC: ['ingenia.ai', 557430, 7239, 'Oct 12, 2026', 'The Ballon d’Or Heist 🏆 Who’s taking it home this time? Made with @higgsfield.ai Seedance 2.5'],
  DdZz14knWs5: ['chatgptricks', 18792, 250, 'Sep 17, 2026', 'Higgsfield just handed builders the keys 🤯 @higgsfield.ai says it has opened access to the tech behind its AI platform.'],
  DNlYktOp8R3: ['chatgptricks', 13112, 653, 'Aug 20, 2025', 'Peep these GPT-5 🥚s.'],
  DJ_sxdnAa40: ['chatgptricks', 32990, 608, 'May 23, 2025', 'The idea was so bad, even ChatGPT said, “Hold up”. 🤣'],
  DVh2jCkgHFC: ['chatgptricks', 5714, 4977, 'Mar 5, 2026', 'ChatLLM from Abacus AI is an all-in-one platform that gives you access to ChatGPT, Claude, Grok, Gemini, DeepSeek and many more.'],
  DG3NY12vVW8: ['chatgptricks', 10319, 1590, 'Mar 6, 2025', 'ChatLLM by Abacus.AI gives you access to top LLMs like OpenAI’s o1, Google’s 2.0 Flash Thinking, Claude and Llama-3, all in one place.'],
  Db6ahVGsMuC: ['sergioprompts', 97427, 287, 'Aug 11, 2026', '🤯💍 Este podría ser uno de los regalos de boda más increíbles que hemos visto. Los amigos del novio utilizaron Higgsfield.ai.'],
  DOuYM9JjZYB: ['chatgptricks', 50670, 1049, 'Sep 18, 2025', 'Meta just turned Ray-Bans into a smartphone. At Meta Connect 2025, @zuck unveiled the Meta Ray-Ban Display.'],
  DEFL6xaRn_E: ['chatgptricks', 31678, 3883, 'Dec 27, 2024', '@nextool.ai is your ultimate AI tools hub, find and rank the best AI tools in one place.'],
  DEuYlr2ATV8: ['chatgptricks', 23555, 7532, 'Jan 12, 2025', 'Meet Wegic, your all-in-one website team. Just chat with it like you would with ChatGPT, and Wegic will build your site.'],
  DO0aKHUgCdV: ['chatgptricks', 21343, 537, 'Sep 20, 2025', 'The iPhone moment for smart glasses? Less than 48 hours ago, Meta unveiled the $799 Ray-Ban Display glasses.'],
  DcUQdVJgIbd: ['tecnologia', 14451, 249, 'Aug 21, 2026', 'Oreate Agent hace en una noche lo que a un equipo le toma toda una semana.'],
  DPklpEngMSC: ['chatgptricks', 18901, 181, 'Oct 9, 2025', 'Cristiano Ronaldo just used AI for his speech! At the Prestige Globe Awards, Ronaldo said he used Perplexity AI to prep his remarks.'],
  DZV5fOZnQJU: ['artificialntellligence', 8819, 879, 'Jun 8, 2026', 'Minecraft just got insane. @higgsfield.ai added an AI-powered building mod to Minecraft.'],
};
const n = value => value.toLocaleString('en-US');
const igIcon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${{ like: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', comment: 'M20 12a8 8 0 1 1-3.1-6.3A8 8 0 0 1 20 12zm0 0v8l-3-2.2', share: 'M21 3 10 14M21 3l-7 18-4-7-7-4z', save: 'M6 3h12v18l-6-4-6 4z' }[name]}"/></svg>`;
// Instagram post card: same post shown natively, with its public counts.
const igCard = (code, image, cls = '') => {
  const post = igPosts[code];
  if (!post) throw new Error(`Instagram post data missing: ${code}`);
  const [handle, likes, comments, date, caption] = post;
  return `<a class="gx-ig${cls}" href="https://www.instagram.com/p/${code}/" target="_blank" rel="noopener noreferrer" aria-label="Open the post by @${e(handle)} on Instagram: ${n(likes)} likes"><span class="gx-ig-top"><img src="/assets/universe/avatar-${e(handle)}.jpg" alt="" width="32" height="32" loading="lazy"><b>${e(handle)}</b><i aria-hidden="true">•••</i></span><span class="gx-ig-media"><img src="${e(image)}" alt="Post on @${e(handle)}" width="720" height="900" loading="lazy"></span><span class="gx-ig-actions">${['like', 'comment', 'share'].map(igIcon).join('')}<span class="gx-ig-save">${igIcon('save')}</span></span><span class="gx-ig-likes">${n(likes)} likes · ${n(comments)} comments</span><span class="gx-ig-caption"><b>${e(handle)}</b> ${e(caption)}</span><span class="gx-ig-date">${e(date)}</span></a>`;
};

// SOURCES: decks/standard-campaigns/posts.py RESULTS (team feedback doc) and
// web-briefs/growth-campaigns.md section 4 (OpenAI posts sent by Sergio 2026-11-12).
const growthResults = [
  { brand: 'Higgsfield', logo: 'higgsfield', big: '150M+', label: 'views', shots: ['DWl7nJhjZgh', 'DeZ7YfHJsoC', 'DdZz14knWs5'] },
  { brand: 'OpenAI', logo: 'openai', big: '15M+', label: 'views through partnerships', shots: ['DJ_sxdnAa40', 'DNlYktOp8R3', 'DMI1FPEvsps'] },
  { brand: 'Abacus', logo: 'abacus', big: '50M+', label: 'views', shots: ['DJWvGUITmGI', 'DG3NY12vVW8', 'DVh2jCkgHFC'] },
];
const resultColumn = item => `<article class="gx-result"><div class="gx-result-brand"><img src="/assets/clients/trusted/${item.logo}.png" alt="${e(item.brand)}" height="40" loading="lazy"><p class="sx-figure"><strong>${e(item.big)}</strong><span>${e(item.label)}</span></p></div><div class="gx-result-posts">${item.shots.map(code => igCard(code, `/assets/v2/growth/posts/${code}.jpg`)).join('')}</div></article>`;

// More campaign posts across our pages: the site's campaign pool (network-post-fallback.mjs).
const wallCodes = ['Db6ahVGsMuC', 'DOuYM9JjZYB', 'DEFL6xaRn_E', 'DEuYlr2ATV8', 'DO0aKHUgCdV', 'DcUQdVJgIbd', 'DPklpEngMSC', 'DZV5fOZnQJU'];
const growthWall = () => `<div class="gx-wall-head"><h3 class="gx-wall-title">More from our pages</h3></div><div class="sx-marquee gx-wall-marquee" data-marquee aria-label="More campaign posts from our pages"><ul class="sx-marquee-track">${wallCodes.map(code => {
  const post = fallbackCampaignPosts.find(item => item.shortcode === code);
  if (!post) throw new Error(`Growth wall post missing: ${code}`);
  return `<li>${igCard(code, post.image, ' gx-ig--rail')}</li>`;
}).join('')}</ul></div>`;

// The approach visual: our real account pool with the three example picks lit.
const poolHandles = ['trends', 'chatgptricks', 'tecnologia', 'theaipage', 'artificialntellligence', 'chatgptips', 'planet.ai_', 'mindset.therapy', 'sergioprompts', 'ai.excel', 'traselveloreal', 'artificialmente.ia', 'programming__india', 'em3rging', 'ainterestingupdate'];
const picks = new Set(['chatgptricks', 'artificialntellligence', 'mindset.therapy']);
const pool = () => poolHandles.map(handle => {
  const account = universeAccounts.find(item => item.handle === handle);
  if (!account) throw new Error(`Growth pool account missing: ${handle}`);
  return `<li${picks.has(handle) ? ' class="is-picked"' : ''}><img src="${e(account.avatar)}" alt="@${e(handle)}" width="56" height="56" loading="lazy">${picks.has(handle) ? '<span aria-hidden="true">✓</span>' : ''}</li>`;
}).join('');
const fan = [['DeaPs6jpywh', 'artificialntellligence'], ['De6S4W0Tr-s', 'chatgptricks'], ['Dd92T8kmekf', 'mindset.therapy']];

export function renderGrowthPage(contact) {
  const accounts = [...fallbackAccounts].sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0)).slice(0, 5);
  return `<div class="growth-content"><section class="service-landing service-landing--growth sx-hero"><div class="service-landing-inner shell"><div class="service-landing-copy"><span class="eyebrow">GROWTH CAMPAIGNS</span><h1 class="route-title"><span class="title-line"><span>ROI AND CPM</span></span> <span class="title-line"><span>DRIVEN</span></span> <span class="title-line"><span><em>CAMPAIGNS.</em></span></span></h1><p class="service-desktop-description">Guaranteed CPMs. We publish your story across a network of 30M+ followers, find the posts that perform and put ad spend behind them.</p><p class="service-mobile-description">Guaranteed CPMs.<br>Ads behind the posts that win.</p>${heroActions('Get the growth deck')}</div>${serviceVisual('growth')}</div></section>`
  + trustedMarquee()
  + `<section class="sx-section sx-section--panel" id="growth-network" aria-labelledby="growth-network-title"><div class="shell">${heading('OUR AUDIENCE', 'Pages people', 'chose to follow.', '', 'growth-network-title')}<div class="gx-figures"><div><strong>30M+</strong><h3>Owned followers</h3><p>Across Sentient’s own pages in AI, tech and business.</p></div><div><strong>1B+</strong><h3>Partner followers</h3><p>Across partner accounts on Instagram, X and LinkedIn.</p></div></div><div class="v2-owned-accounts gx-accounts gx-accounts--top">${renderAccountCards(accounts)}</div></div></section>`
  + `<section class="sx-section shell" id="growth-results" aria-labelledby="growth-results-title">`
  + `<article class="gx-case"><div class="gx-case-copy"><span class="eyebrow">RESULTS</span><h2 class="gx-case-title" id="growth-results-title"><em>Proof.</em></h2><span class="eyebrow gx-case-eyebrow">ARTISAN · “STOP HIRING HUMANS”</span><h3>One line that got San Francisco talking.</h3><dl class="gx-narrative-figures"><div><dt>1B+</dt><dd>Impressions</dd></div><div><dt>$2M+</dt><dd>New ARR</dd></div><div><dt>5→70%</dt><dd>Brand recognition in SF</dd></div></dl><p class="evidence-note">Artisan’s full campaign, including its billboards. We helped build the narrative and ran it across our network.</p></div><div class="gx-narrative-art"><img class="gx-behind gx-behind--l" src="/assets/v2/growth/posts/DDjBmpLJBlq.jpg" alt="" width="720" height="900" loading="lazy"><img class="gx-behind gx-behind--r" src="/assets/v2/growth/posts/DIWJYSwSl2J.jpg" alt="" width="720" height="900" loading="lazy"><a class="gx-ig-card" href="https://www.instagram.com/p/DD6x4v4xHyn/" target="_blank" rel="noopener noreferrer"><span class="gx-ig-head"><img src="/assets/universe/avatar-chatgptricks.jpg" alt="" width="28" height="28">chatgptricks</span><img src="/assets/DD6x4v4xHyn.jpg" alt="@chatgptricks post: “Stop Hiring Humans” ads cover San Francisco streets" width="720" height="900" loading="lazy"><span class="gx-ig-foot"><b>10.9K likes</b> · 495 comments <span>Open post ${arrow}</span></span></a></div></article>`
  + `<div class="gx-results">${growthResults.map(resultColumn).join('')}</div>`
  + `<div class="gx-wall">${growthWall()}</div></section>`
  + `<section class="sx-section shell" id="growth-approach" aria-labelledby="growth-approach-title">${heading('OUR APPROACH', 'Pick. Publish.', 'Scale the winners.', '', 'growth-approach-title')}<div class="gx-pipeline"><div class="gx-stage gx-stage--pool"><span class="sx-step-dot">1</span><h3>We pick the accounts that fit</h3><ul class="gx-pool" aria-label="Accounts in our network, with three example picks">${pool()}</ul></div><div class="gx-stage gx-stage--fan"><span class="sx-step-dot">2</span><h3>They publish your story</h3><div class="gx-fan">${fan.map(([code, handle], index) => `<img class="${index === 1 ? 'is-winner' : ''}" src="/assets/v2/growth/posts/${code}.jpg" alt="Example post on @${handle}" width="720" height="900" loading="lazy">`).join('')}</div></div><div class="gx-stage gx-stage--ads"><span class="sx-step-dot">3</span><h3>We scale the winner with ads</h3><ul class="gx-ads">${fan.map(([code], index) => `<li class="${index === 1 ? 'is-winner' : ''}"><img src="/assets/v2/growth/posts/${code}.jpg" alt="" width="48" height="60" loading="lazy"><span class="gx-ads-bar"><i style="--w:${[34, 100, 48][index]}%"></i></span>${index === 1 ? '<b>+ Ads</b>' : ''}</li>`).join('')}</ul></div></div></section>`
  + `<section class="sx-section shell" id="growth-cpm" aria-labelledby="growth-cpm-title"><div class="gx-deal"><span class="gx-deal-sticker">CPM benchmark</span><h2 id="growth-cpm-title">A CPM agreed<br><em>before launch.</em></h2><div class="gx-deal-row"><div class="gx-deal-card"><span class="gx-deal-step">01</span><strong>Your investment</strong><p>The budget for the campaign.</p></div><span class="gx-deal-op" aria-hidden="true">+</span><div class="gx-deal-card"><span class="gx-deal-step">02</span><strong>Minimum impressions</strong><p>Guaranteed across our pages.</p></div><span class="gx-deal-op" aria-hidden="true">=</span><div class="gx-deal-card gx-deal-card--cpm"><span class="gx-deal-seal">Agreed before launch</span><strong class="gx-deal-cpm">CPM</strong><p>Fixed up front. You know what your budget buys.</p></div></div>${bookCall()}</div></section>`
  + `</div>${contact('growth')}`;
}
