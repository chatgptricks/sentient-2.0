// About page, rebuilt after the service pages (Sergio, 2026-11-13). Same rules:
// only sourced figures. 30M+ owned followers (site-wide figure, Louis 2026-11-13),
// 750+ brands and 1B+ monthly impressions (Launch Amplification deck, slide 7),
// 50,000+ sign-ups (Lotus AI, Louis's feedback) and 150M+ Higgsfield views (team
// feedback doc). Founder names, roles and bios from about-content.mjs
// (sentientagency.io/what-we-do, verified 2026-10-04).
import { trustedMarquee } from './client-carousel.mjs';
import { renderAccountCards } from './network-markup.mjs';
import { fallbackAccounts } from './network-fallback.mjs';
import { universeAccounts } from './universe-data.mjs';
import { creatorStrip } from './service-pages.mjs';

const avatar = handle => universeAccounts.find(item => item.handle === handle)?.avatar;
// Hero mosaic: real avatars from our own pages and the creators we launch with.
const mosaic = [
  ['img', avatar('chatgptricks'), true], ['img', '/assets/v2/launch/avatars/NoContextHumans.jpg'], ['img', avatar('artificialntellligence')], ['img', '/assets/v2/launch/avatars/hasantoxr.jpg', true],
  ['img', avatar('traselveloreal')], ['stat', '30M+', 'followers on our own pages'], ['img', avatar('ai.excel')],
  ['img', '/assets/v2/launch/avatars/heyalexmoore.jpg'], ['img', avatar('sergioprompts'), true], ['img', avatar('planet.ai_')], ['img', '/assets/v2/launch/avatars/heyadam_ai.jpg'],
  ['img', avatar('chatgptips')], ['img', '/assets/v2/launch/avatars/Shruti_0810.jpg', true], ['img', avatar('em3rging')], ['img', '/assets/v2/launch/avatars/jaysmith_ai.jpg'],
];
const heroMosaic = () => `<div class="ab-mosaic" aria-hidden="true">${mosaic.map(([kind, a, b]) => kind === 'stat'
  ? `<span class="ab-mosaic-stat"><strong>${a}</strong><small>${b}</small></span>`
  : `<span class="ab-mosaic-face${b ? ' is-lit' : ''}"><img src="${a}" alt="" width="96" height="96" loading="lazy"></span>`).join('')}</div>`;

const services = [
  { href: '/viral-launch-campaigns', eyebrow: 'VIRAL LAUNCH CAMPAIGNS', title: 'Strategic tech launches.', text: 'Your launch video, amplified across X and LinkedIn by the creators your customers already follow.', stat: ['50,000+', 'sign-ups from one launch'], media: '/assets/v2/launch/wall/kj-media.jpg', cta: 'See viral launches' },
  { href: '/growth-campaigns', eyebrow: 'GROWTH CAMPAIGNS', title: 'ROI and CPM driven campaigns.', text: 'We publish your story across our pages, find the posts that perform and put ad spend behind them.', stat: ['150M+', 'views for Higgsfield'], media: '/assets/v2/growth/posts/DeZ7YfHJsoC.jpg', cta: 'See growth campaigns' },
];
const serviceCard = item => `<a class="ab-service" href="${item.href}"><span class="ab-service-media"><img src="${item.media}" alt="" width="720" height="900" loading="lazy"></span><span class="ab-service-copy"><span class="eyebrow">${item.eyebrow}</span><strong class="ab-service-title">${item.title}</strong><span class="ab-service-text">${item.text}</span><span class="ab-service-stat"><b>${item.stat[0]}</b>${item.stat[1]}</span><span class="ab-service-cta">${item.cta} <span aria-hidden="true">→</span></span></span></a>`;

