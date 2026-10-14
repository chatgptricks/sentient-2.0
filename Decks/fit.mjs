// Metadata and titles belong to the master grid. Only the body workspace scales.
import { textOf } from './editor.mjs';

export function initDeckFit(root) {
  let scheduled = 0;
  let disposed = false;
  const header = root.querySelector('.deck-header');
  const controls = root.querySelector('.deck-controls');
  // The cover sets its own headline, so it does not size the shared title band.
  const titles = [...root.querySelectorAll('.deck-slide:not(.deck-opening) > .deck-title')];
  const measure = document.createElement('h2');
  measure.className = 'deck-title deck-title-measure';
  measure.setAttribute('aria-hidden', 'true');
  root.append(measure);
  const fit = () => {
    scheduled = 0;
    if (disposed || !root.isConnected) return;
    const slide = root.querySelector('.deck-slide:not([hidden])');
    if (!slide) return;
    const content = slide.querySelector('.deck-content');
    const viewport = window.visualViewport;
    if (viewport && Math.abs(viewport.scale - 1) < .01) root.style.setProperty('--deck-viewport-height', `${viewport.height}px`);
    else root.style.removeProperty('--deck-viewport-height');
    const bounds = root.getBoundingClientRect();
    const gap = bounds.height < 500 ? 10 : 18;
    const inset = Math.min(72, Math.max(20, bounds.width * .045));
    root.style.setProperty('--deck-inset', `${inset}px`);
    const labelTop = Math.max(gap, header.getBoundingClientRect().bottom - bounds.top + gap);
    const bottom = Math.min(bounds.height - gap, controls.getBoundingClientRect().top - bounds.top - gap);
    const width = Math.max(1, bounds.width - inset * 2);
    measure.className = 'deck-slide-top deck-title-measure';
    measure.style.width = `${Math.max(1, width - 44)}px`;
    measure.style.fontWeight = '400';
    const labelHeight = Math.ceil(Math.max(32, ...[...root.querySelectorAll('.deck-slide-top > span:first-child')].map(label => {
      measure.textContent = textOf(label);
      return measure.getBoundingClientRect().height;
    })));
    root.style.setProperty('--deck-label-height', `${labelHeight}px`);
    const titleTop = labelTop + labelHeight + gap;
    measure.className = 'deck-title deck-title-measure';
    measure.style.removeProperty('font-weight');
    let titleFont = bounds.width <= 760 ? (bounds.height < 700 ? 26 : 32) : Math.min(76, width * .052, bounds.height * .095);
    measure.style.width = `${width}px`;
    const titleHeight = () => {
      root.style.setProperty('--deck-title-font', `${titleFont}px`);
      return Math.ceil(Math.max(...titles.map(title => {
        measure.textContent = textOf(title);
        const range = document.createRange();
        range.selectNodeContents(measure);
        const bounds = measure.getBoundingClientRect();
        return Math.max(bounds.height, range.getBoundingClientRect().bottom - bounds.top);
      })));
    };
    let bandHeight = titleHeight();
    // A long edited heading reduces the common font for every slide equally.
    const bandLimit = Math.max(24, (bottom - titleTop - gap) * .3);
    for (let attempt = 0; bandHeight > bandLimit && attempt < 12; attempt++) {
      titleFont *= Math.max(.5, Math.min(.9, bandLimit / bandHeight));
      bandHeight = titleHeight();
    }
    root.style.setProperty('--deck-label-top', `${labelTop}px`);
    root.style.setProperty('--deck-title-top', `${titleTop}px`);
    root.style.setProperty('--deck-title-height', `${bandHeight}px`);
    const top = titleTop + bandHeight + gap;
    const height = Math.max(1, bottom - top);
    root.style.setProperty('--deck-workspace-height', `${height}px`);
    root.style.setProperty('--deck-body-top', `${top}px`);
    root.querySelectorAll('.deck-fit-area').forEach(workspace => {
      Object.assign(workspace.style, { left:`${inset}px`, top:`${top}px`, right:'auto', bottom:'auto', width:`${width}px`, height:`${height}px` });
    });
    let logicalWidth = width;
    content.style.minHeight = '0';
    content.style.width = `${logicalWidth}px`;
    const measuredHeight = () => Math.max(1, content.offsetHeight, content.scrollHeight);
    // On short phones, reflow into a slightly wider logical surface before
    // shrinking. This retains the available screen width and larger final type.
    if (bounds.width <= 760 && measuredHeight() > height) {
      let lower = width;
      let upper = width * measuredHeight() / height;
      content.style.width = `${upper}px`;
      for (let attempt = 0; attempt < 3 && measuredHeight() * width / upper > height; attempt++) {
        upper *= 1.35;
        content.style.width = `${upper}px`;
      }
      for (let attempt = 0; attempt < 9; attempt++) {
        const candidate = (lower + upper) / 2;
        content.style.width = `${candidate}px`;
        if (measuredHeight() * width / candidate > height) lower = candidate;
        else upper = candidate;
      }
      logicalWidth = upper;
      content.style.width = `${logicalWidth}px`;
    }
    const naturalWidth = Math.max(logicalWidth, content.scrollWidth);
    const naturalHeight = measuredHeight();
    const scale = Math.min(1, width / naturalWidth, height / naturalHeight);
    content.style.minHeight = `${height / scale}px`;
    content.style.left = '0';
    content.style.top = '0';
    content.style.transform = `scale(${scale})`;
    content.dataset.fitted = '';
    content.dataset.fitScale = String(scale);
  };
  const update = () => {
    if (!disposed && !scheduled) scheduled = window.requestAnimationFrame(fit);
  };
  const resize = new ResizeObserver(update);
  resize.observe(root);
  resize.observe(header);
  resize.observe(controls);
  root.addEventListener('load', update, true);
  root.addEventListener('input', update);
  window.addEventListener('resize', update, { passive:true });
  window.visualViewport?.addEventListener('resize', update, { passive:true });
  document.addEventListener('fullscreenchange', update);
  document.fonts?.addEventListener('loadingdone', update);
  void document.fonts?.ready.then(update);
  update();
  return { update, dispose() {
    disposed = true;
    window.cancelAnimationFrame(scheduled);
    resize.disconnect();
    measure.remove();
    root.removeEventListener('load', update, true);
    root.removeEventListener('input', update);
    window.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('resize', update);
    document.removeEventListener('fullscreenchange', update);
    document.fonts?.removeEventListener('loadingdone', update);
  } };
}
