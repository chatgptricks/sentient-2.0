import { decks } from './registry.mjs';
import './player.css';
import './cover.css';
import './social-proof.css';
import { initDeckEditor } from './editor.mjs';
import { initDeckFit } from './fit.mjs';
import { accountCatalog, accountPicker, accountRefresh, initDeckPickers, postPicker } from './pickers.mjs';
import { assetUrl, fixedSurface, renderBlocks, surfaceOf } from './blocks.mjs';
import { getDeck, getDeckBySlug } from './studio-store.mjs';
import { fetchPublished } from './studio-api.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const asset = path => assetUrl(path, import.meta.url);
// Editable fields retain each slide's text and selected account identity.
const text = (tag, field, value, className='') => `<${tag}${className ? ` class="${className}"` : ''} data-edit-field="${field}">${escape(value)}</${tag}>`;
const statement = slide => slide.emphasis ? text('p', 'emphasis', slide.emphasis, 'deck-statement') : '';
const pad = i => String(i+1).padStart(2,'0');
const arrow = '<span class="deck-arrow" aria-hidden="true"></span>';
const heading = slide => `<h2 class="deck-title" data-edit-field="title">${escape(slide.title)}</h2>`;

function registerEditableFields(root, deck) {
  root.querySelectorAll('.deck-slide').forEach((slide, i) => {
    slide.dataset.slideId = deck.slides[i].id;
    const section = slide.querySelector('.deck-slide-top>span');
    if (section) section.dataset.editField = 'section';
  });
}

