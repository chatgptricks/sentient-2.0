// Deck Studio (`#/studio`): a simplified Canva for Sentient decks. Slides are
// built from the campaign deck's templates and elements, edited inline on a
// live canvas that uses the presentation's own renderer, kept in this
// browser, and published through the deck Worker so their link opens anywhere.
import './studio.css';
import { blockGroups, blockTypes, campaignAsStudioDeck, fixedSurface, newBlock, newId, slideFromTemplate, surfaceOf, surfaces, templates } from './blocks.mjs';
import { deleteDeck, getDeck, getDeckBySlug, listDecks, putDeck, slugify } from './studio-store.mjs';
import * as api from './studio-api.mjs';
import { accountCatalog } from './pickers.mjs';
import { campaignDeck } from './campaign-deck.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const logo = new URL('../assets/sentient-logo.svg', import.meta.url).href;
const frameScript = new URL('./studio-frame.js', import.meta.url).href;
const frameStyles = new URL('./studio-frame.css', import.meta.url).href;
const copy = value => structuredClone(value);
const pathKeys = path => String(path).split('.').map(key => /^\d+$/.test(key) ? Number(key) : key);
const getPath = (object, path) => pathKeys(path).reduce((value, key) => value?.[key], object);
const setPath = (object, path, value) => {
  const keys = pathKeys(path);
  const last = keys.pop();
  const parent = keys.reduce((target, key) => target[key], object);
  parent[last] = value;
};
const presentUrl = (hash) => `${location.origin}${location.pathname}${location.search}#/${hash}`;
const dateTime = time => new Date(time).toLocaleString('es-CR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
const catalog = accountCatalog(campaignDeck.slides.find(slide => slide.layout === 'accounts'));
const portraits = [['/assets/founders/louis-cutout.webp', 'Louis'], ['/assets/founders/ivan-cutout.webp', 'Ivan']];

// The editor password stays in memory for this tab only.
let password = '';

// ---- Frames: every preview is the real presentation at 1600×900. ----------
const scaleObserver = new ResizeObserver(entries => entries.forEach(entry => entry.target.style.setProperty('--s', entry.contentRect.width / 1600)));
function createFrame() {
  const iframe = document.createElement('iframe');
  iframe.tabIndex = -1;
  iframe.title = 'Slide preview';
  iframe.srcdoc = `<!doctype html><html lang="en" data-deck="true"><head><meta charset="utf-8"><link rel="stylesheet" href="${frameStyles}"><script type="module" src="${frameScript}"></script></head><body class="deck-mode"></body></html>`;
  const ready = new Promise(resolve => iframe.addEventListener('load', () => resolve(iframe.contentWindow?.studioFrame ?? null), { once:true }));
  return { iframe, ready };
}
// Thumbnails load only once they scroll into view.
const lazy = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  lazy.unobserve(entry.target);
  entry.target.studioLoad?.();
}), { rootMargin:'200px' });
function thumbnail(deck, index) {
  const element = document.createElement('div');
  element.className = 'studio-thumb';
  let iframe;
  let state = [deck, index];
  const draw = () => iframe?.contentWindow?.studioFrame?.render(...state, { emblem:false });
  element.studioLoad = () => {
    ({ iframe } = createFrame());
    // A frame reloads whenever it moves in the page, so every load redraws.
    iframe.addEventListener('load', draw);
    element.append(iframe);
  };
  scaleObserver.observe(element);
  lazy.observe(element);
  return { element, update(nextDeck, nextIndex) { state = [nextDeck, nextIndex]; draw(); } };
}

// ---- Images: uploads are resized to WebP and kept inline until publishing. --
async function readImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Elige una imagen.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/webp', .86);
}
const inlineImages = value => {
  const found = new Set();
  const walk = item => {
    if (typeof item === 'string' && item.startsWith('data:image/')) found.add(item);
    else if (Array.isArray(item)) item.forEach(walk);
    else if (item && typeof item === 'object') Object.values(item).forEach(walk);
  };
  walk(value);
  return [...found];
};
const replaceStrings = (value, map) => {
  if (typeof value === 'string') return map.get(value) ?? value;
  if (Array.isArray(value)) return value.map(item => replaceStrings(item, map));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceStrings(item, map)]));
  return value;
};

// ---- Dialogs ---------------------------------------------------------------
function dialog(html, className = '') {
  const element = document.createElement('dialog');
  element.className = `studio-dialog ${className}`;
  element.innerHTML = `<button class="studio-dialog-close" type="button" aria-label="Cerrar">×</button>${html}`;
  document.body.append(element);
  element.addEventListener('close', () => element.remove());
  element.querySelector('.studio-dialog-close').addEventListener('click', () => element.close());
  element.addEventListener('click', event => { if (event.target === element) element.close(); });
  element.showModal();
  return element;
}

// Resolves with the editor password, asking for it once per tab.
function ensurePassword(reason = 'Publicar usa la contraseña del editor de decks.') {
  if (password) return Promise.resolve(password);
  return new Promise(resolve => {
    const element = dialog(`<form class="studio-form"><h2>Contraseña del editor</h2><p>${escape(reason)}</p><input type="password" autocomplete="current-password" required aria-label="Contraseña"><p class="studio-form-error" role="status"></p><button class="studio-primary" type="submit">Continuar</button></form>`);
    const input = element.querySelector('input');
    const error = element.querySelector('.studio-form-error');
    const button = element.querySelector('[type=submit]');
    input.focus();
    let result = '';
    element.addEventListener('close', () => resolve(result));
    element.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      button.disabled = true;
      error.textContent = '';
      try {
        await api.checkPassword(input.value);
        password = result = input.value;
        // Continue at once: browsers may defer a dialog's close event (for example in a background tab).
        resolve(result);
        element.close();
        element.remove();
      } catch (failure) {
        error.textContent = failure.status === 401 ? 'Contraseña incorrecta.' : failure.message;
        input.select();
      } finally { button.disabled = false; }
    });
  });
}

