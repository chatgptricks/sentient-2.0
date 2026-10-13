import { decks } from './registry.mjs';
import './player.css';
import { initDeckVisuals } from './visuals.mjs';
import { initDeckEditor } from './editor.mjs';
import { campaignExamples } from './examples.mjs';
import { initDeckFit } from './fit.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const asset = path => new URL(`..${path}`, import.meta.url).href;
const paragraphs = slide => (slide.paragraphs ?? []).map(text => `<p>${escape(text)}</p>`).join('');
const statement = slide => slide.emphasis ? `<p class="deck-statement">${escape(slide.emphasis)}</p>` : '';
const rows = (slide, className='') => `<ol class="deck-rows ${className}">${(slide.items ?? []).map((item, i) => `<li><span class="deck-row-number">${String(i+1).padStart(2,'0')}</span><div><h3>${escape(item.title)}</h3>${item.description ? `<p>${escape(item.description)}</p>` : ''}</div></li>`).join('')}</ol>`;
const heading = slide => `<h2 class="deck-title">${escape(slide.title)}</h2>`;
const portrait = (file, label, className='') => `<img class="${className}" src="${asset(file)}" alt="${escape(label)}" loading="lazy" decoding="async">`;
const art = type => `<div class="deck-art deck-art-${type}" data-deck-visual="${type}" aria-hidden="true"><img class="deck-art-fallback" data-deck-fallback src="${asset('/assets/sentient-symbol.svg')}" alt=""></div>`;
const accounts = () => `<div class="deck-account-cloud" aria-hidden="true">${['chatgptricks','theartificialintelligence','theaipage','mindset.therapy','blueviper.ai','aitrendz.xyz','traselveloreal','planet.ai_'].map((name,i) => `<span style="--account:${i}">${portrait(`/assets/universe/avatar-${name}.jpg`,'')}<small>@${name}</small></span>`).join('')}</div>`;

function registerEditableFields(root, deck) {
  const field = (element, name) => { if (element) element.dataset.editField = name; };
  root.querySelectorAll('.deck-slide').forEach((slide, i) => {
    slide.dataset.slideId = deck.slides[i].id;
    field(slide.querySelector('.deck-title'), 'title');
    field(slide.querySelector('.deck-slide-top>span'), 'section');
    field(slide.querySelector('.deck-statement'), 'emphasis');
    field(slide.querySelector('.deck-note'), 'note');
    slide.querySelectorAll('.deck-copy>p, .deck-editorial-copy>p, .deck-relevance-copy>p, .deck-phase-map section>p').forEach((element, index) => {
      if (!element.dataset.editField) field(element, `paragraph-${index}`);
    });
    slide.querySelectorAll('.deck-rows li, .deck-process-steps li').forEach((item, index) => {
      field(item.querySelector('h3'), `item-${index}-title`);
      field(item.querySelector('p'), `item-${index}-description`);
    });
    slide.querySelectorAll('.deck-founder').forEach((founder, index) => {
      field(founder.querySelector('h3'), `founder-${index}-name`);
      field(founder.querySelector('p'), `founder-${index}-bio`);
      field(founder.querySelector('.deck-founder-role'), `founder-${index}-role`);
    });
    field(slide.querySelector('.deck-cpm-label'), 'cpm-label');
    field(slide.querySelector('.deck-cpm'), 'cpm');
    field(slide.querySelector('.deck-compensation>span'), 'compensation-label');
    field(slide.querySelector('.deck-compensation>p'), 'compensation');
    field(slide.querySelector('.deck-art-caption'), 'art-caption');
    slide.querySelectorAll('.deck-audience-words>span').forEach((element, index) => field(element, `audience-action-${index}`));
    slide.querySelectorAll('.deck-iteration>span').forEach((element, index) => field(element, `cycle-${index}`));
    slide.querySelectorAll('.deck-phase-map section').forEach((phase, index) => {
      field(phase.querySelector('h3>span'), `phase-${index}-title`);
      field(phase.querySelector('small'), `phase-${index}-condition`);
    });
    field(slide.querySelector('.deck-period strong>span:first-child'), 'duration-number');
    field(slide.querySelector('.deck-period strong>span:last-child'), 'duration-unit');
    field(slide.querySelector('.deck-period>p'), 'duration-condition');
    field(slide.querySelector('.deck-contact>span:first-child'), 'contact-label');
    slide.querySelectorAll('.deck-example').forEach((example, index) => {
      field(example.querySelector('h3'), `example-${index}-name`);
      field(example.querySelector('.deck-example-date'), `example-${index}-date`);
      field(example.querySelector('.deck-example-metrics'), `example-${index}-metrics`);
    });
  });
}