function composition(slide) {
  // Studio slides are stacks of elements; the campaign deck keeps its layouts
  // and field names so its saved edits stay attached.
  if (slide.blocks) return renderBlocks(slide, asset);
  const items = slide.items ?? [];
  switch (slide.layout) {
    case 'opening':
      return `<div class="deck-cover-mark"></div><div class="deck-cover-lines">${slide.lines.map((line,i) => text('p', `line-${i}`, line, 'deck-cover-line')).join('')}</div><div class="deck-cover-emblem" aria-hidden="true"></div>`;
    case 'network':
      return `<div class="deck-network-body"><div class="deck-metric">${text('strong', 'metric', slide.metric)}${text('span', 'label', slide.label)}</div><div class="deck-network-side"><ul class="deck-tags">${slide.tags.map((tag,i) => `<li>${text('span', `tag-${i}`, tag)}</li>`).join('')}</ul><ul class="deck-platforms">${slide.platforms.map((platform,i) => `<li>${text('span', `platform-${i}`, platform)}</li>`).join('')}</ul></div></div>${statement(slide)}`;
    case 'accounts': {
      const catalog = accountCatalog(slide);
      return `<ol class="deck-account-grid">${slide.accounts.map((account,i) => `<li class="deck-account"><div class="deck-account-media"><img class="deck-account-avatar" src="${asset(account.image)}" alt="${escape(account.handle)}" width="320" height="320" decoding="async">${accountPicker(catalog, i)}</div><div class="deck-account-copy">${text('h3', `account-${i}-handle`, account.handle, 'deck-account-handle')}${text('strong', `account-${i}-followers`, account.followers, 'deck-account-followers')}${text('span', `account-${i}-label`, 'Followers', 'deck-account-label')}</div><span data-edit-field="account-${i}-id" hidden>${escape(account.id)}</span><span data-edit-field="account-${i}-avatar" hidden>${escape(account.image)}</span><span data-edit-field="account-${i}-asof" hidden>${escape(slide.followersAsOf)}</span></li>`).join('')}</ol>${accountRefresh}`;
    }
    case 'promos':
      return `<div class="deck-promo-grid">${slide.posts.map((post,i) => `<article class="deck-promo"><div class="deck-promo-media"><a class="deck-promo-image-link" href="${escape(post.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`View ${post.title} on Instagram`)}"><img class="deck-promo-image" src="${asset(post.image)}" alt="${escape(`${post.title} promotional post from ${post.account}`)}" width="${i ? '1080' : '720'}" height="${i ? '1350' : '960'}" decoding="async"></a>${postPicker(i)}<span data-edit-field="post-${i}-url" hidden>${escape(post.url)}</span><span data-edit-field="post-${i}-source" hidden>${escape(post.source)}</span></div><div class="deck-promo-copy">${text('p', `post-${i}-account`, post.account, 'deck-promo-account')}${text('h3', `post-${i}-title`, post.title, 'deck-promo-title')}<dl class="deck-promo-metrics"><div>${text('dt', `post-${i}-likes-label`, 'Likes')}${text('dd', `post-${i}-likes`, post.likes)}</div><div>${text('dt', `post-${i}-comments-label`, 'Comments')}${text('dd', `post-${i}-comments`, post.comments)}</div></dl>${text('p', `post-${i}-date`, post.date, 'deck-promo-date')}<a class="deck-promo-source" href="${escape(post.url)}" target="_blank" rel="noopener noreferrer">${text('span', `post-${i}-link-label`, 'View post ↗')}</a></div></article>`).join('')}</div>`;
    case 'founders':
      return `<div class="deck-founder-pair">${slide.founders.map((founder,i) => `<section class="deck-founder"><div class="deck-founder-photo"><div class="deck-founder-frame"><div class="deck-founder-clip"><img src="${asset(founder.image)}" alt="${escape(founder.name)}" width="925" height="927" decoding="async"></div></div></div><div class="deck-founder-copy">${text('span', `founder-${i}-role`, founder.role, 'deck-founder-role')}${text('h3', `founder-${i}-name`, founder.name)}${text('p', `founder-${i}-bio`, founder.description)}</div></section>`).join('')}</div>`;
    case 'approach':
      return `<ol class="deck-flow">${slide.steps.map((step,i) => `<li>${text('span', `step-${i}-kicker`, step.kicker, 'deck-flow-kicker')}<span class="deck-flow-number" aria-hidden="true">${pad(i)}</span>${text('h3', `step-${i}-title`, step.title)}${text('p', `step-${i}-description`, step.description)}</li>`).join(arrow)}</ol>`;
    case 'selection':
      return `<div class="deck-funnel"><div class="deck-funnel-pool">${text('h3', 'from', slide.from)}<div class="deck-dots" aria-hidden="true"></div></div>${arrow}<ol class="deck-filters">${items.map((item,i) => `<li><span class="deck-filter-number" aria-hidden="true">${pad(i)}</span><div>${text('h3', `item-${i}-title`, item.title)}${text('p', `item-${i}-description`, item.description)}</div></li>`).join('')}</ol>${arrow}<div class="deck-funnel-result">${text('h3', 'to', slide.to)}<div class="deck-picks" aria-hidden="true">${'<span></span>'.repeat(6)}</div></div></div>${statement(slide)}`;
    case 'relevance':
      return `<div class="deck-versus">${slide.versus.map((side,i) => `<section class="deck-versus-${i ? 'right' : 'big'}"><div class="deck-versus-shape" aria-hidden="true"></div>${text('h3', `versus-${i}-title`, side.title)}${text('p', `versus-${i}-description`, side.description)}</section>`).join('<span class="deck-versus-sign" aria-hidden="true">&lt;</span>')}</div>${statement(slide)}`;
    case 'audience':
      return `<ol class="deck-words">${items.map((item,i) => `<li>${text('h3', `item-${i}-title`, item.title)}${text('p', `item-${i}-description`, item.description)}</li>`).join('')}</ol>${statement(slide)}`;
    case 'process':
      return `<ol class="deck-timeline">${items.map((item,i) => `<li><span class="deck-timeline-dot" aria-hidden="true">${i+1}</span>${text('h3', `item-${i}-title`, item.title)}${text('p', `item-${i}-description`, item.description)}</li>`).join('')}</ol>`;
    case 'commitment':
      return `<div class="deck-commitment-body"><div class="deck-commitment-main">${text('p', 'cpm-label', slide.label, 'deck-cpm-label')}${text('div', 'cpm', slide.cpm, 'deck-cpm')}</div><div class="deck-commitment-side">${text('p', 'paragraph-0', slide.paragraphs[0], 'deck-commitment-line')}<div class="deck-compensation">${text('span', 'compensation-label', 'If delivery falls short')}${text('p', 'compensation', slide.compensation)}</div></div></div>`;
    case 'analysis':
      return `<ol class="deck-questions">${items.map((item,i) => `<li><span aria-hidden="true">${pad(i)}</span>${text('h3', `item-${i}-title`, item.title)}${text('p', `item-${i}-description`, item.description)}</li>`).join('')}</ol>`;
    case 'paid':
      return `<ol class="deck-equation">${items.map((item,i) => `<li${i === items.length-1 ? ' class="deck-equation-result"' : ''}>${text('h3', `item-${i}-title`, item.title)}${text('p', `item-${i}-description`, item.description)}</li>`).join('<span class="deck-operator" aria-hidden="true">+</span>').replace(/<span class="deck-operator" aria-hidden="true">\+<\/span>(?!.*deck-operator)/s, '<span class="deck-operator" aria-hidden="true">=</span>')}</ol>`;
    case 'optimisation':
      return `<div class="deck-loop-body"><ol class="deck-loop">${items.map((item,i) => `<li style="--i:${i}">${text('span', `item-${i}-title`, item.title)}</li>`).join('')}</ol>${statement(slide)}</div>`;
    case 'closing':
      return `<div class="deck-closing-body">${text('p', 'paragraph-0', slide.paragraphs[0], 'deck-closing-label')}<ul class="deck-chips">${items.map((item,i) => `<li>${text('span', `item-${i}-title`, item.title)}</li>`).join('')}</ul></div>${statement(slide)}`;
    case 'end':
      return `<div class="deck-end-glow" role="img" aria-label="Sentient"><div class="deck-end-logo"></div></div>`;
    default:
      return statement(slide);
  }
}

