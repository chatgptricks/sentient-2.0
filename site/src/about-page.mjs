// About page, rebuilt after the service pages (Sergio, 2026-11-13). Same rules:
// only sourced figures. 30M+ owned followers (site-wide figure, Louis 2026-11-13),
// 750+ brands and 1B+ monthly impressions (Launch Amplification deck, slide 7),
// 50,000+ sign-ups (Lotus AI, Louis's feedback) and 150M+ Higgsfield views (team
// feedback doc). Founder names, roles and bios from about-content.mjs
// (sentientagency.io/what-we-do, verified 2026-10-04).
import { fallbackAccounts } from './network-fallback.mjs';

// Hero mosaic: only Sentient's own pages (relationship "owned"), biggest first,
// with the 30M+ figure in the middle.
const ownedPages = () => fallbackAccounts.filter(item => item.relationship === 'owned' && item.avatar).sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0)).slice(0, 14);
const mosaic = () => {
  const faces = ownedPages().map((item, index) => ['img', item.avatar, [0, 3, 8, 12].includes(index)]);
  return [...faces.slice(0, 5), ['stat', '30M+', 'followers on our own pages'], ...faces.slice(5)];
};
const heroMosaic = () => `<div class="ab-mosaic" aria-hidden="true">${mosaic().map(([kind, a, b]) => kind === 'stat'
  ? `<span class="ab-mosaic-stat"><strong>${a}</strong><small>${b}</small></span>`
  : `<span class="ab-mosaic-face${b ? ' is-lit' : ''}"><img src="${a}" alt="" width="96" height="96" loading="lazy"></span>`).join('')}</div>`;

const founders = [
  { id: 'ivan', name: 'Ivan', role: 'Co-founder · AI specialist', portrait: '/assets/founders/ivan-cutout.webp', href: 'https://www.linkedin.com/in/ivanelgrande/',
    bio: 'Ivan founded @chatgptricks, built digital communities, and developed and sold an AI newsletter business. At Sentient, he works with Louis on the strategies and growth systems behind client campaigns.',
    moment: ['/assets/v2/people/ivan-meta-event.png', 'On screen during a presentation by Mark Zuckerberg.'] },
  { id: 'louis', name: 'Louis Gleeson', role: 'Co-founder · Growth strategist', portrait: '/assets/founders/louis-cutout.webp', href: 'https://www.linkedin.com/in/louis-gleeson-a86144211/',
    bio: 'Louis is a social media and growth strategist who has built and sold Instagram brands. Before co-founding Sentient, he also helped build a Web3 marketing agency.',
    moment: ['/assets/v2/people/louis-nathan-lyon.png', 'In conversation with cricketer Nathan Lyon.'] },
];
const founderCard = f => `<article class="ab-founder" aria-labelledby="ab-founder-${f.id}"><figure class="ab-founder-portrait"><img src="${f.portrait}" alt="${f.name}, Sentient co-founder" width="640" height="640" loading="lazy"></figure><div class="ab-founder-copy"><span class="eyebrow">${f.role}</span><h3 id="ab-founder-${f.id}">${f.name}</h3><p>${f.bio}</p><figure class="ab-moment"><img src="${f.moment[0]}" alt="" width="510" height="510" loading="lazy"><figcaption>${f.moment[1]}</figcaption></figure><a class="ab-founder-link" href="${f.href}" target="_blank" rel="noopener noreferrer">Connect on LinkedIn <span aria-hidden="true">↗</span></a></div></article>`;

// Where it started: the founders grew their own pages before Sentient
// (bios from sentientagency.io/what-we-do). @chatgptricks followers from the
// network snapshot (network-fallback.mjs, 2026-11-07).
const origin = () => {
  const page = fallbackAccounts.find(item => item.handle === 'chatgptricks');
  const followers = `${(page.followerCount / 1e6).toFixed(1)}M`;
  return `<div class="ab-origin"><div class="ab-origin-copy"><span class="eyebrow">WHERE IT STARTED</span><h2 id="about-origin-title">We grew our own <em>pages first.</em></h2><p>Sentient grew out of audiences its founders built themselves. That’s still the core of what we do: the pages we run are the pages your story goes out on.</p></div><ol class="ab-origin-steps"><li><span class="ab-origin-face"><img src="${page.avatar}" alt="" width="64" height="64" loading="lazy"></span><span><b>Ivan founds @chatgptricks</b><small>Today it has ${followers} followers and is one of our own pages.</small></span></li><li><span class="ab-origin-mark" aria-hidden="true">IG</span><span><b>Louis builds and sells Instagram brands</b><small>And helps build a Web3 marketing agency.</small></span></li><li><span class="ab-origin-mark" aria-hidden="true">AI</span><span><b>Ivan builds and sells an AI newsletter business</b><small>And builds digital communities.</small></span></li><li class="is-now"><span class="ab-origin-mark" aria-hidden="true">S</span><span><b>Sentient</b><small>Our own pages and the creators we work with, for the companies building what’s next.</small></span></li></ol></div>`;
};

// How we work: principles taken from the two decks (account selection, creator
// copy, guarantees agreed before launch, one campaign lead).
const principles = [
  ['Audience first', 'We go through our database of thousands of accounts and pick the pages and creators your customers already follow.'],
  ['A reason to care', 'We write or guide every post around the part of your product that matters most to that audience.'],
  ['Guarantees up front', 'Views or CPM are agreed before anything goes live, and we report against them.'],
  ['One team, start to finish', 'You work with one campaign lead. We coordinate every account, from planning to the final report.'],
];

export function renderAboutPage(contactSection, invitation = '') {
  return `<section class="ab-hero"><div class="ab-hero-inner shell"><div class="ab-hero-copy"><span class="eyebrow">ABOUT SENTIENT</span><h1>Not just an agency.<br><em>A media company.</em></h1><p>We run our own pages, followed by 30M+ people, and work with the creators tech audiences already trust. So your launch reaches the right people from day one.</p><dl class="ab-figures"><div><dt>30M+</dt><dd>followers on our own pages</dd></div><div><dt>1B+</dt><dd>monthly impressions</dd></div><div><dt>750+</dt><dd>brands</dd></div></dl></div>${heroMosaic()}</div></section>`
    + `<section class="sx-section shell" id="about-founders" aria-labelledby="about-founders-title"><div class="section-heading"><div><span class="eyebrow">THE PEOPLE</span><h2 id="about-founders-title">The people <em>behind it.</em></h2></div></div><div class="ab-founders">${founders.map(founderCard).join('')}</div></section>`
    + `<section class="sx-section shell" id="about-origin" aria-labelledby="about-origin-title">${origin()}</section>`
    + `<section class="sx-section shell" id="about-principles" aria-labelledby="about-principles-title"><div class="section-heading"><div><span class="eyebrow">HOW WE WORK</span><h2 id="about-principles-title">Four things <em>we don’t skip.</em></h2></div></div><ol class="ab-principles">${principles.map(([title, text], index) => `<li><span class="ab-principle-num">0${index + 1}</span><h3>${title}</h3><p>${text}</p></li>`).join('')}</ol></section>`
    + invitation
    + contactSection;
}
