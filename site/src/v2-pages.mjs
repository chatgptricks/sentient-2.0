import { fallbackAccounts } from './network-fallback.mjs';
import { renderAccountCards, renderCampaignCards } from './network-markup.mjs';
import { renderUniverse } from './universe-page.mjs';
import { selectCampaignPosts } from '../public/network-data.js';
import { servicePreview } from './service-previews.mjs';
import { escapeHtml } from './social-meta.mjs';
import { fallbackCampaignPosts } from './network-post-fallback.mjs';
import { reviseV2About } from './v2-about.mjs';
import { trustedMarquee } from './client-carousel.mjs';

const routes = ['/', '/viral-launch-campaigns', '/growth-campaigns', '/about', '/universe'];
const v2Route = route => route === '/' ? '/v2/' : `/v2${route}`;
const arrow = '<span aria-hidden="true">↗</span>';

const network = () => `<section class="v2-owned" id="owned-media" aria-labelledby="v2-owned-title" data-network-source="fallback"><div class="shell"><div class="v2-owned-heading"><h2 id="v2-owned-title"><span>30M+</span> followers.<br><em>Our audience. Your advantage.</em></h2><div><p>We built the communities.<br>Now let’s get them talking about you.</p><a class="text-link" href="/universe">Explore our accounts ${arrow}</a></div></div><div class="v2-owned-accounts">${renderAccountCards(fallbackAccounts.slice(0, 10))}</div><p class="v2-snapshot">Selected owned accounts · latest saved follower figures.</p></div><script type="application/json" id="network-fallback-data">${JSON.stringify(fallbackAccounts).replace(/</g, '\\u003c')}</script></section>`;

const serviceCards = () => `<section class="services v2-services" id="services"><div class="services-heading shell"><span class="eyebrow">TWO WAYS TO GROW</span><h2 data-reveal>How we turn attention<br><em class="type-accent">into growth.</em></h2><p>Two ways to grow. One focus:<br>turning attention into customers.</p></div><div class="offer-grid shell" id="mobile-offers" data-mobile-carousel tabindex="0" aria-label="Campaign services"><a class="offer launch-offer" href="/viral-launch-campaigns"><div class="offer-top"><span class="eyebrow">LAUNCHES · RAISES · ANNOUNCEMENTS</span><span class="offer-arrow" aria-hidden="true">↗</span></div><h3>Viral launch<br><em class="type-accent">campaigns.</em></h3><div class="offer-art" aria-hidden="true">${servicePreview('launch')}</div><div class="offer-bottom"><p>One post from your founder. A coordinated wave across owned accounts and creators. Built to turn your next milestone into demos, press, and inbound.</p><span class="offer-link">Explore viral launches ${arrow}</span></div></a><a class="offer growth-offer" href="/growth-campaigns"><div class="offer-top"><span class="eyebrow">ONGOING DISTRIBUTION · CONVERSION</span><span class="offer-arrow" aria-hidden="true">↗</span></div><h3>Growth<br><em class="type-accent">campaigns.</em></h3><div class="offer-art growth-art" aria-hidden="true">${servicePreview('growth')}</div><div class="offer-bottom"><p>Publish through our owned pages and partner creators. Analyse what drives clicks and conversions. Put paid spend behind the winners to test, optimise, and scale what works.</p><span class="offer-link">Explore growth campaigns ${arrow}</span></div></a></div><div class="mobile-rail-controls" data-carousel-controls="mobile-offers"><span>Swipe to explore</span><div><button type="button" data-carousel-prev aria-label="Previous service">←</button><output data-carousel-status aria-live="polite">1 of 2</output><button type="button" data-carousel-next aria-label="Next service">→</button></div></div></section>`;


const receipts = () => `<section class="v2-receipts shell" id="campaign-wall" data-network-source="fallback" aria-labelledby="v2-receipts-title"><div class="v2-section-heading"><div><h2 id="v2-receipts-title">The <em class="type-accent">receipts.</em></h2></div><p>Campaigns across<br>our owned accounts.</p></div><div class="v2-post-grid">${renderCampaignCards(selectCampaignPosts(fallbackCampaignPosts, 5, () => .5))}</div><script type="application/json" id="campaign-fallback-data">${JSON.stringify(fallbackCampaignPosts).replace(/</g, '\\u003c')}</script></section>`;


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
      html = replaceSection(html, 'services', `${network()}${serviceCards()}`);
      html = replaceSection(html, 'client-proof', trustedMarquee());
      html = replaceSection(html, 'campaign-wall', receipts());
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
    if (protectedWork) html = html.replace(workMarker, protectedWork);
    return [primary ? route : v2Route(route), html];
  }));
}
