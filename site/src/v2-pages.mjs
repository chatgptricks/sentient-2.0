import { universeAccounts } from './universe-data.mjs';
import { servicePreview } from './service-previews.mjs';
import { escapeHtml } from './social-meta.mjs';
import { v2Campaigns } from './v2-campaigns.mjs';
import { reviseV2About } from './v2-about.mjs';
import { reviseV2Services } from './v2-services.mjs';

const routes = ['/', '/viral-launch-campaigns', '/growth-campaigns', '/about', '/universe'];
const v2Route = route => route === '/' ? '/v2/' : `/v2${route}`;
const arrow = '<span aria-hidden="true">↗</span>';
const followers = value => value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : `${Math.round(value / 1000)}K`;
const owned = universeAccounts.filter(account => account.relationship === 'owned').sort((a, b) => b.followerCount - a.followerCount).slice(0, 8);
const brands = [['OpenAI','openai'],['Meta','meta'],['Adobe','adobe'],['Higgsfield','higgsfield'],['InVideo','invideo'],['Freepik','freepik'],['Polymarket','polymarket'],['Wegic','wegic'],['Stake','stake'],['ChatGPT','chatgpt']];

const network = () => `<section class="v2-owned" id="owned-media" aria-labelledby="v2-owned-title"><div class="shell"><span class="eyebrow">OUR OWN MEDIA. YOUR ADVANTAGE.</span><div class="v2-owned-heading"><h2 id="v2-owned-title"><span>25M+</span> followers.<br><em>Our audience. Your advantage.</em></h2><div><p>We built the communities.<br>Now let’s get them talking about you.</p><a class="text-link" href="/universe">Explore our accounts ${arrow}</a></div></div><div class="v2-owned-accounts">${owned.map(account => `<a href="${account.profileUrl}" target="_blank" rel="noopener noreferrer" title="${account.followerCount.toLocaleString('en-US')} followers · ${account.followersAsOf}"><img src="${account.avatar}" alt="" width="64" height="64" loading="lazy"><strong>@${account.handle}</strong><span>${followers(account.followerCount)} followers</span></a>`).join('')}</div><p class="v2-snapshot">Selected owned accounts · individual follower snapshots, April–May 2026.</p></div></section>`;

const serviceCards = () => `<section class="services v2-services" id="services"><div class="services-heading shell"><span class="eyebrow">TWO WAYS TO GROW</span><h2 data-reveal>How we turn attention<br><em class="type-accent">into growth.</em></h2><p>Two ways to grow. One focus:<br>turning attention into customers.</p></div><div class="offer-grid shell" id="mobile-offers" data-mobile-carousel tabindex="0" aria-label="Campaign services"><a class="offer launch-offer" href="/viral-launch-campaigns"><div class="offer-top"><span class="eyebrow">LAUNCHES · RAISES · ANNOUNCEMENTS</span><span class="offer-arrow" aria-hidden="true">↗</span></div><h3>Viral launch<br><em class="type-accent">campaigns.</em></h3><div class="offer-art" aria-hidden="true">${servicePreview('launch')}</div><div class="offer-bottom"><p>One post from your founder. A coordinated wave across owned accounts and creators. Built to turn your next milestone into demos, press, and inbound.</p><span class="offer-link">Explore viral launches ${arrow}</span></div></a><a class="offer growth-offer" href="/growth-campaigns"><div class="offer-top"><span class="eyebrow">ONGOING DISTRIBUTION · CONVERSION</span><span class="offer-arrow" aria-hidden="true">↗</span></div><h3>Growth<br><em class="type-accent">campaigns.</em></h3><div class="offer-art growth-art" aria-hidden="true">${servicePreview('growth')}</div><div class="offer-bottom"><p>Publish through our owned pages and partner creators. Analyse what drives clicks and conversions. Put paid spend behind the winners to test, optimise, and scale what works.</p><span class="offer-link">Explore growth campaigns ${arrow}</span></div></a></div><div class="mobile-rail-controls" data-carousel-controls="mobile-offers"><span>Swipe to explore</span><div><button type="button" data-carousel-prev aria-label="Previous service">←</button><output data-carousel-status aria-live="polite">1 of 2</output><button type="button" data-carousel-next aria-label="Next service">→</button></div></div></section>`;

