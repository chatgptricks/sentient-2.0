import { fallbackAccounts } from './network-fallback.mjs';
import { renderAccountCards, renderCampaignCards } from './network-markup.mjs';
import { renderUniverse } from './universe-page.mjs';
import { selectCampaignPosts } from '../public/network-data.js';
import { servicePreview } from './service-previews.mjs';
import { escapeHtml } from './social-meta.mjs';
import { fallbackCampaignPosts } from './network-post-fallback.mjs';
import { reviseV2About } from './v2-about.mjs';
import { trustedMarquee } from './client-carousel.mjs';
import { testimonialsStrip } from './service-pages.mjs';

const routes = ['/', '/viral-launch-campaigns', '/growth-campaigns', '/about', '/universe'];
const v2Route = route => route === '/' ? '/v2/' : `/v2${route}`;
const arrow = '<span aria-hidden="true">↗</span>';

// All of Sentient's own pages as an auto-scrolling strip (Sergio, 2026-11-16).
export const ownedCards = accounts => accounts.filter(account => !account.relationship || account.relationship === 'owned').map(account => `<li>${renderAccountCards([account])}</li>`).join('');
// X and LinkedIn tabs: top 10 AI / tech / finance accounts in our network, from
// the master network sheet (19FL106cy79tkCnY4XYRJJq2QN0wDWCJiPz4V5J0AZDI, tabs X
// and Linkedin, read 2026-11-16). Meme, politics and parody accounts left out.
// Only names, handles and followers are used.
const xTop = [['unusual_whales', '5.4M'], ['litcapital', '1.6M'], ['AIHighlight', '626K'], ['svpino', '603K'], ['AriaWestcott', '551K'], ['aaditsh', '519K'], ['hasantoxr', '437K'], ['AIFrontliner', '426K'], ['FutureStacked', '292K'], ['alex_prompter', '283K']];
const liTop = [['Steve Nouri', 'stevenouri', '1.7M'], ['Pascal Bornet', 'pascalbornet', '1.5M'], ['Alex Wang', 'alexwang2911', '1.2M'], ['Justin Wright', 'jwmba', '745K'], ['Dr. Joerg Storm', 'joergstorm', '724K'], ['Paul Storm', 'paul-storm', '673K'], ['Aishwarya Srinivasan', 'aishwarya-srinivasan', '655K'], ['Olawale Kolawole', 'olawale-kolawole-751a3514', '540K'], ['Neo Kim', 'nk-systemdesign-one', '379K'], ['Hina Arora', 'careerwithhina', '327K']];
const xAvatars = new Set(['unusual_whales', 'litcapital', 'AIHighlight', 'svpino', 'aaditsh', 'hasantoxr', 'AIFrontliner', 'FutureStacked', 'alex_prompter']);
const initials = name => name.replace(/^Dr\. /, '').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
const netCard = (url, label, followers, avatar, name) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${avatar ? `<img src="${avatar}" alt="" width="48" height="48" loading="lazy">` : `<span class="v2-account-initials" aria-hidden="true">${initials(name)}</span>`}<strong>${escapeHtml(label)}</strong><span class="v2-account-count"><b>${followers}</b><small>followers</small></span></a></li>`;
const xStrip = () => xTop.map(([handle, followers]) => netCard(`https://x.com/${handle}`, `@${handle}`, followers, xAvatars.has(handle) ? `/assets/v2/launch/avatars/${handle}.jpg` : '', handle)).join('');
const liStrip = () => liTop.map(([name, slug, followers]) => netCard(`https://www.linkedin.com/in/${slug}/`, name, followers, '', name)).join('');
const networkTabs = () => `<div class="v2-net-tabs"><input type="radio" name="v2-net" id="v2-net-ig" checked><input type="radio" name="v2-net" id="v2-net-x"><input type="radio" name="v2-net" id="v2-net-li"><div class="v2-net-switch" role="group" aria-label="Choose a network"><label for="v2-net-ig">Instagram</label><label for="v2-net-x">X</label><label for="v2-net-li">LinkedIn</label></div><div class="v2-net-pane v2-net-pane--ig"><div class="sx-marquee v2-owned-marquee" data-marquee aria-label="Sentient’s own Instagram pages"><ul class="sx-marquee-track v2-owned-accounts">${ownedCards(fallbackAccounts)}</ul></div></div><div class="v2-net-pane v2-net-pane--x"><div class="sx-marquee v2-owned-marquee" data-marquee aria-label="Top accounts in our X network"><ul class="sx-marquee-track v2-owned-accounts">${xStrip()}</ul></div></div><div class="v2-net-pane v2-net-pane--li"><div class="sx-marquee v2-owned-marquee" data-marquee aria-label="Top accounts in our LinkedIn network"><ul class="sx-marquee-track v2-owned-accounts">${liStrip()}</ul></div></div></div>`;
const network = () => `<section class="v2-owned" id="owned-media" aria-labelledby="v2-owned-title" data-network-source="fallback"><div class="shell"><div class="v2-owned-heading"><h2 id="v2-owned-title"><span>30M+</span> followers.<br><em>Our audience. Your advantage.</em></h2><div><p>We built the communities.<br>Now let’s get them talking about you.</p><a class="text-link" href="/universe">Explore our accounts ${arrow}</a></div></div>${networkTabs()}<p class="v2-snapshot">All our own pages · latest saved follower figures.</p></div><script type="application/json" id="network-fallback-data">${JSON.stringify(fallbackAccounts).replace(/</g, '\\u003c')}</script></section>`;