function toast(message, tone = '') {
  const element = document.createElement('div');
  element.className = `studio-toast ${tone}`;
  element.setAttribute('role', 'status');
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.classList.add('studio-toast-out'), 3200);
  setTimeout(() => element.remove(), 3700);
}

function download(name, value) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type:'application/json' }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// A deck file from this studio (or a published deck) becomes a new local deck.
function deckFromJson(data) {
  const source = data?.format === 'sentient-deck' ? data.deck : data?.deck ?? data;
  if (!source || !Array.isArray(source.slides) || !source.slides.length) throw new Error('Este archivo no es un deck del Studio.');
  const slides = source.slides.map(slide => ({ ...slide, id:slide.id || newId(), blocks:(slide.blocks ?? []).filter(block => blockTypes[block?.type]) }));
  if (slides.some(slide => typeof slide.title !== 'string')) throw new Error('Este archivo no es un deck del Studio.');
  return { title:String(source.title || 'Deck importado').slice(0, 200), slides };
}

async function createDeck(source, extra = {}) {
  const id = newId();
  const deck = { id, slug:slugify(source.title, id), title:source.title, slides:source.slides, createdAt:Date.now(), ...extra };
  await putDeck(deck);
  return deck;
}

// ---- Home ------------------------------------------------------------------
async function renderHome(app) {
  document.title = 'Deck Studio — Sentient';
  const decks = await listDecks();
  app.innerHTML = `<div class="studio-home">
    <header class="studio-home-head"><img src="${logo}" alt="Sentient" width="150" height="32"><span>Deck Studio</span></header>
    <section class="studio-hero"><h1>Decks con las plantillas y elementos del Campaign deck.</h1><p>Elige una plantilla, añade elementos, edita el texto directamente en la diapositiva y publica un enlace que funciona en cualquier pantalla.</p>
      <div class="studio-hero-actions"><button class="studio-primary" data-act="new-blank">+ Deck nuevo</button><button data-act="new-campaign">Partir del Campaign deck</button><label class="studio-button">Importar JSON<input type="file" accept="application/json,.json" hidden data-act="import"></label></div>
    </section>
    <section><div class="studio-section-head"><h2>Tus decks</h2><p>Se guardan en este navegador mientras trabajas. Publica un deck para compartirlo.</p></div>
      ${decks.length ? '<ul class="studio-deck-grid"></ul>' : '<p class="studio-empty">Todavía no hay decks. Empieza con uno nuevo o desde el Campaign deck.</p>'}
    </section>
    <section><div class="studio-section-head"><h2>Publicados</h2><p>Decks publicados por el equipo. Puedes abrir su enlace o editar una copia.</p></div>
      <div class="studio-published"><button data-act="load-published">Ver decks publicados</button></div>
    </section>
  </div>`;
  const grid = app.querySelector('.studio-deck-grid');
  decks.forEach(deck => {
    const item = document.createElement('li');
    item.className = 'studio-deck-card';
    const preview = thumbnail(deck, 0);
    item.innerHTML = `<a class="studio-deck-open" href="#/studio/${deck.id}" aria-label="Editar ${escape(deck.title)}"></a><div class="studio-deck-meta"><strong>${escape(deck.title)}</strong><span>${deck.slides.length} diapositivas · editado ${dateTime(deck.updatedAt)}</span>${deck.published ? `<span class="studio-badge">Publicado</span>` : ''}</div><div class="studio-deck-actions"><a href="#/studio/${deck.id}">Editar</a><button data-act="present" data-id="${deck.id}">Presentar</button><button data-act="duplicate" data-id="${deck.id}">Duplicar</button><button data-act="delete" data-id="${deck.id}">Eliminar</button></div>`;
    item.querySelector('.studio-deck-open').append(preview.element);
    grid.append(item);
  });
  app.onclick = async event => {
    const target = event.target.closest('[data-act]');
    if (!target || target.matches('input')) return;
    const act = target.dataset.act;
    if (act === 'new-blank') {
      const pick = id => slideFromTemplate(templates().find(template => template.id === id));
      const slides = [pick('opening'), pick('blank'), pick('end')];
      slides[0].blocks[0].lines = [{ text:'A new deck.' }, { text:'One clear idea.' }, { text:'Clear results.' }];
      slides[0].title = 'A new deck. One clear idea. Clear results.';
      slides.forEach(item => { if (item.layout !== 'blank') item.section = 'Sentient'; });
      const deck = await createDeck({ title:'Nuevo deck', slides });
      location.hash = `#/studio/${deck.id}`;
    }
    if (act === 'new-campaign') {
      const deck = await createDeck({ ...campaignAsStudioDeck(), title:'Campaign deck (copia)' });
      location.hash = `#/studio/${deck.id}`;
    }
    if (act === 'present') window.open(presentUrl(`~${target.dataset.id}`), '_blank', 'noopener');
    if (act === 'duplicate') {
      const source = await getDeck(target.dataset.id);
      await createDeck({ title:`${source.title} (copia)`, slides:copy(source.slides) });
      void renderHome(app);
    }
    if (act === 'delete') {
      const source = await getDeck(target.dataset.id);
      const note = source.published ? ' La versión publicada seguirá en línea hasta que la despubliques.' : '';
      if (!confirm(`¿Eliminar «${source.title}» de este navegador?${note}`)) return;
      await deleteDeck(source.id);
      void renderHome(app);
    }
    if (act === 'load-published') void renderPublished(app.querySelector('.studio-published'));
  };
  app.querySelector('[data-act=import]').addEventListener('change', async event => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const deck = await createDeck(deckFromJson(JSON.parse(await file.text())));
      location.hash = `#/studio/${deck.id}`;
    } catch (error) { toast(error.message || 'No se pudo importar el archivo.', 'studio-toast-error'); }
  });
}