function composition(slide) {
  switch (slide.layout) {
    case 'cover':
      return `<div class="deck-opening-copy"><div class="deck-cover-mark"></div><h1 class="deck-opening-title" data-edit-field="title">${escape(slide.title)}</h1><div class="deck-copy">${paragraphs(slide)}</div></div>`;
    case 'examples':
      return `${heading(slide)}<div class="deck-example-rail">${[campaignExamples[2], campaignExamples[1], campaignExamples[0]].map(example => `<section class="deck-example"><a href="${escape(example.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escape(example.label)} promotional post">${portrait(example.image,`${example.label}, @chatgptricks promotional post`)}</a><div class="deck-example-caption"><h3>${escape(example.label)}</h3><span class="deck-example-date">${new Date(example.publishedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</span><p class="deck-example-metrics">${[example.metrics.likes !== null ? `${example.metrics.likes.toLocaleString('en-US')} likes` : '', example.metrics.comments !== null ? `${example.metrics.comments.toLocaleString('en-US')} comments` : ''].filter(Boolean).join(' · ')}</p></div></section>`).join('')}</div>`;
    case 'network':
      return `<div class="deck-cover-art">${art('sculpture')}</div><div class="deck-cover-copy"><h1 class="deck-cover-title"><span data-edit-field="cover-intro">A media network with</span><span class="deck-cover-metric"><span data-edit-field="cover-metric">25–30</span><span class="deck-million" data-edit-field="cover-unit">million</span></span><span data-edit-field="cover-audience">followers</span></h1><div class="deck-copy">${paragraphs(slide)}</div>${statement(slide)}</div>`;
    case 'founders':
      return `${heading(slide)}<div class="deck-founder-pair">${slide.founders.map(founder => `<section class="deck-founder"><div class="deck-founder-photo">${portrait(founder.image, founder.name)}</div><div class="deck-founder-copy"><span class="deck-founder-role">${escape(founder.role)}</span><h3>${escape(founder.name)}</h3><p>${escape(founder.description)}</p></div></section>`).join('')}</div>${statement(slide)}`;
    case 'approach':
      return `${heading(slide)}<div class="deck-phase-map">${slide.paragraphs.map(text => `<section><p>${escape(text)}</p></section>`).join('')}</div>${statement(slide)}`;
    case 'selection':
      return `${heading(slide)}<div class="deck-selection-body"><div class="deck-selection-story"><div class="deck-copy">${paragraphs(slide)}</div>${accounts()}</div>${rows(slide)}</div>${statement(slide)}`;
    case 'relevance':
      return `<div class="deck-relevance-art">${art('crowd')}</div>${heading(slide)}<div class="deck-relevance-copy">${paragraphs(slide)}${statement(slide)}</div>`;
    case 'audience':
      return `<div class="deck-audience-copy">${heading(slide)}<div class="deck-copy">${paragraphs(slide)}</div>${statement(slide)}</div><div class="deck-audience-field"><div class="deck-audience-orrery">${accounts()}<div class="deck-audience-words" aria-hidden="true"><span>Follow</span><span>Consume</span><span>Engage</span></div></div></div>`;
    case 'process':
      return `${heading(slide)}<ol class="deck-process-steps">${slide.items.map((item,i) => `<li><span>0${i+1}</span><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p></li>`).join('')}</ol>${statement(slide)}`;
    case 'commitment':
      return `${heading(slide)}<div class="deck-commitment-body"><div class="deck-commitment-main"><p class="deck-cpm-label">Guaranteed maximum organic campaign CPM</p><div class="deck-cpm">${escape(slide.cpm)}</div></div><div class="deck-editorial-copy">${paragraphs(slide)}<div class="deck-compensation"><span>If delivery falls short</span><p>${escape(slide.compensation)}</p></div></div></div>`;
    case 'analysis':
      return `<div class="deck-analysis-story">${heading(slide)}<div class="deck-copy"><p>${escape(slide.paragraphs[0])}</p></div></div>${rows(slide, 'deck-analysis-rows')}<div class="deck-analysis-conclusion"><div class="deck-copy"><p>${escape(slide.paragraphs[1])}</p></div>${statement(slide)}</div>`;
    case 'paid':
      return `<div class="deck-paid-story">${heading(slide)}<div class="deck-copy">${paragraphs(slide)}</div>${statement(slide)}</div><div class="deck-paid-visual"><div class="deck-period"><strong><span class="deck-duration-number">12</span><span class="deck-duration-unit">months</span></strong><p>Previous engagement\nwhere supported</p></div>${accounts()}</div>`;
    case 'optimisation':
      return `${heading(slide)}<div class="deck-optimisation-body"><div class="deck-iteration" aria-hidden="true"><b>↻</b></div><div class="deck-editorial-copy">${paragraphs(slide)}${statement(slide)}</div></div>`;
    case 'closing':
      return `<div class="deck-closing-story">${heading(slide)}</div><div class="deck-closing-copy"><div class="deck-copy">${paragraphs(slide)}</div>${rows(slide, 'deck-closing-rows')}</div>${statement(slide)}`;
    default:
      return `${heading(slide)}<div class="deck-copy">${paragraphs(slide)}</div>${statement(slide)}`;
  }
}

export function parseDeckHash(hash) {
  const match = /^#\/([^/]+)(?:\/(\d+))?\/?$/.exec(hash);
  if (!match) return null;
  let slug;
  try { slug = decodeURIComponent(match[1]); } catch { return null; }
  return { slug, slide: Math.max(0, Number(match[2] ?? 1) - 1) };
}

export function mountDeck(hash) {
  const route = parseDeckHash(hash);
  const deck = decks.find(item => item.slug === route?.slug);
  document.body.dataset.page = 'deck';
  document.body.className = 'deck-mode';
  if (!deck) {
    document.body.innerHTML = `<main class="deck-missing"><img src="${asset('/assets/sentient-logo.svg')}" alt="Sentient"><h1>Deck not found</h1><p>This presentation link is unavailable.</p><a href="#main">Return to Sentient</a></main>`;
    delete document.documentElement.dataset.deck;
    document.title = 'Deck not found — Sentient';
    return;
  }
  document.title = deck.title;
  let current = Math.min(route.slide, deck.slides.length - 1);
  document.body.innerHTML = `<main class="deck-player" aria-label="${escape(deck.title)}"><header class="deck-header"><button class="deck-brand" type="button" aria-label="Sentient"><img src="${asset('/assets/sentient-logo.svg')}" width="180" height="38" alt="Sentient"></button><span class="deck-name">Campaign deck</span><div class="deck-tools"><button type="button" data-deck-action="overview" aria-haspopup="dialog" title="Slide overview (G)">Overview <span aria-hidden="true">▦</span></button><button type="button" data-deck-action="print" title="Print all slides">Print <span aria-hidden="true">↗</span></button><button type="button" data-deck-action="fullscreen" title="Fullscreen (F)" aria-label="Enter fullscreen">Fullscreen <span aria-hidden="true">⛶</span></button></div></header><div class="deck-stage">${deck.slides.map((slide,i) => `<article class="deck-slide deck-${escape(slide.layout)}" data-slide="${i}" role="group" aria-roledescription="slide" aria-label="${i+1} of ${deck.slides.length}: ${escape(slide.title)}" ${i !== current ? 'hidden' : ''}><div class="deck-fit-area"><div class="deck-content"><div class="deck-slide-top"><span>${escape(slide.section)}</span><span class="deck-slide-id">${String(i+1).padStart(2,'0')}</span></div><div class="deck-composition">${composition(slide)}</div>${slide.note ? `<p class="deck-note">${escape(slide.note)}</p>` : ''}</div></div></article>`).join('')}</div><footer class="deck-controls"><div class="deck-counter"><span data-deck-current>${String(current+1).padStart(2,'0')}</span><span> / ${String(deck.slides.length).padStart(2,'0')}</span></div><div class="deck-progress" aria-label="Choose a slide">${deck.slides.map((slide,i) => `<button type="button" data-go="${i}" aria-label="Slide ${i+1}: ${escape(slide.section)}" ${i === current ? 'aria-current="step"' : ''}><span></span></button>`).join('')}</div><div class="deck-navigation"><span class="deck-key-hint">← → to navigate</span><button type="button" data-deck-action="previous" aria-label="Previous slide">←</button><button type="button" data-deck-action="next" aria-label="Next slide">→</button></div></footer><span class="deck-announcement" role="status" aria-live="polite" aria-atomic="true"></span><dialog class="deck-overview" aria-labelledby="deck-overview-title"><div class="deck-overview-head"><h2 id="deck-overview-title">The campaign deck</h2><button type="button" data-deck-action="close-overview" aria-label="Close slide overview">×</button></div><ol>${deck.slides.map((slide,i) => `<li><button type="button" data-go="${i}"><span>${String(i+1).padStart(2,'0')}</span><strong>${escape(slide.section)}</strong><small>${escape(slide.title)}</small></button></li>`).join('')}</ol></dialog></main>`;
  delete document.documentElement.dataset.deck;
  const root = document.querySelector('.deck-player');
  registerEditableFields(root, deck);
  const fit = initDeckFit(root);
  const brand = root.querySelector('.deck-brand');
  const header = root.querySelector('.deck-header');
  const coverMark = root.querySelector('.deck-cover-mark');
  let editor;
  const configureEditor = async () => {
    const config = await fetch(new URL('../comments-config.json', import.meta.url)).then(response => response.json()).catch(() => ({}));
    if (!root.isConnected) return;
    editor = initDeckEditor({ root, deck, apiUrl:config.apiUrl, onFieldsApplied:fit.update });
  };
  void configureEditor();
  const visuals = initDeckVisuals(root);
  window.addEventListener('pagehide', () => { visuals.dispose(); editor?.dispose(); fit.dispose(); }, { once:true });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  const slides = [...root.querySelectorAll('.deck-slide')];
  const dialog = root.querySelector('dialog');
  const prev = root.querySelector('[data-deck-action="previous"]');
  const next = root.querySelector('[data-deck-action="next"]');
  const overviewButton = root.querySelector('[data-deck-action="overview"]');
  const announce = root.querySelector('.deck-announcement');
  const fullscreenButton = root.querySelector('[data-deck-action="fullscreen"]');
  const sync = (index, speak = true) => {
    current = Math.max(0, Math.min(index, slides.length - 1));
    root.dataset.theme = ['cover','process','commitment','optimisation'].includes(deck.slides[current].layout) ? 'light' : 'dark';
    root.dataset.layout = deck.slides[current].layout;
    if (root.dataset.layout === 'cover') coverMark?.append(brand);
    else header.prepend(brand);
    slides.forEach((slide,i) => { slide.hidden = i !== current; if (i === current) slide.scrollTop = 0; });
    root.querySelector('[data-deck-current]').textContent = String(current+1).padStart(2,'0');
    root.querySelectorAll('.deck-progress [data-go]').forEach(button => {
      if (Number(button.dataset.go) === current) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    });
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    fit.update();
    visuals.update();
    if (speak) announce.textContent = `Slide ${current+1} of ${slides.length}. ${deck.slides[current].title}`;
  };
  const go = index => {
    const destination = Math.max(0, Math.min(index, slides.length - 1));
    const nextHash = `#/${deck.slug}${destination ? `/${destination+1}` : ''}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
    sync(destination);
  };
  window.addEventListener('beforeprint', () => coverMark?.append(brand));
  window.addEventListener('afterprint', () => sync(current, false));
  const closeOverview = () => { dialog.close(); overviewButton.focus(); };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch { announce.textContent = 'Fullscreen is unavailable in this browser. The presentation is still ready to use.'; }
  };
  if (!document.fullscreenEnabled) fullscreenButton.hidden = true;
  document.addEventListener('fullscreenchange', () => fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.go !== undefined) {
      go(Number(button.dataset.go));
      if (dialog.open) closeOverview();
      return;
    }
    switch (button.dataset.deckAction) {
      case 'previous': go(current-1); break;
      case 'next': go(current+1); break;
      case 'overview': dialog.showModal(); dialog.querySelector(`[data-go="${current}"]`).focus(); break;
      case 'close-overview': closeOverview(); break;
      case 'print': window.print(); break;
      case 'fullscreen': void toggleFullscreen(); break;
    }
  });
  dialog.addEventListener('cancel', () => overviewButton.focus());
  dialog.addEventListener('click', event => { if (event.target === dialog) closeOverview(); });
  window.addEventListener('hashchange', () => {
    const changed = parseDeckHash(window.location.hash);
    if (changed?.slug === deck.slug) sync(changed.slide);
    else if (window.location.hash.startsWith('#/')) window.location.reload();
  });
  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.isContentEditable || event.target.closest('input, textarea, select')) return;
    if (root.querySelector('dialog[open]')) return;
    const key = event.key.toLowerCase();
    if (['arrowright','pagedown'].includes(key) || (key === ' ' && !event.target.closest('button, a'))) { event.preventDefault(); go(current+1); }
    else if (['arrowleft','pageup'].includes(key)) { event.preventDefault(); go(current-1); }
    else if (key === 'home') { event.preventDefault(); go(0); }
    else if (key === 'end') { event.preventDefault(); go(slides.length-1); }
    else if (key === 'f') { event.preventDefault(); void toggleFullscreen(); }
    else if (key === 'g') { event.preventDefault(); overviewButton.click(); }
  });
  let touchStart;
  root.querySelector('.deck-stage').addEventListener('touchstart', event => {
    if (event.target.closest('a, button, [contenteditable]')) return;
    const touch = event.changedTouches[0];
    touchStart = { x:touch.clientX, y:touch.clientY };
  }, { passive:true });
  root.querySelector('.deck-stage').addEventListener('touchend', event => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy)*1.5) go(current + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive:true });
  sync(current, false);
}