// Simplified versions of each service page's process panel (Sergio, 2026-11-16).
const LA = '/assets/v2/launch/avatars/';
const stack = srcs => `<span class="mini-stack">${srcs.map(src => `<img src="${src}" alt="" width="36" height="36" loading="lazy">`).join('')}</span>`;
const miniStep = (n, title, visual) => `<li class="mini-step"><span class="mini-dot">${n}</span><b>${title}</b>${visual}</li>`;
const miniLaunch = () => `<ol class="mini-flow">${miniStep(1, 'We pick the creators', stack(['NoContextHumans', 'hasantoxr', 'heyalexmoore', 'heyadam_ai', 'Shruti_0810'].map(h => `${LA}${h}.jpg`)))}${miniStep(2, 'They post on launch day', '<span class="mini-post"><img src="/assets/v2/launch/wall/alex-avatar.jpg" alt="" width="28" height="28" loading="lazy"><span>Founder post<br><em>+72 quote posts</em></span></span>')}${miniStep(3, 'You get views and sign-ups', '<span class="mini-figure"><strong>1.3M+</strong><small>views on X</small></span>')}</ol>`;
const miniGrowth = () => `<ol class="mini-flow">${miniStep(1, 'We pick the accounts', stack(['chatgptricks', 'artificialntellligence', 'traselveloreal', 'ai.excel', 'tecnologia'].map(h => `/assets/universe/avatar-${h}.jpg`)))}${miniStep(2, 'They publish your story', `<span class="mini-thumbs">${['DeaPs6jpywh', 'De6S4W0Tr-s', 'DeBCCQBDinR'].map((c, i) => `<img${i === 1 ? ' class="is-win"' : ''} src="/assets/v2/growth/posts/${c}.jpg" alt="" width="40" height="50" loading="lazy">`).join('')}</span>`)}${miniStep(3, 'We scale the winner with ads', '<span class="mini-bars"><i style="--w:35%"></i><i class="is-win" style="--w:100%"></i><i style="--w:50%"></i></span>')}</ol>`;
// Home service cards open to show each service's process (Sergio, 2026-11-16).
const offerProcess = (flow, href, label) => `<details class="offer-process"><summary><span>How it works?</span><b aria-hidden="true">+</b></summary><div class="offer-process-body">${flow}<a class="button offer-process-cta" href="${href}"><span>${label}</span></a></div></details>`;
const serviceCards = () => `<section class="services v2-services" id="services"><div class="services-heading shell"><span class="eyebrow">TWO WAYS TO GROW</span><h2 data-reveal>How we turn attention<br><em class="type-accent">into growth.</em></h2><p>Two ways to grow. One focus:<br>turning attention into customers.</p></div><div class="offer-grid shell" id="mobile-offers" data-mobile-carousel tabindex="0" aria-label="Campaign services"><div class="offer launch-offer"><a class="offer-cover" href="/viral-launch-campaigns" aria-label="Viral launch campaigns"></a><div class="offer-top"><span class="eyebrow">LAUNCHES · RAISES · ANNOUNCEMENTS</span><span class="offer-arrow" aria-hidden="true">↗</span></div><h3>Viral launch<br><em class="type-accent">campaigns.</em></h3><div class="offer-art" aria-hidden="true">${servicePreview('launch')}</div><div class="offer-bottom"><p>One post from your founder. A coordinated wave across owned accounts and creators. Built to turn your next milestone into demos, press, and inbound.</p><a class="offer-link" href="/viral-launch-campaigns">Explore viral launches ${arrow}</a></div>${offerProcess(miniLaunch(), "/viral-launch-campaigns", "See viral launch campaigns")}</div><div class="offer growth-offer"><a class="offer-cover" href="/growth-campaigns" aria-label="Growth campaigns"></a><div class="offer-top"><span class="eyebrow">ONGOING DISTRIBUTION · CONVERSION</span><span class="offer-arrow" aria-hidden="true">↗</span></div><h3>Growth<br><em class="type-accent">campaigns.</em></h3><div class="offer-art growth-art" aria-hidden="true">${servicePreview('growth')}</div><div class="offer-bottom"><p>Publish through our owned pages and partner creators. Analyse what drives clicks and conversions. Put paid spend behind the winners to test, optimise, and scale what works.</p><a class="offer-link" href="/growth-campaigns">Explore growth campaigns ${arrow}</a></div>${offerProcess(miniGrowth(), "/growth-campaigns", "See growth campaigns")}</div></div><div class="mobile-rail-controls" data-carousel-controls="mobile-offers"><span>Swipe to explore</span><div><button type="button" data-carousel-prev aria-label="Previous service">←</button><output data-carousel-status aria-live="polite">1 of 2</output><button type="button" data-carousel-next aria-label="Next service">→</button></div></div></section>`;