async function renderPublished(container) {
  if (!(await ensurePassword('Ver los decks publicados usa la contraseña del editor de decks.'))) return;
  container.innerHTML = '<p class="studio-empty">Cargando…</p>';
  try {
    const { decks } = await api.listPublished(password);
    if (!decks.length) { container.innerHTML = '<p class="studio-empty">Todavía no hay decks publicados.</p>'; return; }
    container.innerHTML = `<ul class="studio-published-list">${decks.map(deck => `<li><div><strong>${escape(deck.title)}</strong><span>${deck.slides} diapositivas · revisión ${deck.revision} · ${dateTime(deck.updatedAt)}</span></div><a href="${escape(presentUrl(deck.slug))}" target="_blank" rel="noopener">Abrir enlace ↗</a><button data-published-edit="${escape(deck.slug)}">Editar copia</button></li>`).join('')}</ul>`;
    container.onclick = async event => {
      const slug = event.target.closest('[data-published-edit]')?.dataset.publishedEdit;
      if (!slug) return;
      const published = await api.fetchPublished(slug);
      const local = await getDeckBySlug(slug);
      if (local && !confirm(`Ya tienes una copia local de «${local.title}». ¿Reemplazarla con la versión publicada?`)) { location.hash = `#/studio/${local.id}`; return; }
      const record = { ...(local ?? { id:newId(), createdAt:Date.now() }), slug, title:published.title, slides:published.deck.slides, published:{ revision:published.revision, at:published.updatedAt } };
      await putDeck(record);
      location.hash = `#/studio/${record.id}`;
    };
  } catch (error) {
    container.innerHTML = `<p class="studio-empty">${escape(error.message)}</p><button data-act="load-published">Reintentar</button>`;
  }
}