const clientCarousel = () => `<section class="client-proof v2-client-carousel" aria-labelledby="v2-clients-title"><div class="client-proof-heading shell"><span class="eyebrow" id="v2-clients-title">IN GOOD COMPANY.</span><p>Ambitious brands. Shared ambition.</p><div class="v2-client-controls"><button type="button" data-client-prev aria-label="Previous client logos">←</button><button type="button" data-client-next aria-label="Next client logos">→</button></div></div><div class="v2-client-viewport" tabindex="0" role="region" aria-label="Client logos. Drag, swipe, or use the arrow keys."><ul class="v2-client-track">${brands.map(([name,slug]) => `<li class="v2-client-logo"><img src="/assets/clients/client-${slug}.png" alt="${name}" width="180" height="60" draggable="false" loading="lazy"></li>`).join('')}</ul></div><div class="v2-client-caption shell"><span>Drag or swipe to explore</span><output data-client-status aria-live="polite" aria-atomic="true">Clients 1–5 of 10</output></div></section>`;

const receipts = () => `<section class="v2-receipts shell" id="campaign-wall" aria-labelledby="v2-receipts-title"><div class="v2-section-heading"><div><span class="eyebrow">SELECTED CAMPAIGNS</span><h2 id="v2-receipts-title">The <em class="type-accent">receipts.</em></h2></div><p>Campaigns across<br>our owned accounts.</p></div><div class="v2-post-grid">${v2Campaigns.map(campaign => `<a class="v2-post" href="${campaign.source}" target="_blank" rel="noopener noreferrer" aria-label="View ${escapeHtml(campaign.client)} campaign by @${escapeHtml(campaign.handle)}"><div class="v2-post-image"><img src="${campaign.image}" alt="${escapeHtml(campaign.alt)}" width="720" height="960" loading="lazy" decoding="async"><span>${arrow}</span></div><div class="v2-post-caption"><strong>${escapeHtml(campaign.client)}</strong><span>@${escapeHtml(campaign.handle)}</span></div></a>`).join('')}</div></section>`;


function replaceSection(html, className, replacement) {
  const pattern = new RegExp(`<section class="${className}[^\"]*"[\\s\\S]*?<\\/section>`);
  if (!pattern.test(html)) throw new Error(`V2 source section missing: ${className}`);
  return html.replace(pattern, () => replacement);
}

function pageStyles(page) {
  const files = ['styles.css','art-direction.css','brand-proof.css'];
  if (['launch','growth'].includes(page)) files.push('service-fields.css');
  if (page === 'about') files.push('about-story.css');
  if (page === 'universe') files.push('universe-polish.css');
  files.push('refinement.css','mobile-experience.css','motion.css','v2.css');
  if (page === 'about') files.push('v2-about.css');
  return `<link rel="preload" href="/assets/lovelo-black.woff2" as="font" type="font/woff2" crossorigin>${files.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}<script type="module" src="/app.js"></script><script type="module" src="/mobile.js"></script><script type="module" src="/js/motion.js"></script><script type="module" src="/v2-interactions.js"></script>`;
}