const receipts = () => `<section class="v2-receipts shell" id="campaign-wall" data-network-source="fallback" aria-labelledby="v2-receipts-title"><div class="v2-section-heading"><div><h2 id="v2-receipts-title">The <em class="type-accent">receipts.</em></h2></div><p>Campaigns across<br>our owned accounts.</p></div><div class="v2-post-grid">${renderCampaignCards(selectCampaignPosts(fallbackCampaignPosts, 5, () => .5))}</div><script type="application/json" id="campaign-fallback-data">${JSON.stringify(fallbackCampaignPosts).replace(/</g, '\\u003c')}</script></section>`;


// Selected work (Sergio, 2026-11-13): the cases stay as they were, but the post
// becomes a premium "legendary" post card and "Behind the number" goes. The
// impressions come from that removed note (historical @chatgptricks export).
const workImpressions = { 'DXcsyzygKkg': '330,043', 'DOyiTPLAPCv': '605,574' };
function legendaryWork(section) {
  return section
    .replace('<h2 data-reveal>Attention.<br><em class="type-accent">Earned.</em></h2>', '<h2 data-reveal>The <em class="type-accent">receipts.</em></h2>')
    .replace(/<details class="case-evidence">[\s\S]*?<\/details>/g, '')
    .replace(/<img src="\/assets\/(DXcsyzygKkg|DOyiTPLAPCv)\.jpg"([^>]*)>/g, (match, code, attrs) => `<span class="lg-card"><span class="lg-card-top"><img src="/assets/universe/avatar-chatgptricks.jpg" alt="" width="34" height="34" loading="lazy"><span><b>chatgptricks</b><small>Instagram</small></span><i class="lg-badge">✦ Top post</i></span><span class="lg-card-media"><img src="/assets/${code}.jpg"${attrs}></span><span class="lg-card-foot"><b>${workImpressions[code]}</b> impressions</span><span class="lg-card-shine" aria-hidden="true"></span></span>`);
}