// ---- Editor ----------------------------------------------------------------
async function renderEditor(app, id) {
  let deck = await getDeck(id);
  if (!deck) { location.hash = '#/studio'; return () => {}; }
  document.title = `${deck.title} — Deck Studio`;
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  let index = 0;
  let selected = null;
  let tab = 'slides';
  const history = [];
  const future = [];
  let lastCoalesce = { key:null, time:0 };
  let saveTimer = 0;
  let saved = true;

  app.innerHTML = `<div class="studio-editor">
    <header class="studio-bar">
      <a class="studio-home-link" href="#/studio" aria-label="Todos los decks"><img src="${logo}" alt="Sentient" width="110" height="23"></a>
      <input class="studio-title" aria-label="Nombre del deck" maxlength="200">
      <span class="studio-save" role="status"></span>
      <div class="studio-bar-actions">
        <button data-act="undo" title="Deshacer (⌘Z)" aria-label="Deshacer">↶</button><button data-act="redo" title="Rehacer (⇧⌘Z)" aria-label="Rehacer">↷</button>
        <button data-act="export" title="Descargar el deck como JSON">Exportar</button>
        <button data-act="present">Presentar ▶</button>
        <button class="studio-primary" data-act="publish">Publicar</button>
      </div>
    </header>
    <aside class="studio-left">
      <div class="studio-tabs" role="tablist"><button role="tab" data-tab="slides">Diapositivas</button><button role="tab" data-tab="templates">Plantillas</button><button role="tab" data-tab="elements">Elementos</button></div>
      <div class="studio-tab-panel" data-panel="slides"><ol class="studio-rail"></ol><button class="studio-add-slide" data-tab="templates">+ Añadir diapositiva</button></div>
      <div class="studio-tab-panel" data-panel="templates" hidden><p class="studio-panel-hint">Se añade después de la diapositiva actual.</p><ul class="studio-template-grid"></ul></div>
      <div class="studio-tab-panel" data-panel="elements" hidden><p class="studio-panel-hint">Se añade a la diapositiva actual.</p><div class="studio-element-groups"></div></div>
    </aside>
    <main class="studio-canvas"><div class="studio-stage"><div class="studio-canvas-frame"></div></div><div class="studio-canvas-foot"><button data-act="prev" aria-label="Diapositiva anterior">←</button><span class="studio-counter"></span><button data-act="next" aria-label="Diapositiva siguiente">→</button><span class="studio-canvas-tip">Haz clic en un texto para editarlo · clic en un elemento para seleccionarlo</span></div></main>
    <aside class="studio-right"></aside>
  </div>`;
  const $ = selector => app.querySelector(selector);
  const titleInput = $('.studio-title');
  const saveStatus = $('.studio-save');
  const rail = $('.studio-rail');
  const inspector = $('.studio-right');
  titleInput.value = deck.title;

  // Canvas: one editable frame, scaled to the space available.
  const canvas = createFrame();
  $('.studio-canvas-frame').append(canvas.iframe);
  const stage = $('.studio-stage');
  const fitCanvas = () => {
    const style = getComputedStyle(stage);
    const width = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scale = Math.max(.1, Math.min(width / 1600, height / 900));
    $('.studio-canvas-frame').style.cssText = `width:${1600 * scale}px;height:${900 * scale}px;--s:${scale}`;
  };
  const stageObserver = new ResizeObserver(fitCanvas);
  stageObserver.observe(stage);
  signal.addEventListener('abort', () => stageObserver.disconnect());

  const slide = () => deck.slides[index];
  const persist = () => {
    saved = false;
    saveStatus.textContent = 'Guardando…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        deck.title = deck.title.trim() || 'Sin título';
        await putDeck(deck);
        saved = true;
        saveStatus.textContent = deck.published ? 'Guardado · hay cambios sin publicar' : 'Guardado en este navegador';
      } catch { saveStatus.textContent = 'No se pudo guardar. Exporta el deck para no perder cambios.'; }
    }, 350);
  };
  const snapshot = () => JSON.stringify({ title:deck.title, slides:deck.slides, index, selected });
  const restore = state => {
    const value = JSON.parse(state);
    Object.assign(deck, { title:value.title, slides:value.slides });
    index = Math.min(value.index, deck.slides.length - 1);
    selected = value.selected;
    titleInput.value = deck.title;
    persist();
    renderAll();
  };
  // Every change goes through here: one history entry per action, with
  // consecutive typing in the same field merged into one.
  const change = (mutate, { coalesce = null, render = 'all' } = {}) => {
    const now = Date.now();
    if (!coalesce || coalesce !== lastCoalesce.key || now - lastCoalesce.time > 1500) {
      history.push(snapshot());
      if (history.length > 200) history.shift();
    }
    lastCoalesce = { key:coalesce, time:now };
    future.length = 0;
    mutate();
    persist();
    if (render === 'all') renderAll();
    else if (render === 'canvas') { scheduleCanvas(); scheduleThumbs(); }
    else scheduleThumbs();
    syncBar();
  };
  const undo = () => { if (!history.length) return; future.push(snapshot()); restore(history.pop()); lastCoalesce = { key:null, time:0 }; };
  const redo = () => { if (!future.length) return; history.push(snapshot()); restore(future.pop()); lastCoalesce = { key:null, time:0 }; };

  const syncBar = () => {
    $('[data-act=undo]').disabled = !history.length;
    $('[data-act=redo]').disabled = !future.length;
    $('.studio-counter').textContent = `${index + 1} / ${deck.slides.length}`;
    $('[data-act=prev]').disabled = index === 0;
    $('[data-act=next]').disabled = index === deck.slides.length - 1;
    $('[data-act=publish]').textContent = deck.published ? 'Actualizar publicación' : 'Publicar';
  };

  // ---- Canvas ----
  const renderCanvas = async () => {
    const frame = await canvas.ready;
    frame?.render(deck, index, {
      editable:true, emblem:true, selected,
      // Inline edits update the data without redrawing, so the caret stays put.
      onEdit:(path, value) => {
        change(() => setPath(slide(), path, value), { coalesce:`text:${slide().id}:${path}`, render:'none' });
        if (path === 'title' && slide().layout === 'opening') return;
        inspector.querySelectorAll(`[data-path="${CSS.escape(path)}"]`).forEach(input => { if (document.activeElement !== input) input.value = value; });
      },
      onSelect:block => { selected = block; renderInspector(); },
    });
  };
  let canvasTimer = 0;
  const scheduleCanvas = () => { clearTimeout(canvasTimer); canvasTimer = setTimeout(renderCanvas, 140); };

  // ---- Slide rail ----
  const railThumbs = new Map();
  let railOrder = '';
  const railItem = (item, entry) => {
    const li = document.createElement('li');
    li.className = 'studio-rail-item';
    li.draggable = true;
    li.innerHTML = `<span class="studio-rail-number"></span><button class="studio-rail-select"></button><div class="studio-rail-tools"><button data-act="dup-slide" title="Duplicar" aria-label="Duplicar diapositiva">⧉</button><button data-act="del-slide" title="Eliminar" aria-label="Eliminar diapositiva">✕</button></div>`;
    li.querySelector('.studio-rail-select').append(entry.thumb.element);
    return li;
  };
  const renderRail = () => {
    // Items are only moved when the order changes: moving a frame reloads it.
    const order = deck.slides.map(item => item.id).join();
    if (order !== railOrder) {
      railOrder = order;
      const seen = new Set();
      rail.replaceChildren(...deck.slides.map((item, i) => {
        let entry = railThumbs.get(item.id);
        if (!entry) { entry = { thumb:thumbnail(copy(deck), i), key:'' }; entry.li = railItem(item, entry); railThumbs.set(item.id, entry); }
        seen.add(item.id);
        return entry.li;
      }));
      for (const key of railThumbs.keys()) if (!seen.has(key)) railThumbs.delete(key);
    }
    deck.slides.forEach((item, i) => {
      const { li } = railThumbs.get(item.id);
      li.classList.toggle('is-current', i === index);
      li.dataset.index = i;
      li.querySelector('.studio-rail-number').textContent = i + 1;
      const select = li.querySelector('.studio-rail-select');
      select.dataset.go = i;
      select.setAttribute('aria-label', `Diapositiva ${i + 1}: ${item.title}`);
      li.querySelectorAll('.studio-rail-tools button').forEach(button => { button.dataset.index = i; });
      li.querySelector('[data-act=del-slide]').disabled = deck.slides.length === 1;
    });
    refreshThumbs();
    rail.querySelector('.is-current')?.scrollIntoView({ block:'nearest' });
  };
  const refreshThumbs = () => {
    deck.slides.forEach((item, i) => {
      const entry = railThumbs.get(item.id);
      const key = JSON.stringify([i, item]);
      if (entry && entry.key !== key) { entry.key = key; entry.thumb.update(copy(deck), i); }
    });
  };
  let thumbTimer = 0;
  const scheduleThumbs = () => { clearTimeout(thumbTimer); thumbTimer = setTimeout(refreshThumbs, 700); };
  let dragFrom = null;
  rail.addEventListener('dragstart', event => { dragFrom = Number(event.target.closest('[data-index]')?.dataset.index); event.dataTransfer.effectAllowed = 'move'; }, { signal });
  rail.addEventListener('dragover', event => {
    const over = event.target.closest('.studio-rail-item');
    if (dragFrom === null || !over) return;
    event.preventDefault();
    rail.querySelectorAll('.is-drop').forEach(item => item.classList.remove('is-drop'));
    over.classList.add('is-drop');
  }, { signal });
  rail.addEventListener('drop', event => {
    event.preventDefault();
    const to = Number(event.target.closest('[data-index]')?.dataset.index);
    if (dragFrom === null || Number.isNaN(to) || to === dragFrom) { renderRail(); return; }
    const from = dragFrom;
    change(() => {
      const current = deck.slides[index];
      const [moved] = deck.slides.splice(from, 1);
      deck.slides.splice(to, 0, moved);
      index = deck.slides.indexOf(current);
    });
  }, { signal });
  rail.addEventListener('dragend', () => { dragFrom = null; rail.querySelectorAll('.is-drop').forEach(item => item.classList.remove('is-drop')); }, { signal });

  // ---- Templates and elements ----
  const templateList = templates();
  const templateDeck = { title:'Plantillas', slides:templateList.map(template => ({ id:template.id, ...template.slide })) };
  $('.studio-template-grid').replaceChildren(...templateList.map((template, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button data-template="${template.id}"><span>${escape(template.name)}</span></button>`;
    li.querySelector('button').prepend(thumbnail(templateDeck, i).element);
    return li;
  }));
  const elementTypes = Object.entries(blockTypes).filter(([, type]) => !type.templateOnly);
  const elementDeck = { title:'Elementos', slides:elementTypes.map(([type, definition]) => ({ id:type, layout:'blank', surface:'dark', section:definition.group, title:definition.label, blocks:[newBlock(type)] })) };
  $('.studio-element-groups').innerHTML = blockGroups.map(group => `<section><h3>${group}</h3><ul class="studio-element-grid">${elementTypes.map(([type, definition], i) => definition.group === group ? `<li><button data-element="${type}" data-i="${i}"><strong>${escape(definition.label)}</strong><small>${escape(definition.hint)}</small></button></li>` : '').join('')}</ul></section>`).join('');
  $('.studio-element-groups').querySelectorAll('[data-element]').forEach(button => button.prepend(thumbnail(elementDeck, Number(button.dataset.i)).element));

  const setTab = next => {
    tab = next;
    app.querySelectorAll('[role=tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
    app.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== tab; });
  };

  // ---- Inspector ----
  const input = (path, value, type = 'text', label = '') => type === 'textarea'
    ? `<textarea data-path="${path}" rows="${String(value ?? '').length > 60 ? 3 : 2}" aria-label="${escape(label)}">${escape(value)}</textarea>`
    : `<input data-path="${path}" type="${type === 'url' ? 'url' : 'text'}" value="${escape(value)}" aria-label="${escape(label)}">`;
  const fieldMarkup = (definition, base, value) => {
    const path = `${base}.${definition.key}`;
    if (definition.type === 'choice') return `<label class="studio-field"><span>${definition.label}</span><select data-path="${path}">${definition.options.map(([option, name]) => `<option value="${option}" ${option === value ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`;
    if (definition.type === 'image') {
      const presets = definition.label.startsWith('Retrato') ? `<div class="studio-presets">${portraits.map(([src, name]) => `<button type="button" data-image-preset="${path}" data-src="${src}">${name}</button>`).join('')}</div>` : '';
      return `<div class="studio-field studio-image-field"><span>${definition.label}</span><div class="studio-image-row"><img src="${escape(previewSrc(value))}" alt=""><div><label class="studio-button studio-small">Subir imagen<input type="file" accept="image/*" hidden data-upload="${path}"></label>${presets}</div></div>${input(path, String(value ?? '').startsWith('data:') ? '' : value, 'url', `${definition.label} (enlace)`).replace('<input', '<input placeholder="o pega un enlace a la imagen"')}</div>`;
    }
    return `<label class="studio-field"><span>${definition.label}</span>${input(path, value, definition.type, definition.label)}</label>`;
  };
  const previewSrc = value => /^(data:|https?:)/.test(value ?? '') ? value : new URL(`..${value}`, import.meta.url).href;
  const blockLabel = block => blockTypes[block.type]?.label ?? block.type;

  const renderInspector = () => {
    const current = slide();
    const block = selected !== null ? current.blocks?.[selected] : null;
    if (selected !== null && !block) selected = null;
    if (block) {
      const type = blockTypes[block.type];
      const base = `blocks.${selected}`;
      const count = current.blocks.length;
      inspector.innerHTML = `<div class="studio-inspector">
        <button class="studio-back" data-act="deselect">← Diapositiva ${index + 1}</button>
        <div class="studio-inspector-head"><h2>${escape(type.label)}</h2>${type.hint ? `<p>${escape(type.hint)}</p>` : ''}</div>
        ${type.templateOnly ? '' : `<div class="studio-block-actions"><button data-act="block-up" ${selected === 0 ? 'disabled' : ''} title="Subir">↑</button><button data-act="block-down" ${selected === count - 1 ? 'disabled' : ''} title="Bajar">↓</button><button data-act="block-dup">Duplicar</button><button data-act="block-del" class="studio-danger">Eliminar</button></div>`}
        ${(type.fields ?? []).map(definition => fieldMarkup(definition, base, block[definition.key])).join('')}
        ${(type.lists ?? []).map(list => {
          const values = block[list.key] ?? [];
          return `<fieldset class="studio-list"><legend>${list.label} <small>${values.length}${list.max ? ` / ${list.max}` : ''}</small></legend>
            ${values.map((item, i) => `<details class="studio-item" ${values.length <= 3 ? 'open' : ''}><summary><span>${i + 1}. ${escape(item[list.fields[0].key === 'image' ? list.fields[2]?.key ?? 'title' : list.fields[0].key] ?? '')}</span><span class="studio-item-tools"><button data-act="item-up" data-list="${list.key}" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button data-act="item-down" data-list="${list.key}" data-i="${i}" ${i === values.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button><button data-act="item-del" data-list="${list.key}" data-i="${i}" ${values.length <= (list.min ?? 0) ? 'disabled' : ''} aria-label="Eliminar">✕</button></span></summary>
              ${list.account ? `<label class="studio-field"><span>Cuenta de Sentient</span><select data-account="${base}.${list.key}.${i}"><option value="">Elegir…</option>${[...catalog.values()].map(account => `<option value="${escape(account.id)}">${escape(account.handle)} · ${Number(account.followers).toLocaleString('en-US')}</option>`).join('')}</select></label><button class="studio-small" data-act="followers" data-item="${base}.${list.key}.${i}">↻ Seguidores exactos de SentientDash</button>` : ''}
              ${block.type === 'promos' ? `<form class="studio-lookup" data-post="${base}.${list.key}.${i}"><input type="url" placeholder="Pega un link de Instagram" aria-label="Link de Instagram"><button class="studio-small" type="submit">Buscar en SentientDash</button></form>` : ''}
              ${list.fields.map(definition => fieldMarkup(definition, `${base}.${list.key}.${i}`, item[definition.key])).join('')}
            </details>`).join('')}
            ${list.blank && (!list.max || values.length < list.max) ? `<button class="studio-small" data-act="item-add" data-list="${list.key}">+ Añadir</button>` : ''}
          </fieldset>`;
        }).join('')}
      </div>`;
      return;
    }
    const fixed = fixedSurface(current.layout);
    inspector.innerHTML = `<div class="studio-inspector">
      <div class="studio-inspector-head"><h2>Diapositiva ${index + 1}</h2><p>${escape(templateList.find(template => template.id === current.layout)?.name ?? 'Diapositiva')}</p></div>
      <div class="studio-field"><span>Fondo</span>${fixed ? '<p class="studio-muted">La portada y el logo final usan siempre el fondo oscuro.</p>' : `<div class="studio-swatches">${surfaces.map(surface => `<button data-surface="${surface.id}" aria-pressed="${surfaceOf(current) === surface.id}"><i class="studio-swatch-${surface.id}"></i>${surface.label}</button>`).join('')}</div>`}</div>
      <label class="studio-field"><span>Sección</span>${input('section', current.section, 'text', 'Sección')}</label>
      <label class="studio-field"><span>${current.layout === 'opening' ? 'Título (para lectores de pantalla)' : 'Título'}</span>${input('title', current.title, 'textarea', 'Título')}</label>
      ${current.layout === 'end' ? '' : `<label class="studio-field"><span>Nota al pie</span>${input('note', current.note ?? '', 'textarea', 'Nota al pie').replace('<textarea', '<textarea placeholder="Opcional: condiciones, fuentes o fechas"')}</label>`}
      <div class="studio-field"><span>Elementos</span>${current.blocks?.length ? `<ol class="studio-layers">${current.blocks.map((block, i) => `<li><button data-select="${i}">${escape(blockLabel(block))}</button>${blockTypes[block.type]?.templateOnly ? '' : `<span><button data-act="layer-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button data-act="layer-down" data-i="${i}" ${i === current.blocks.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button><button data-act="layer-del" data-i="${i}" aria-label="Eliminar">✕</button></span>`}</li>`).join('')}</ol>` : '<p class="studio-muted">Esta diapositiva no tiene elementos.</p>'}</div>
      ${fixed ? '' : '<button class="studio-small" data-tab="elements">+ Añadir elemento</button>'}
    </div>`;
  };

  const renderAll = () => {
    syncBar();
    renderRail();
    renderInspector();
    void renderCanvas();
  };
  const go = next => {
    if (next < 0 || next >= deck.slides.length) return;
    index = next;
    selected = null;
    renderAll();
  };

  // ---- Actions ----
  const moveIn = (array, from, to) => { const [item] = array.splice(from, 1); array.splice(to, 0, item); };
  const addSlide = templateId => {
    const template = templateList.find(item => item.id === templateId);
    change(() => { deck.slides.splice(index + 1, 0, slideFromTemplate(template)); index += 1; selected = null; });
    setTab('slides');
  };
  const addElement = type => {
    if (fixedSurface(slide().layout)) { toast('La portada y el logo final no admiten elementos. Añade una diapositiva nueva.'); return; }
    change(() => { slide().blocks ??= []; slide().blocks.push(newBlock(type)); selected = slide().blocks.length - 1; });
  };
  const blockPath = () => `blocks.${selected}`;
  const publish = async () => {
    if (!(await ensurePassword())) return;
    const button = $('[data-act=publish]');
    button.disabled = true;
    const label = button.textContent;
    button.textContent = 'Publicando…';
    try {
      // Inline uploads become stored images first, so the deck itself stays small.
      const images = inlineImages(deck.slides);
      const urls = new Map();
      for (const [i, image] of images.entries()) {
        button.textContent = `Subiendo imágenes ${i + 1}/${images.length}…`;
        const blob = await (await fetch(image)).blob();
        urls.set(image, (await api.uploadImage(password, blob)).url);
      }
      if (urls.size) { deck.slides = replaceStrings(deck.slides, urls); await putDeck(deck); }
      button.textContent = 'Publicando…';
      const body = { title:deck.title, slides:deck.slides };
      let result;
      try { result = await api.publishDeck(password, deck.slug, body, deck.published?.revision ?? 0); }
      catch (error) {
        if (error.status !== 409) throw error;
        const other = error.payload?.revision ? `Otra copia publicó «${error.payload.title}» (${dateTime(error.payload.updatedAt)}).` : 'La publicación cambió desde otra copia.';
        if (!confirm(`${other} ¿Reemplazarla con este deck?`)) return;
        result = await api.publishDeck(password, deck.slug, body, error.payload?.revision ?? 0);
      }
      deck.published = { revision:result.revision, at:result.updatedAt };
      await putDeck(deck);
      saveStatus.textContent = `Publicado ${dateTime(result.updatedAt)}`;
      showPublished();
    } catch (error) {
      toast(error.message || 'No se pudo publicar.', 'studio-toast-error');
    } finally {
      button.disabled = false;
      button.textContent = label;
      syncBar();
      renderCanvas();
    }
  };
  const showPublished = () => {
    const link = presentUrl(deck.slug);
    const element = dialog(`<div class="studio-form"><h2>Deck publicado</h2><p>Cualquiera con el enlace puede ver la presentación en cualquier pantalla. Los cambios que hagas luego se ven al pulsar «Actualizar publicación».</p><div class="studio-link"><input readonly value="${escape(link)}" aria-label="Enlace publicado"><button class="studio-primary" data-copy>Copiar</button></div><div class="studio-dialog-actions"><a class="studio-button" href="${escape(link)}" target="_blank" rel="noopener">Abrir ↗</a><button class="studio-danger" data-unpublish>Despublicar</button></div></div>`);
    element.querySelector('input').select();
    element.querySelector('[data-copy]').addEventListener('click', async event => {
      try { await navigator.clipboard.writeText(link); event.target.textContent = 'Copiado ✓'; }
      catch { element.querySelector('input').select(); }
    });
    element.querySelector('[data-unpublish]').addEventListener('click', async () => {
      if (!confirm('¿Despublicar este deck? El enlace dejará de funcionar. Tu copia local se conserva.')) return;
      try {
        await api.unpublishDeck(password, deck.slug);
        deck.published = null;
        await putDeck(deck);
        element.close();
        syncBar();
        toast('Deck despublicado.');
      } catch (error) { toast(error.message, 'studio-toast-error'); }
    });
  };

  app.addEventListener('click', async event => {
    const target = event.target.closest('button, [data-tab]');
    if (!target || target.closest('summary') && target.tagName !== 'BUTTON') return;
    if (target.closest('summary')) event.preventDefault();
    const { act } = target.dataset;
    if (target.dataset.tab) { setTab(target.dataset.tab); return; }
    if (target.dataset.go !== undefined) { go(Number(target.dataset.go)); return; }
    if (target.dataset.template) { addSlide(target.dataset.template); return; }
    if (target.dataset.element) { addElement(target.dataset.element); return; }
    if (target.dataset.surface) { change(() => { slide().surface = target.dataset.surface; }); return; }
    if (target.dataset.select !== undefined) { selected = Number(target.dataset.select); renderInspector(); (await canvas.ready)?.select(selected); return; }
    if (target.dataset.imagePreset) { const path = target.dataset.imagePreset; change(() => setPath(slide(), path, target.dataset.src)); return; }
    const i = Number(target.dataset.i);
    switch (act) {
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'prev': go(index - 1); break;
      case 'next': go(index + 1); break;
      case 'present': await putDeck(deck); window.open(presentUrl(`~${deck.id}/${index + 1}`), '_blank', 'noopener'); break;
      case 'export': download(`${deck.slug}.json`, { format:'sentient-deck', version:1, deck:{ title:deck.title, slides:deck.slides } }); break;
      case 'publish': void publish(); break;
      case 'dup-slide': { const at = Number(target.dataset.index); change(() => { deck.slides.splice(at + 1, 0, { ...copy(deck.slides[at]), id:newId() }); index = at + 1; selected = null; }); break; }
      case 'del-slide': { const at = Number(target.dataset.index); if (deck.slides.length > 1) change(() => { deck.slides.splice(at, 1); index = Math.min(index > at ? index - 1 : index, deck.slides.length - 1); selected = null; }); break; }
      case 'deselect': selected = null; renderInspector(); (await canvas.ready)?.select(null); break;
      case 'block-up': change(() => { moveIn(slide().blocks, selected, selected - 1); selected -= 1; }); break;
      case 'block-down': change(() => { moveIn(slide().blocks, selected, selected + 1); selected += 1; }); break;
      case 'block-dup': change(() => { slide().blocks.splice(selected + 1, 0, copy(slide().blocks[selected])); selected += 1; }); break;
      case 'block-del': change(() => { slide().blocks.splice(selected, 1); selected = null; }); break;
      case 'layer-up': change(() => moveIn(slide().blocks, i, i - 1)); break;
      case 'layer-down': change(() => moveIn(slide().blocks, i, i + 1)); break;
      case 'layer-del': change(() => { slide().blocks.splice(i, 1); selected = null; }); break;
      case 'item-add': { const list = blockTypes[slide().blocks[selected].type].lists.find(item => item.key === target.dataset.list); change(() => getPath(slide(), `${blockPath()}.${list.key}`).push(list.blank())); break; }
      case 'item-del': change(() => getPath(slide(), `${blockPath()}.${target.dataset.list}`).splice(i, 1)); break;
      case 'item-up': change(() => moveIn(getPath(slide(), `${blockPath()}.${target.dataset.list}`), i, i - 1)); break;
      case 'item-down': change(() => moveIn(getPath(slide(), `${blockPath()}.${target.dataset.list}`), i, i + 1)); break;
      case 'followers': {
        const path = target.dataset.item;
        const handle = getPath(slide(), `${path}.handle`);
        if (!(await ensurePassword('Leer seguidores de SentientDash usa la contraseña del editor de decks.'))) return;
        target.disabled = true;
        target.textContent = 'Consultando SentientDash…';
        try {
          const result = await api.lookupAccount(password, handle);
          change(() => setPath(slide(), `${path}.followers`, Number(result.followers).toLocaleString('en-US')));
          toast(`${handle}: ${Number(result.followers).toLocaleString('en-US')} seguidores${result.capturedAt ? ` (${dateTime(result.capturedAt)})` : ''}.`);
        } catch (error) { toast(error.message, 'studio-toast-error'); target.disabled = false; target.textContent = '↻ Seguidores exactos de SentientDash'; }
        break;
      }
    }
  }, { signal });

  // Inspector inputs: text updates the canvas shortly after typing stops.
  inspector.addEventListener('input', event => {
    const path = event.target.dataset.path;
    if (!path || event.target.type === 'file') return;
    const value = event.target.value;
    change(() => { if (path === 'note' && !value) delete slide().note; else setPath(slide(), path, value); }, { coalesce:`field:${slide().id}:${path}`, render:'canvas' });
  }, { signal });
  inspector.addEventListener('change', async event => {
    const { target } = event;
    if (target.dataset.path && target.tagName === 'SELECT') { renderInspector(); return; }
    if (target.dataset.account) {
      const account = catalog.get(target.value);
      if (!account) return;
      change(() => Object.assign(getPath(slide(), target.dataset.account), { handle:account.handle, followers:Number(account.followers).toLocaleString('en-US'), image:account.avatar }));
      return;
    }
    if (target.dataset.upload) {
      const [file] = target.files;
      if (!file) return;
      try {
        const image = await readImage(file);
        change(() => setPath(slide(), target.dataset.upload, image));
      } catch (error) { toast(error.message || 'No se pudo leer la imagen.', 'studio-toast-error'); }
    }
  }, { signal });
  inspector.addEventListener('submit', async event => {
    const form = event.target.closest('[data-post]');
    if (!form) return;
    event.preventDefault();
    const url = form.querySelector('input').value.trim();
    if (!url) return;
    if (!(await ensurePassword('Buscar posts en SentientDash usa la contraseña del editor de decks.'))) return;
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Buscando…';
    try {
      const post = await api.lookupPost(password, url);
      const caption = String(post.caption ?? '').split('\n').map(line => line.replace(/[#@][\w.]+/g, '').trim()).find(Boolean) ?? 'Promotional post';
      const handle = catalog.get(post.account)?.handle ?? `@${post.account}`;
      const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'America/Costa_Rica' }) : '';
      change(() => Object.assign(getPath(slide(), form.dataset.post), {
        account:handle, title:caption.length > 56 ? `${caption.slice(0, 56).replace(/\s+\S*$/, '')}…` : caption, url:post.permalink,
        likes:post.likes == null ? '—' : Number(post.likes).toLocaleString('en-US'), comments:post.comments == null ? '—' : Number(post.comments).toLocaleString('en-US'), date,
        ...(post.cover ? { image:post.cover } : {}),
      }));
      toast('Post cargado desde SentientDash.');
    } catch (error) {
      toast(error.message, 'studio-toast-error');
      button.disabled = false;
      button.textContent = 'Buscar en SentientDash';
    }
  }, { signal });
  titleInput.addEventListener('input', () => change(() => { deck.title = titleInput.value; document.title = `${deck.title} — Deck Studio`; }, { coalesce:'title', render:'none' }), { signal });

  window.addEventListener('keydown', event => {
    const typing = event.target.closest?.('input, textarea, select, [contenteditable]');
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if (typing || app.querySelector('dialog[open]')) return;
    if (mod && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      if (selected !== null) change(() => { slide().blocks.splice(selected + 1, 0, copy(slide().blocks[selected])); selected += 1; });
      else change(() => { deck.slides.splice(index + 1, 0, { ...copy(slide()), id:newId() }); index += 1; });
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selected !== null && !blockTypes[slide().blocks[selected]?.type]?.templateOnly) { event.preventDefault(); change(() => { slide().blocks.splice(selected, 1); selected = null; }); }
    else if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(event.key)) { event.preventDefault(); go(index + 1); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); go(index - 1); }
    else if (event.key === 'Escape' && selected !== null) { selected = null; renderInspector(); void canvas.ready.then(frame => frame?.select(null)); }
  }, { signal });
  window.addEventListener('beforeunload', event => { if (!saved) { event.preventDefault(); event.returnValue = ''; } }, { signal });

  setTab('slides');
  renderAll();
  saveStatus.textContent = deck.published ? `Publicado · revisión ${deck.published.revision}` : 'Guardado en este navegador';
  return () => {
    lifecycle.abort();
    clearTimeout(canvasTimer);
    clearTimeout(thumbTimer);
    if (!saved) { clearTimeout(saveTimer); void putDeck(deck); }
  };
}

export async function mountStudio() {
  document.body.className = 'studio-mode';
  document.body.dataset.page = 'studio';
  document.body.innerHTML = '<div class="studio-app"></div>';
  delete document.documentElement.dataset.deck;
  const app = document.querySelector('.studio-app');
  let dispose = () => {};
  const route = async () => {
    dispose();
    dispose = () => {};
    app.onclick = null;
    const id = /^#\/studio\/([a-z0-9]+)\/?$/.exec(location.hash)?.[1];
    if (id) dispose = await renderEditor(app, id);
    else await renderHome(app);
  };
  window.addEventListener('hashchange', () => { if (/^#\/studio(\/|$)/.test(location.hash)) void route(); });
  if (!('indexedDB' in window)) { app.innerHTML = '<p class="studio-empty">Este navegador no permite guardar decks. Usa Chrome, Safari o Firefox actualizados.</p>'; return; }
  await route();
}