export function createV2Pages(originalPages) {
  return Object.fromEntries(Object.entries(originalPages).map(([route, original]) => {
    const page = original.match(/<body data-page="([^"]+)"/)[1];
    // Selected work has no requested edits. Protect its full markup even when
    // applying shared copy rules to the rest of the V2 documents.
    const protectedWork = page === 'home' ? original.match(/<section\b(?=[^>]*\bid="work")[^>]*>[\s\S]*?<\/section>/)?.[0] : null;
    const workMarker = '<!-- preserve-original-selected-work -->';
    let html = protectedWork ? original.replace(protectedWork, workMarker) : original;
    // V2 has its own document and navigation. V1 and its notes remain untouched.
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
      html = html.replace(/<p>An agency with its own audience\.[\s\S]*?<\/p>/, '<p><strong class="v2-inline-number">25M+</strong> followers in owned media.<br><span>We’re not just an agency. We’re a media company, connecting your next launch to our own audiences.</span></p>');
      html = html.replace(/<aside class="owned-proof shell"[\s\S]*?<\/aside>/, '');
      html = replaceSection(html, 'services', `${network()}${serviceCards()}`);
      html = replaceSection(html, 'client-proof', clientCarousel());
      html = replaceSection(html, 'campaign-wall', receipts());
    }
    if (page === 'launch') {
      html = html.replace('A product launch. A funding round. A big announcement. Turn your next milestone into a story that travels.', 'A launch, funding round, or announcement. One post from your founder, coordinated distribution through our owned accounts and creators, and a campaign built for demos, press, and inbound.');
      html = html.replace('Your next milestone.<br>A story that travels.', 'One founder post.<br>A coordinated campaign wave.');
      html = html.replace('Shape a founder post and supporting creative for your launch.', 'We script and structure the post. Your founder publishes it after you approve every word.');
    }
    if (page === 'growth') {
      html = html.replace('Your ongoing distribution partner. We bring product drops to our owned audiences and creator partners, then track what turns attention into action.', 'Your ongoing distribution partner. Publish through owned pages and partner creators, find what drives clicks and conversions, then amplify the winners with paid ads.');
      html = html.replace('Your product. Our audience.<br>Build momentum with every campaign.', 'Publish. Learn. Scale.<br>Owned media, creators, and paid amplification.');
      html = html.replace('Find the creative that drives engagement, clicks, and conversions.', 'Find what drives clicks and conversions, then amplify the winners with paid ads.');
      html = html.replace(/(<div class="growth-steps">[\s\S]*?<\/section>)/, block => block.replace(/<span>0\d<\/span>/g, ''));
    }
    html = reviseV2Services(html, page);
    if (page === 'about') html = reviseV2About(html);
    // Keep every page-to-page journey inside V2, including Universe's call link.
    html = html.replace(/\bhref="(\/[^"\s]*)"/g, (match, url) => {
      const [path, suffix = ''] = url.match(/^([^?#]*)(.*)$/).slice(1);
      return routes.includes(path) ? `href="${v2Route(path)}${suffix}"` : match;
    });
    html = html.replace(/<body data-page="([^"]+)"/, '<body data-version="v2" data-page="$1"');
    html = html.replace(/<title>([\s\S]*?)<\/title>/, '<title>$1 · V2</title>');
    const originalCanonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    const routeSuffix = route === '/' ? '/' : `${route}/`;
    const versionCanonical = `${originalCanonical.slice(0, -routeSuffix.length)}${v2Route(route).replace(/\/$/, '')}/`;
    html = html.replace(`rel="canonical" href="${originalCanonical}"`, `rel="canonical" href="${versionCanonical}"`);
    html = html.replace(`property="og:url" content="${originalCanonical}"`, `property="og:url" content="${versionCanonical}"`);
    // Remove the Home deck bootstrap and all inherited runtime styles/scripts.
    // The original Home keeps its presentation router; V2 loads the website directly.
    html = html.replace(/<link rel="icon"[\s\S]*?<\/head>/, `<link rel="icon" href="/favicon.svg" type="image/svg+xml">${pageStyles(page)}${page === 'universe' ? '<script type="module" src="/js/universe.js"></script>' : ''}</head>`);
    const originalHref = route;
    const comparison = `<aside class="v2-comparison" aria-label="Website version"><span>V2 <span>· Updated proposal</span></span><a href="${originalHref}">View V1 ${arrow}</a></aside>`;
    html = html.replace('<button class="menu-toggle"', `${comparison}<button class="menu-toggle"`);
    if (protectedWork) html = html.replace(workMarker, protectedWork);
    return [v2Route(route), html];
  }));
}