function replaceSection(html, className, replacement) {
  const pattern = new RegExp(`<section class="${className}[^\"]*"[\\s\\S]*?<\\/section>`);
  if (!pattern.test(html)) throw new Error(`V2 source section missing: ${className}`);
  return html.replace(pattern, () => replacement);
}

function simplifyLabels(html) {
  const redundant = new Set([
    'OUR OWN MEDIA. YOUR ADVANTAGE.', 'TWO WAYS TO GROW',
    'LAUNCHES · RAISES · ANNOUNCEMENTS', 'ONGOING DISTRIBUTION · CONVERSION',
    'SELECTED CAMPAIGNS', 'THE NEXT BIG THING COULD BE YOURS.',
    'THE PEOPLE BEHIND SENTIENT', 'BEYOND THE FEED',
    'A DIFFERENT WAY TO EXPLORE', 'BUILD. DISTRIBUTE. LEARN. REPEAT.',
    'THE SENTIENT NETWORK / INTERACTIVE ATLAS',
  ]);
  return html
    .replace(/<div class="hero-topline shell">[\s\S]*?<\/div>/, '')
    .replace(/<span class="hero-kicker">[^<]*<\/span>/, '')
    .replace(/<span class="hero-art-label"[^>]*>[^<]*<\/span>/, '')
    .replace(/(<div class="hero-foot shell">)<span>[\s\S]*?DISTRIBUTION<\/span>/, '$1')
    .replace(/(<div class="service-landing-footer">)<span>[^<]*<\/span>/, '$1')
    .replace(/<(span|small)\b[^>]*\bclass="[^"]*\beyebrow\b[^"]*"[^>]*>([^<]*)<\/\1>/g, (markup, _tag, text) => redundant.has(text.trim()) ? '' : markup)
    .replace(/(<ol class="process-grid">[\s\S]*?<\/ol>)/, block => block.replace(/<span>THE (?:ANGLE|POST|NETWORK|FOLLOW-THROUGH)<\/span>/g, ''))
    .replace('<span>GOOD PRODUCTS.<br>UNREASONABLE AMBITION.</span>', '')
    .replace('<span>CREATIVITY × DISTRIBUTION</span>', '')
    .replace('<span>THE CONSTELLATION</span>', '<span>Accounts</span>');
}

function pageStyles(page) {
  const files = ['styles.css','art-direction.css','brand-proof.css'];
  if (['launch','growth'].includes(page)) files.push('service-fields.css', 'service-pages.css');
  if (page === 'about') files.push('about-story.css', 'service-pages.css');
  if (page === 'universe') files.push('universe-polish.css');
  files.push('refinement.css','mobile-experience.css','motion.css','v2.css','comments.css');
  if (page === 'about') files.push('v2-about.css');
  return `<link rel="preload" href="/assets/lovelo-black.woff2" as="font" type="font/woff2" crossorigin>${files.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}<script type="module" src="/comments.js"></script><script type="module" src="/app.js"></script><script type="module" src="/mobile.js"></script><script type="module" src="/js/motion.js"></script><script type="module" src="/v2-interactions.js"></script>`;
}