const founders = [
  { id: 'ivan', name: 'Ivan', role: 'Co-founder · AI specialist', portrait: '/assets/founders/ivan-cutout.webp', href: 'https://www.linkedin.com/in/ivanelgrande/',
    bio: 'Ivan founded @chatgptricks, built digital communities, and developed and sold an AI newsletter business. At Sentient, he works with Louis on the strategies and growth systems behind client campaigns.',
    moment: ['/assets/v2/people/ivan-meta-event.png', 'On screen during a presentation by Mark Zuckerberg.'] },
  { id: 'louis', name: 'Louis Gleeson', role: 'Co-founder · Growth strategist', portrait: '/assets/founders/louis-cutout.webp', href: 'https://www.linkedin.com/in/louis-gleeson-a86144211/',
    bio: 'Louis is a social media and growth strategist who has built and sold Instagram brands. Before co-founding Sentient, he also helped build a Web3 marketing agency.',
    moment: ['/assets/v2/people/louis-nathan-lyon.png', 'In conversation with cricketer Nathan Lyon.'] },
];
const founderCard = f => `<article class="ab-founder" aria-labelledby="ab-founder-${f.id}"><figure class="ab-founder-portrait"><img src="${f.portrait}" alt="${f.name}, Sentient co-founder" width="640" height="640" loading="lazy"></figure><div class="ab-founder-copy"><span class="eyebrow">${f.role}</span><h3 id="ab-founder-${f.id}">${f.name}</h3><p>${f.bio}</p><figure class="ab-moment"><img src="${f.moment[0]}" alt="" width="510" height="510" loading="lazy"><figcaption>${f.moment[1]}</figcaption></figure><a class="ab-founder-link" href="${f.href}" target="_blank" rel="noopener noreferrer">Connect on LinkedIn <span aria-hidden="true">↗</span></a></div></article>`;

export function renderAboutPage(contactSection, invitation = '') {
  const accounts = [...fallbackAccounts].sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0)).slice(0, 5);
  return `<section class="ab-hero"><div class="ab-hero-inner shell"><div class="ab-hero-copy"><span class="eyebrow">ABOUT SENTIENT</span><h1>Not just an agency.<br><em>A media company.</em></h1><p>We run our own pages, followed by 30M+ people, and work with the creators tech audiences already trust. So your launch reaches the right people from day one.</p><dl class="ab-figures"><div><dt>30M+</dt><dd>followers on our own pages</dd></div><div><dt>1B+</dt><dd>monthly impressions</dd></div><div><dt>750+</dt><dd>brands</dd></div></dl></div>${heroMosaic()}</div></section>`
    + trustedMarquee()
    + `<section class="sx-section shell" id="about-services" aria-labelledby="about-services-title"><div class="section-heading"><div><span class="eyebrow">WHAT WE DO</span><h2 id="about-services-title">Two ways <em>to grow.</em></h2></div></div><div class="ab-services">${services.map(serviceCard).join('')}</div></section>`
    + `<section class="sx-section shell" id="about-founders" aria-labelledby="about-founders-title"><div class="section-heading"><div><span class="eyebrow">THE PEOPLE</span><h2 id="about-founders-title">The people <em>behind it.</em></h2></div></div><div class="ab-founders">${founders.map(founderCard).join('')}</div></section>`
    + `<section class="sx-section sx-section--panel" id="about-network" aria-labelledby="about-network-title"><div class="shell"><div class="section-heading"><div><span class="eyebrow">HOW THE NETWORK WORKS</span><h2 id="about-network-title">Connected by culture.<br><em>Built for distribution.</em></h2></div></div><div class="ab-network"><div class="ab-network-head"><span class="eyebrow">01 · OUR PAGES</span><h3>Our own communities.</h3><p>Pages operated by Sentient, each with its own editorial voice, followed by people who care about AI, tech and business.</p></div><div class="v2-owned-accounts gx-accounts gx-accounts--top">${renderAccountCards(accounts)}</div></div><div class="ab-network ab-network--creators"><div class="ab-network-head"><span class="eyebrow">02 · CREATOR PARTNERS</span><h3>The voices on X and LinkedIn.</h3><p>Independent creators we bring in when they fit your launch. These are the biggest who have posted in our campaigns.</p></div>${creatorStrip()}</div></div></section>`
    + invitation
    + contactSection;
}
