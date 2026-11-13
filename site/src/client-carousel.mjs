// Client logo rail shared by Home and the Growth campaigns page.
const brands = [['OpenAI','openai'],['Meta','meta'],['Adobe','adobe'],['Higgsfield','higgsfield'],['InVideo','invideo'],['Freepik','freepik'],['Polymarket','polymarket'],['Wegic','wegic'],['Stake','stake'],['ChatGPT','chatgpt']];

export const clientCarousel = () => `<section class="client-proof v2-client-carousel" aria-labelledby="v2-clients-title"><div class="client-proof-heading shell"><span class="eyebrow" id="v2-clients-title">IN GOOD COMPANY.</span><p>Ambitious brands. Shared ambition.</p><div class="v2-client-controls"><button type="button" data-client-prev aria-label="Previous client logos">←</button><button type="button" data-client-next aria-label="Next client logos">→</button></div></div><div class="v2-client-viewport" tabindex="0" role="region" aria-label="Client logos. Drag, swipe, or use the arrow keys."><ul class="v2-client-track">${brands.map(([name,slug]) => `<li class="v2-client-logo"><img src="/assets/clients/client-${slug}.png" alt="${name}" width="180" height="60" draggable="false" loading="lazy"></li>`).join('')}</ul></div><div class="v2-client-caption shell"><span>Drag or swipe to explore</span><output data-client-status aria-live="polite" aria-atomic="true">Clients 1–5 of 10</output></div></section>`;

// Static logo row for the service pages (no carousel). ChatGPT is left out
// because OpenAI is already shown (Louis, 2026-11-13).
export const clientLogoRow = (label = 'IN GOOD COMPANY') => `<section class="sx-logo-row sx-logo-row--images shell" aria-label="Clients"><span class="eyebrow">${label}</span><ul>${brands.filter(([, slug]) => slug !== 'chatgpt').map(([name, slug]) => `<li><img src="/assets/clients/client-${slug}.png" alt="${name}" width="140" height="44" loading="lazy"></li>`).join('')}</ul></section>`;

// "Trusted by" marquee: the full logo wall from the Launch Amplification deck
// (decks/assets/canva/logos.png, sliced into public/assets/clients/trusted/).
// 750+ brands and 1B+ monthly impressions are the deck's own figures (slide 7).
// It scrolls on its own and can be dragged (v2-interactions.js, [data-marquee]).
const trusted = [
  ['OpenAI', 'openai'], ['Meta', 'meta'], ['Adobe', 'adobe'], ['Higgsfield', 'higgsfield'], ['invideo AI', 'invideo'], ['Freepik', 'freepik'],
  ['Gamma', 'gamma'], ['Synthesia', 'synthesia'], ['Semrush', 'semrush'], ['you.com', 'you-com'], ['Wegic', 'wegic'], ['Abacus.AI', 'abacus'],
  ['Filmora', 'filmora'], ['Warp', 'warp'], ['Codeium', 'codeium'], ['LTX Studio', 'ltx-studio'], ['AssemblyAI', 'assemblyai'], ['Nothing', 'nothing'],
  ['Fathom', 'fathom'], ['Speechmatics', 'speechmatics'], ['Delphi', 'delphi'], ['Sana', 'sana'], ['Metaview', 'metaview'], ['vidyo.ai', 'vidyo'],
  ['Creatify', 'creatify'], ['DomoAI', 'domoai'], ['Guidde', 'guidde'], ['Scribe', 'scribe'], ['Akiflow', 'akiflow'], ['Spinach.io', 'spinach'],
  ['Namify', 'namify'], ['Lore Machine', 'lore-machine'], ['Mindy', 'mindy'], ['Sensay', 'sensay'], ['Soona', 'soona'], ['Plus', 'plus'],
  ['Capitol AI', 'capitol-ai'], ['Cohesive', 'cohesive'], ['RivalFlow AI', 'rivalflow'], ['AdCreative.ai', 'adcreative'], ['Blaze', 'blaze'], ['Playbook', 'playbook'],
  ['Sonara', 'sonara'], ['NexTool', 'nextool'], ['Thoughtly', 'thoughtly'], ['Twice', 'twice'], ['wetracked.io', 'wetracked'], ['Client logo', 'waveform'],
];
export const trustedMarquee = () => `<section class="sx-trusted" aria-label="Trusted by 750+ brands"><div class="sx-trusted-inner shell"><div class="sx-trusted-label"><p class="sx-trusted-title">Trusted by<br><em>750+ brands</em></p><p class="sx-trusted-reach"><strong>1B+</strong><span>monthly<br>impressions</span></p></div><div class="sx-marquee" data-marquee><ul class="sx-marquee-track">${trusted.map(([name, slug]) => `<li><img src="/assets/clients/trusted/${slug}.png" alt="${name}" height="30" loading="lazy" draggable="false"></li>`).join('')}</ul></div></div></section>`;
