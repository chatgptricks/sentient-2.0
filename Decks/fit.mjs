// Fit the entire semantic flow, including footnotes, between the floating controls.
// Text reflows at narrow widths before a uniform scale handles short viewports.
export function initDeckFit(root) {
  let scheduled = 0;
  let disposed = false;
  const header = root.querySelector('.deck-header');
  const controls = root.querySelector('.deck-controls');
  const fit = () => {
    scheduled = 0;
    if (disposed || !root.isConnected) return;
    const slide = root.querySelector('.deck-slide:not([hidden])');
    if (!slide) return;
    const area = slide.querySelector('.deck-fit-area');
    const content = slide.querySelector('.deck-content');
    const viewport = window.visualViewport;
    if (viewport && Math.abs(viewport.scale - 1) < .01) root.style.setProperty('--deck-viewport-height', `${viewport.height}px`);
    else root.style.removeProperty('--deck-viewport-height');
    const bounds = root.getBoundingClientRect();
    const gap = bounds.height < 500 ? 10 : 18;
    const inset = Math.min(72, Math.max(20, bounds.width * .045));
    const top = Math.max(gap, header.getBoundingClientRect().bottom - bounds.top + gap);
    const bottom = Math.min(bounds.height - gap, controls.getBoundingClientRect().top - bounds.top - gap);
    const width = Math.max(1, bounds.width - inset * 2);
    const height = Math.max(1, bottom - top);
    Object.assign(area.style, { left:`${inset}px`, top:`${top}px`, right:'auto', bottom:'auto', width:`${width}px`, height:`${height}px` });
    let logicalWidth = width;
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
    content.style.left = `${Math.max(0, (width - naturalWidth * scale) / 2)}px`;
    content.style.top = `${Math.max(0, (height - naturalHeight * scale) / 2)}px`;
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
    root.removeEventListener('load', update, true);
    root.removeEventListener('input', update);
    window.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('resize', update);
    document.removeEventListener('fullscreenchange', update);
    document.fonts?.removeEventListener('loadingdone', update);
  } };
}