// The whole presentation: header, every slide (hidden but the current one, so
// the shared title band measures all headings) and the controls.
export const deckMarkup = (deck, current) => `<main class="deck-player" aria-label="${escape(deck.title)}"><header class="deck-header"><button class="deck-brand" type="button" aria-label="Sentient"><img src="${asset('/assets/sentient-logo.svg')}" width="180" height="38" alt="Sentient"></button><span class="deck-name">${escape(deck.name ?? deck.title)}</span></header><div class="deck-stage">${deck.slides.map((slide,i) => `<article class="deck-slide deck-${escape(slide.layout)}" data-slide="${i}"${slide.blocks && !fixedSurface(slide.layout) ? ` data-surface="${surfaceOf(slide)}"` : ''} role="group" aria-roledescription="slide" aria-label="${i+1} of ${deck.slides.length}: ${escape(slide.title)}" ${i !== current ? 'hidden' : ''}><div class="deck-slide-top"><span>${escape(slide.section)}</span><span class="deck-slide-id">${String(i+1).padStart(2,'0')}</span></div>${heading(slide)}<div class="deck-fit-area"><div class="deck-content"><div class="deck-composition">${composition(slide)}</div>${slide.note ? text('p', 'note', slide.note, 'deck-note') : ''}</div></div></article>`).join('')}</div><footer class="deck-controls"><div class="deck-counter"><span data-deck-current>${String(current+1).padStart(2,'0')}</span><span> / ${String(deck.slides.length).padStart(2,'0')}</span></div><div class="deck-progress" aria-label="Choose a slide">${deck.slides.map((slide,i) => `<button type="button" data-go="${i}" aria-label="Slide ${i+1}: ${escape(slide.section)}" ${i === current ? 'aria-current="step"' : ''}><span></span></button>`).join('')}</div><div class="deck-navigation"><span class="deck-key-hint">← → to navigate</span><button type="button" data-deck-action="previous" aria-label="Previous slide">←</button><button type="button" data-deck-action="next" aria-label="Next slide">→</button></div></footer><span class="deck-announcement" role="status" aria-live="polite" aria-atomic="true"></span><dialog class="deck-overview" aria-labelledby="deck-overview-title"><div class="deck-overview-head"><h2 id="deck-overview-title">${escape(deck.overviewTitle ?? deck.title)}</h2><button type="button" data-deck-action="close-overview" aria-label="Close slide overview">×</button></div><ol>${deck.slides.map((slide,i) => `<li><button type="button" data-go="${i}"><span>${String(i+1).padStart(2,'0')}</span><strong>${escape(slide.section)}</strong><small>${escape(slide.title)}</small></button></li>`).join('')}</ol></dialog></main>`;

// Studio decks: `~id` is a draft in this browser (the studio's Present
// button); any other slug is a published deck, read from the deck Worker, or
// this browser's copy of it when it has not been published yet.
async function studioDeck(slug) {
  if (slug.startsWith('~')) return getDeck(slug.slice(1)).catch(() => null);
  try {
    const published = await fetchPublished(slug);
    return { slug, title:published.title, slides:published.deck.slides };
  } catch (error) {
    return error.status === 404 || error.status === 0 ? getDeckBySlug(slug).catch(() => null) : null;
  }
}

export function parseDeckHash(hash) {
  const match = /^#\/([^/]+)(?:\/(\d+))?\/?$/.exec(hash);
  if (!match) return null;
  let slug;
  try { slug = decodeURIComponent(match[1]); } catch { return null; }
  return { slug, slide: Math.max(0, Number(match[2] ?? 1) - 1) };
}

