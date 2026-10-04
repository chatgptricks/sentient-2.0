// Names, roles, biographies and LinkedIn destinations are adapted from
// https://sentientagency.io/what-we-do/ (verified 2026-10-04). Portrait mapping
// matches the existing Sentient Website app/hub-data.ts, People & Presence.
// Audience totals, superlatives, revenue figures and guarantees are omitted.
const founders = [
  {
    id: 'ivan',
    name: 'Ivan',
    specialty: 'AI specialist · Founder of @chatgptricks',
    portrait: '/assets/ivan.png',
    paragraphs: [
      'Ivan is an entrepreneur and AI specialist who founded @chatgptricks, built digital communities, and developed and sold an AI newsletter business.',
      'At Sentient, he works with Louis on the strategies and growth systems behind client campaigns, bringing experience in both emerging technology and audience building.'
    ],
    href: 'https://www.linkedin.com/in/ivanelgrande/'
  },
  {
    id: 'louis',
    name: 'Louis Gleeson',
    specialty: 'Growth strategist · Digital media builder',
    portrait: '/assets/louis.png',
    paragraphs: [
      'Louis is a social media and growth strategist who has built and sold Instagram brands. Before co-founding Sentient, he also helped build a Web3 marketing agency.',
      'His experience connects audience development with commercial campaign strategy, shaping how Sentient helps companies reach people and pursue their business goals.'
    ],
    href: 'https://www.linkedin.com/in/louis-gleeson-a86144211/'
  }
];

const founderProfile = founder => `<article class="story-founder story-founder--${founder.id}" aria-labelledby="founder-${founder.id}">
  <figure class="story-portrait">
    <img src="${founder.portrait}" alt="${founder.name}, Sentient co-founder" width="1024" height="1024" decoding="async">
    <figcaption class="story-portrait-caption">
      <span class="story-founder-role">Co-founder</span>
      <h2 id="founder-${founder.id}">${founder.name}</h2>
    </figcaption>
  </figure>
  <div class="story-founder-bio"><h2 class="mobile-founder-name">${founder.name}</h2>
    <p class="story-founder-specialty">${founder.specialty}</p>
    ${founder.paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('')}
    <a class="story-person-link" href="${founder.href}" target="_blank" rel="noopener noreferrer"><span>Connect with ${founder.id === 'ivan' ? 'Ivan' : 'Louis'}<small>LinkedIn</small></span><span aria-hidden="true">↗</span></a>
  </div>
</article>`;

export function renderAboutStory() {
  return `<div class="about-story">
    <section class="about-story-intro shell" aria-labelledby="about-story-title">
      <div>
        <span class="eyebrow">THE PEOPLE BEHIND SENTIENT</span>
        <h1 id="about-story-title"><span>People behind</span><span>the <em>momentum.</em></span></h1>
      </div>
      <p>We bring experience in building audiences, creative work, and campaign strategy to the companies building what’s next.</p>
    </section>
    <section class="story-founders shell" aria-label="Sentient co-founders">
      ${founders.map(founderProfile).join('')}
    </section>
  </div>`;
}
