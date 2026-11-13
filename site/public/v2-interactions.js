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

// Service pages: horizontal post rails with previous/next arrows.
for (const rail of document.querySelectorAll('[data-rail]')) {
  const controls = document.querySelectorAll(`[data-rail-for="${rail.id}"]`);
  const step = direction => {
    const card = rail.querySelector(':scope > *:not([hidden])');
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    const width = card ? card.getBoundingClientRect().width + gap : rail.clientWidth * .8;
    const perView = Math.max(1, Math.floor((rail.clientWidth + gap) / width));
    rail.scrollBy({ left: direction * width * perView, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const update = () => {
    const max = rail.scrollWidth - rail.clientWidth - 2;
    for (const group of controls) {
      group.querySelector('[data-rail-prev]').disabled = rail.scrollLeft <= 2;
      group.querySelector('[data-rail-next]').disabled = rail.scrollLeft >= max;
    }
  };
  for (const group of controls) {
    group.querySelector('[data-rail-prev]').addEventListener('click', () => step(-1));
    group.querySelector('[data-rail-next]').addEventListener('click', () => step(1));
  }
  rail.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  new ResizeObserver(update).observe(rail);
  update();
}

// "Trusted by" logo marquee: moves on its own and can be dragged or flicked
// (same behavior as the sergioprompts.com brand strip). Reduced motion stops
// the auto scroll but keeps dragging.
for (const marquee of document.querySelectorAll('[data-marquee]')) {
  const track = marquee.querySelector('.sx-marquee-track');
  if (!track) continue;
  const originals = [...track.children];
  for (const item of originals) {
    const copy = item.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelector('img')?.setAttribute('alt', '');
    track.append(copy);
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const speed = reduce ? 0 : 36;
  let moved = false, pointerId = null, x = 0, half = 0, last = performance.now(), dragging = false, startX = 0, startPos = 0, velocity = 0, lastMove = 0, lastX = 0, visible = true;
  const measure = () => { half = track.scrollWidth / 2; };
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);
  for (const img of track.querySelectorAll('img')) img.addEventListener('load', measure, { once: true });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(marquee);
  const wrap = () => { if (!half) return; while (x <= -half) x += half; while (x > 0) x -= half; };
  const tick = now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging) {
      if (Math.abs(velocity) > 5) { x += velocity * dt; velocity *= Math.pow(0.04, dt); }
      else { velocity = 0; x -= speed * dt; }
    }
    if (visible) { wrap(); track.style.transform = `translate3d(${x}px,0,0)`; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  marquee.addEventListener('pointerdown', event => {
    dragging = true; moved = false; velocity = 0; startX = event.clientX; startPos = x; lastX = event.clientX; lastMove = performance.now(); pointerId = event.pointerId;
  });
  marquee.addEventListener('pointermove', event => {
    if (!dragging) return;
    // Capture only once it is a real drag, so a plain click still opens a card's link.
    if (!moved && Math.abs(event.clientX - startX) > 5) { moved = true; marquee.classList.add('is-dragging'); try { marquee.setPointerCapture(pointerId); } catch {} }
    if (!moved) return;
    x = startPos + (event.clientX - startX);
    const now = performance.now(), dt = (now - lastMove) / 1000;
    if (dt > 0) velocity = (event.clientX - lastX) / dt;
    lastX = event.clientX; lastMove = now;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    marquee.classList.remove('is-dragging');
    if (performance.now() - lastMove > 120) velocity = 0;
    velocity = Math.max(-2500, Math.min(2500, velocity));
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) marquee.addEventListener(type, end);
  marquee.addEventListener('click', event => { if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; } }, true);
}