export async function mountDeck(hash) {
  const route = parseDeckHash(hash);
  const deck = decks.find(item => item.slug === route?.slug) ?? (route ? await studioDeck(route.slug) : null);
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
  document.body.innerHTML = deckMarkup(deck, current);
  delete document.documentElement.dataset.deck;
  const root = document.querySelector('.deck-player');
  registerEditableFields(root, deck);
  const fit = initDeckFit(root);
  const pickers = initDeckPickers({ root, deck, asset });
  const brand = root.querySelector('.deck-brand');
  const header = root.querySelector('.deck-header');
  const coverMark = root.querySelector('.deck-cover-mark');
  // The website's 3D Sentient emblem loads only once the cover is shown.
  const coverEmblem = root.querySelector('.deck-cover-emblem');
  // It belongs to the slide surface, not the fitted body, so it sizes against the screen.
  coverEmblem?.closest('.deck-slide')?.prepend(coverEmblem);
  let emblem;
  const showEmblem = () => {
    if (emblem || !coverEmblem) return;
    emblem = import('../site/src/scene.mjs').then(({ createScene }) => root.isConnected ? createScene(coverEmblem) : null).catch(() => null);
  };
  let editor;
  let exporting = false;
  const downloadPdf = async onProgress => {
    if (exporting) return;
    exporting = true;
    const wasEditing = root.classList.contains('deck-editing');
    const original = current;
    try {
      const { choosePdfSlides } = await import('./pdf-dialog.mjs');
      const choices = { ...deck, slides:deck.slides.map((slide, index) => ({ ...slide,
        title:slides[index].querySelector('.deck-title')?.textContent ?? slide.title,
        section:slides[index].querySelector('.deck-slide-top>span')?.textContent ?? slide.section })) };
      const slideIndices = await choosePdfSlides(choices);
      if (!slideIndices) return;
      root.classList.remove('deck-editing');
      const { exportDeckPdf, snapshotCanvas } = await import('./pdf-export.mjs');
      return await exportDeckPdf({ root, deck, current:original, slideIndices, showSlide:index => sync(index, false), onProgress,
        beforeCapture:async () => snapshotCanvas(root, await emblem) });
    } finally {
      if (wasEditing) root.classList.add('deck-editing');
      exporting = false;
    }
  };
  const configureEditor = async () => {
    const config = await fetch(new URL('../comments-config.json', import.meta.url)).then(response => response.json()).catch(() => ({}));
    if (!root.isConnected) return;
    editor = initDeckEditor({ root, deck, apiUrl:config.apiUrl, onFieldsApplied:() => { pickers.sync(); fit.update(); }, onDownloadPdf:downloadPdf });
    const deckApi = config.apiUrl ? `${String(config.apiUrl).replace(/\/+$/, '')}/decks/${encodeURIComponent(deck.slug)}` : '';
    pickers.connect({ coverBase:deckApi, lookup:url => editor.lookupPost(url), lookupAccount:handle => editor.lookupAccount(handle) });
  };
  // Every deck uses the same inline editor and its own shared text revision.
  void configureEditor();
  window.addEventListener('pagehide', () => { editor?.dispose(); fit.dispose(); void emblem?.then(scene => scene?.dispose()); }, { once:true });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  const slides = [...root.querySelectorAll('.deck-slide')];
  const dialog = root.querySelector('dialog');
  const prev = root.querySelector('[data-deck-action="previous"]');
  const next = root.querySelector('[data-deck-action="next"]');
  const announce = root.querySelector('.deck-announcement');
  const sync = (index, speak = true) => {
    current = Math.max(0, Math.min(index, slides.length - 1));
    root.dataset.theme = surfaceOf(deck.slides[current]);
    root.dataset.layout = deck.slides[current].layout;
    if (root.dataset.layout === 'opening') { coverMark?.append(brand); showEmblem(); }
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
    if (speak) announce.textContent = `Slide ${current+1} of ${slides.length}. ${deck.slides[current].title}`;
  };
  const go = index => {
    if (exporting) return;
    const destination = Math.max(0, Math.min(index, slides.length - 1));
    const nextHash = `#/${deck.slug}${destination ? `/${destination+1}` : ''}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
    sync(destination);
  };
  window.addEventListener('beforeprint', () => coverMark?.append(brand));
  window.addEventListener('afterprint', () => sync(current, false));
  const openOverview = () => { dialog.showModal(); dialog.querySelector(`[data-go="${current}"]`).focus(); };
  const closeOverview = () => { dialog.close(); brand.focus(); };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch { announce.textContent = 'Fullscreen is unavailable in this browser. The presentation is still ready to use.'; }
  };
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
      case 'close-overview': closeOverview(); break;
    }
  });
  dialog.addEventListener('cancel', () => brand.focus());
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
    else if (key === 'g') { event.preventDefault(); openOverview(); }
  });
  let touchStart;
  root.querySelector('.deck-stage').addEventListener('touchstart', event => {
    if (event.target.closest('a, button, input, select, [contenteditable]')) return;
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
