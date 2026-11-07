// V2-only client rail. Touch keeps native scrolling; mouse users can drag.
for (const carousel of document.querySelectorAll('.v2-client-carousel')) {
  const viewport = carousel.querySelector('.v2-client-viewport');
  const items = [...carousel.querySelectorAll('.v2-client-logo')];
  const previous = carousel.querySelector('[data-client-prev]');
  const next = carousel.querySelector('[data-client-next]');
  const status = carousel.querySelector('[data-client-status]');
  if (!viewport || !items.length) continue;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const maximum = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  let frame = 0;
  let settleTimer = 0;
  let pointer = null;
  let suppressClickUntil = 0;

  const updateControls = () => {
    if (previous) previous.disabled = viewport.scrollLeft <= 2;
    if (next) next.disabled = viewport.scrollLeft >= maximum() - 2;
  };
  const updateStatus = () => {
    updateControls();
    if (!status) return;
    const bounds = viewport.getBoundingClientRect();
    const visible = items.reduce((indices, item, index) => {
      const rect = item.getBoundingClientRect();
      if (Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left) > 8) indices.push(index);
      return indices;
    }, []);
    if (!visible.length) return;
    const first = visible[0] + 1;
    const last = visible.at(-1) + 1;
    const label = `Clients ${first === last ? first : `${first}–${last}`} of ${items.length}`;
    if (status.textContent !== label) status.textContent = label;
  };
  const moveTo = left => {
    viewport.scrollTo({left: Math.max(0, Math.min(maximum(), left)), behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  };
  const step = direction => moveTo(viewport.scrollLeft + direction * Math.max(items[0].getBoundingClientRect().width, viewport.clientWidth * 0.75));

  previous?.addEventListener('click', () => step(-1));
  next?.addEventListener('click', () => step(1));
  viewport.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') moveTo(0);
    else if (event.key === 'End') moveTo(maximum());
    else step(event.key === 'ArrowLeft' ? -1 : 1);
  });

  viewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button, input, textarea, select')) return;
    pointer = {id: event.pointerId, x: event.clientX, left: viewport.scrollLeft, dragging: false, scrollBehavior: viewport.style.scrollBehavior};
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const distance = event.clientX - pointer.x;
    if (!pointer.dragging && Math.abs(distance) < 6) return;
    if (!pointer.dragging) {
      pointer.dragging = true;
      viewport.classList.add('is-dragging');
      viewport.style.scrollBehavior = 'auto';
      viewport.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    viewport.scrollLeft = pointer.left - distance;
  });
  const finishDrag = event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.dragging) suppressClickUntil = performance.now() + 400;
    viewport.style.scrollBehavior = pointer.scrollBehavior;
    viewport.classList.remove('is-dragging');
    pointer = null;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    updateStatus();
  };
  viewport.addEventListener('pointerup', finishDrag);
  viewport.addEventListener('pointercancel', finishDrag);
  viewport.addEventListener('lostpointercapture', finishDrag);
  viewport.addEventListener('pointerleave', event => {
    // Before capture starts, leaving the rail ends an ordinary mouse gesture.
    if (pointer && !pointer.dragging) finishDrag(event);
  });
  viewport.addEventListener('selectstart', event => { if (pointer) event.preventDefault(); });
  viewport.addEventListener('dragstart', event => event.preventDefault());
  viewport.addEventListener('click', event => {
    if (performance.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClickUntil = 0;
  }, true);

  viewport.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; updateControls(); });
    clearTimeout(settleTimer);
    settleTimer = setTimeout(updateStatus, 180);
  }, {passive: true});
  viewport.addEventListener('scrollend', updateStatus);
  const resizeObserver = new ResizeObserver(updateStatus);
  resizeObserver.observe(viewport);
  for (const item of items) resizeObserver.observe(item);
  updateStatus();
}
