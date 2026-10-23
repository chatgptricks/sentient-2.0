// The studio's canvas and thumbnails: one fixed 1600×900 document per frame
// that renders a deck with the presentation's own markup, styles and fitting,
// so what the studio shows is exactly what the presentation shows.
import './studio-frame.css';
import { deckMarkup } from './player.mjs';
import { surfaceOf } from './blocks.mjs';
import { initDeckFit } from './fit.mjs';
import { textOf } from './editor.mjs';

let fit;
let emblem;
let listeners;
let selected = null;

const outline = document.createElement('div');
outline.className = 'studio-outline';

const blockBounds = (root, index) => {
  const wrapper = root.querySelector(`.deck-slide:not([hidden]) [data-block="${index}"]`);
  if (!wrapper) return null;
  const range = document.createRange();
  range.selectNodeContents(wrapper);
  const rect = range.getBoundingClientRect();
  return rect.width || rect.height ? rect : null;
};

const drawOutline = () => {
  const root = document.querySelector('.deck-player');
  const rect = root && selected !== null ? blockBounds(root, selected) : null;
  outline.hidden = !rect;
  if (rect) Object.assign(outline.style, { left:`${rect.left - 8}px`, top:`${rect.top - 8}px`, width:`${rect.width + 16}px`, height:`${rect.height + 16}px` });
};

function render(deck, index, { editable = false, emblem:withEmblem = false, selected:block = null, onEdit, onSelect } = {}) {
  listeners?.abort();
  listeners = new AbortController();
  const { signal } = listeners;
  fit?.dispose();
  void emblem?.then(scene => scene?.dispose());
  emblem = null;
  document.documentElement.dataset.deck = 'true';
  document.body.className = `deck-mode studio-frame${editable ? ' studio-editable' : ''}`;
  document.body.innerHTML = deckMarkup(deck, index);
  document.body.append(outline);
  const root = document.querySelector('.deck-player');
  const slide = deck.slides[index];
  root.dataset.theme = surfaceOf(slide);
  root.dataset.layout = slide.layout;
  const current = root.querySelector(`.deck-slide[data-slide="${index}"]`);
  current.querySelector('.deck-slide-top>span').dataset.editField = 'section';
  // The cover carries the brand and the website's 3D emblem, as in the presentation.
  if (slide.layout === 'opening') {
    current.querySelector('.deck-cover-mark')?.append(root.querySelector('.deck-brand'));
    const coverEmblem = current.querySelector('.deck-cover-emblem');
    if (coverEmblem) current.prepend(coverEmblem);
    if (coverEmblem && withEmblem) emblem = import('../site/src/scene.mjs').then(({ createScene }) => createScene(coverEmblem)).catch(() => null);
  }
  fit = initDeckFit(root);
  selected = block;
  if (editable) {
    current.querySelectorAll('[data-edit-field]').forEach(element => {
      element.setAttribute('contenteditable', 'plaintext-only');
      element.setAttribute('spellcheck', 'true');
    });
    current.addEventListener('input', event => {
      const element = event.target.closest('[data-edit-field]');
      if (element) onEdit?.(element.dataset.editField, textOf(element));
      requestAnimationFrame(drawOutline);
    }, { signal });
    current.addEventListener('click', event => {
      if (event.target.closest('a')) event.preventDefault();
      const wrapper = event.target.closest('[data-block]');
      const next = wrapper ? Number(wrapper.dataset.block) : null;
      if (next !== selected) { selected = next; drawOutline(); onSelect?.(next); }
    }, { signal });
    // Undo and redo belong to the studio, not to the text field.
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        window.parent.dispatchEvent(new KeyboardEvent('keydown', { key:event.key, metaKey:event.metaKey, ctrlKey:event.ctrlKey, shiftKey:event.shiftKey }));
      }
      if (event.key === 'Escape') document.activeElement?.blur();
    }, { signal });
  }
  // The fitter scales the body after layout and font loads; follow it.
  const resize = new ResizeObserver(() => requestAnimationFrame(drawOutline));
  resize.observe(current.querySelector('.deck-content'));
  signal.addEventListener('abort', () => resize.disconnect());
  [60, 400].forEach(delay => setTimeout(drawOutline, delay));
}

function select(block) {
  selected = block;
  drawOutline();
}

async function downloadPdf(deck, { onProgress, download = true, slideIndices } = {}) {
  render(deck, 0, { emblem:true });
  document.body.className = 'deck-mode';
  outline.remove();
  const root = document.querySelector('.deck-player');
  const slides = [...root.querySelectorAll('.deck-slide')];
  const brand = root.querySelector('.deck-brand');
  const header = root.querySelector('.deck-header');
  const cover = root.querySelector('.deck-cover-mark');
  const { exportDeckPdf, snapshotCanvas } = await import('./pdf-export.mjs');
  return exportDeckPdf({ root, deck, download, onProgress, slideIndices,
    showSlide(index) {
      root.dataset.theme = surfaceOf(deck.slides[index]);
      root.dataset.layout = deck.slides[index].layout;
      if (root.dataset.layout === 'opening') cover?.append(brand);
      else header.prepend(brand);
      slides.forEach((slide, i) => { slide.hidden = i !== index; });
      root.querySelector('[data-deck-current]').textContent = String(index + 1).padStart(2, '0');
      root.querySelectorAll('.deck-progress [data-go]').forEach(button => {
        if (Number(button.dataset.go) === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
      root.querySelector('[data-deck-action="previous"]').disabled = index === 0;
      root.querySelector('[data-deck-action="next"]').disabled = index === slides.length - 1;
      fit.update();
    },
    beforeCapture:async () => snapshotCanvas(root, await emblem)
  });
}

window.studioFrame = { render, select, downloadPdf };