export function createV2Pages(originalPages, { primary = false } = {}) {
  return Object.fromEntries(Object.entries(originalPages).map(([route, original]) => {
    const page = original.match(/<body data-page="([^"]+)"/)[1];
    // Selected work has no requested edits. Protect its full markup even when
    // applying shared copy rules to the rest of the V2 documents.
    const protectedWork = page === 'home' ? original.match(/<section\b(?=[^>]*\bid="work")[^>]*>[\s\S]*?<\/section>/)?.[0] : null;
    const workMarker = '<!-- preserve-original-selected-work -->';
    let html = protectedWork ? original.replace(protectedWork, workMarker) : original;
    // Keep the original document as the internal baseline for shared revisions.
    html = html.replace(/<span class="header-note">[\s\S]*?<\/span>/, '');
    html = html.replace(/<span class="section-index">[^<]*<\/span>/g, '');
    html = html.replace(/>0\d \/ ([^<]+)</g, '>$1<');
    html = html.replace('<span class="step-number">01</span>', '');
    html = html.replaceAll('Get a campaign plan', 'Free strategy call')
      .replaceAll('Get a launch plan', 'Free strategy call')
      .replaceAll('Get a distribution plan', 'Free strategy call')
      .replace('Start a project <span', 'Free strategy call <span')
      .replace('Let’s make something move.</a>', 'Free strategy call.</a>')
      .replace('Tell us what you’re building. Let’s find the right story, audience, and campaign for it.', 'Tell us what you’re building. On your free strategy call, we’ll explore the right story, audience, and campaign for it.')
      .replace('Share your brief.<br><span>Then we shape your campaign plan together.</span>', 'Request your free strategy call.<br><span>Share a little context so we can prepare.</span>')
      .replace(/(<button class="button form-submit" type="submit">)Free strategy call(<\/button>)/, '$1Request a free strategy call$2');
    if (page === 'home') {
      html = html.replace('<span>01 / SENTIENT</span>', '<span>SENTIENT</span>');
      html = html.replace(/<p>An agency with its own audience\.[\s\S]*?<\/p>/, `<p><strong class="v2-inline-number">30M+</strong> followers across our network.<br><span>We’re not just an agency. We’re a media company, connecting your next launch to our own audiences.</span></p>`);
      html = html.replace(/<aside class="owned-proof shell"[\s\S]*?<\/aside>/, '');
      // Sergio, 2026-11-16: client logos above the pages, pages as a strip, no receipts wall.
      html = replaceSection(html, 'services', `${trustedMarquee()}${network()}${serviceCards()}`);
      html = replaceSection(html, 'client-proof', '');
      html = replaceSection(html, 'campaign-wall', `<section class="sx-section shell sx-testimonials" id="testimonials" aria-labelledby="testimonials-title"><div class="section-heading"><div><span class="eyebrow">TESTIMONIALS</span><h2 id="testimonials-title">What our <em>clients say.</em></h2></div></div>${testimonialsStrip()}</section>`);
    }
    if (page === 'about') html = reviseV2About(html);
    if (page === 'universe') {
      html = replaceSection(html, 'universe-app', renderUniverse(fallbackAccounts, { source: 'pending' }));
      html = html.replaceAll('Explore all 31 Sentient owned and partner Instagram accounts in an interactive 3D universe.', 'Explore Sentient accounts and their latest available follower figures in an interactive 3D universe.');
    }
    html = simplifyLabels(html);
    // Preview links stay under V2; the primary site keeps canonical routes.
    html = html.replace(/\bhref="(\/[^"\s]*)"/g, (match, url) => {
      const [path, suffix = ''] = url.match(/^([^?#]*)(.*)$/).slice(1);
      return !primary && routes.includes(path) ? `href="${v2Route(path)}${suffix}"` : match;
    });
    html = html.replace(/<body data-page="([^"]+)"/, '<body data-version="v2" data-page="$1"');
    if (!primary) {
      html = html.replace(/<title>([\s\S]*?)<\/title>/, '<title>$1 · V2</title>');
      const originalCanonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
      const routeSuffix = route === '/' ? '/' : `${route}/`;
      const versionCanonical = `${originalCanonical.slice(0, -routeSuffix.length)}${v2Route(route).replace(/\/$/, '')}/`;
      html = html.replace(`rel="canonical" href="${originalCanonical}"`, `rel="canonical" href="${versionCanonical}"`);
      html = html.replace(`property="og:url" content="${originalCanonical}"`, `property="og:url" content="${versionCanonical}"`);
    }
    // The primary Home keeps the hash router for presentations and Studio.
    // Its website branch loads the current styles/scripts using data-version.
    if (!(primary && page === 'home')) {
      html = html.replace(/<link rel="icon"[\s\S]*?<\/head>/, `<link rel="icon" href="/favicon.svg" type="image/svg+xml">${pageStyles(page)}${page === 'universe' ? '<script type="module" src="/js/universe.js"></script>' : ''}</head>`);
    }
    html = html.replace('</head>', '<link rel="sentient-api" href="/comments-config.json"></head>');
    if (protectedWork) html = html.replace(workMarker, legendaryWork(protectedWork));
    return [primary ? route : v2Route(route), html];
  }));
}
