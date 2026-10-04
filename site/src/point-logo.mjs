import sentientSymbol from '../public/assets/sentient-symbol.svg';
import { createPointLogoArt } from './point-logo-art.mjs';
import { createWaveSurface, surfacePalette, surfaceStemPalette, surfaceHighlightPalette, surfacePulsePalette, surfacePulseHighlightPalette, pinTone } from './wave-surface-art.mjs';
import { createRippleTiming, startLogoReveal, revealLogoPin, logoPulseAt, springCoefficients, stepPin } from './pin-dynamics.mjs';

let sharedArt;
const RIPPLE_COUNT = 10;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// Inverse of the illustrative plane's affine projection. No 3D mesh or camera.
const planePoint = (x, y) => ({ u: (.83 * x - .28 * y) / .8748, v: (.16 * x + y) / .8748 });

export function createPointLogo(host, paused = false) {
  const canvas = document.createElement('canvas');
  let context;
  try {
    context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas 2D unavailable.');
    sharedArt ||= createPointLogoArt(sentientSymbol);
  } catch {
    host.classList.remove('field-ready'); host.classList.add('field-unavailable');
    return { setPaused() {}, dispose() {} };
  }
  const listeners = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ripples = Array.from({ length: RIPPLE_COUNT }, () => ({ u: 0, v: 0, born: -10, strength: 0, pulsesLogo: false }));
  let observer, resizeObserver, surface, sockets;
  let disposed = false, failed = false, contextLost = false, suspended = false;
  let visible = false, hasSize = false, mobile = false, needsPaint = true;
  let width = 0, height = 0, ratio = 1, speed = 180, lifetime = 11, band = 90;
  let settling = false;
  let logoReveal = null;
  let frame = 0, previous = 0, lastRendered = 0, elapsed = 0;
  let pointerInside = false, pointerU = 0, pointerV = 0, pointerTime = 0;
  let lastEmission = -10, lastEmissionU = 0, lastEmissionV = 0, rippleCursor = 0;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
  host.appendChild(canvas);
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options); listeners.push([target, type, handler, options]);
  };
  const canPaint = () => !disposed && !failed && !contextLost && !suspended && visible && hasSize && !document.hidden;
  const motionEnabled = () => !paused && !reduced.matches;
  const activeRipples = () => motionEnabled() && ripples.some(ripple => ripple.strength > 0 && elapsed - ripple.born < lifetime);
  const activeMotion = () => motionEnabled() && (activeRipples() || settling || (logoReveal && !logoReveal.complete));
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; lastRendered = 0; };
  const showFallback = () => { stop(); host.classList.remove('field-ready'); host.classList.add('field-unavailable'); };
  const resetPointer = () => { pointerInside = false; pointerTime = 0; };
  const clearRipples = () => {
    resetPointer(); for (const ripple of ripples) ripple.strength = 0;
    for (const pin of surface?.pins || []) { pin.displacement = 0; pin.velocity = 0; pin.pulse = 0; }
    settling = false;
    lastEmission = -10; needsPaint = true;
  };
  const paint = (delta = 0) => {
    if (!canPaint() || !surface) return;
    try {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.globalAlpha = 1; context.clearRect(0, 0, width, height);
      // Batch thousands of pin caps and stems by tone. Draw calls stay bounded
      // even when an interaction crosses the full field on a large display.
      const caps = surfacePalette.map(() => new Path2D());
      const stems = surfacePalette.map(() => new Path2D());
      const highlights = surfacePalette.map(() => new Path2D());
      const pulseCaps = new Array(surfacePulsePalette.length);
      const pulseHighlights = new Array(surfacePulsePalette.length);
      const shadows = new Path2D();
      const coefficients = springCoefficients(delta);
      settling = false;
      if (logoReveal && !logoReveal.complete) logoReveal.radius += delta * logoReveal.speed;
      let unlitLogoPins = 0;
      const waves = activeRipples() ? ripples.filter(ripple => ripple.strength > 0 && elapsed - ripple.born < lifetime).map(ripple => {
        const age = elapsed - ripple.born;
        return { ...ripple, radius: age * speed,
          envelope: Math.min(1, age / .42) * Math.min(1, (lifetime - age) / .8) };
      }) : [];
      for (const pin of surface.pins) {
        const wasLit = pin.lit;
        if (pin.logo && !revealLogoPin(pin, logoReveal)) unlitLogoPins++;
        let energy = 0, pulse = 0;
        for (const ripple of waves) {
          const dx = pin.u - ripple.u, dy = pin.v - ripple.v;
          const distanceSquared = dx * dx + dy * dy;
          const outer = ripple.radius + band * 2.8, inner = Math.max(0, ripple.radius - band * 2.8);
          if (distanceSquared > outer * outer || distanceSquared < inner * inner) continue;
          const distance = Math.sqrt(distanceSquared);
          const travel = (distance - ripple.radius) / band;
          const envelope = Math.exp(-travel * travel * .8) * ripple.envelope
            / (1 + distance / (Math.max(width, height) * 3));
          energy += Math.cos(travel * 1.8) * envelope * ripple.strength;
          if (wasLit) pulse = Math.max(pulse, logoPulseAt(pin, ripple, travel, envelope));
        }
        if (reduced.matches) pin.pulse = 0;
        else if (!paused) pin.pulse = pulse;
        energy = clamp(energy, -.30, 1);
        if (stepPin(pin, energy * surface.maxWave, coefficients, surface.maxWave)) settling = true;
        const lift = pin.height + pin.displacement;
        const top = pin.y - lift;
        const tone = pinTone(pin);
        const radius = surface.radius;
        shadows.moveTo(pin.x, pin.y); shadows.lineTo(pin.x + lift * .32, pin.y + lift * .10);
        stems[tone].moveTo(pin.x, pin.y); stems[tone].lineTo(pin.x, top);
        caps[tone].moveTo(pin.x + radius, top);
        caps[tone].ellipse(pin.x, top, radius, radius * .65, 0, 0, Math.PI * 2);
        highlights[tone].moveTo(pin.x - radius * .6, top - radius * .22);
        highlights[tone].lineTo(pin.x + radius * .2, top - radius * .40);
        const pulseTone = pin.logo && pin.lit ? Math.round(pin.pulse * (surfacePulsePalette.length - 1)) : 0;
        if (pulseTone > 0) {
          pulseCaps[pulseTone] ||= new Path2D();
          pulseHighlights[pulseTone] ||= new Path2D();
          pulseCaps[pulseTone].moveTo(pin.x + radius, top);
          pulseCaps[pulseTone].ellipse(pin.x, top, radius, radius * .65, 0, 0, Math.PI * 2);
          pulseHighlights[pulseTone].moveTo(pin.x - radius * .6, top - radius * .22);
          pulseHighlights[pulseTone].lineTo(pin.x + radius * .2, top - radius * .40);
        }
      }
      if (logoReveal && unlitLogoPins === 0) logoReveal.complete = true;
      // Pins slide on a fixed axis through dark sockets. Cast shadows, a
      // narrow lit shaft edge and fixed-size caps give the display its depth.
      context.fillStyle = '#020604a6'; context.fill(sockets);
      context.lineCap = 'round'; context.lineWidth = surface.radius * 1.25;
      context.strokeStyle = '#02050361'; context.stroke(shadows);
      context.lineWidth = surface.radius * 1.55;
      for (let tone = 0; tone < stems.length; tone++) { context.strokeStyle = surfaceStemPalette[tone]; context.stroke(stems[tone]); }
      context.translate(-surface.radius * .3, 0); context.lineWidth = surface.radius * .36;
      for (let tone = 0; tone < stems.length; tone++) { context.strokeStyle = surfacePalette[tone]; context.stroke(stems[tone]); }
      context.translate(surface.radius * .3, 0);
      context.lineWidth = .65; context.strokeStyle = '#09130be0';
      for (let tone = 0; tone < caps.length; tone++) { context.fillStyle = surfacePalette[tone]; context.fill(caps[tone]); context.stroke(caps[tone]); }
      context.lineWidth = mobile ? .45 : .6;
      for (let tone = 0; tone < highlights.length; tone++) { context.strokeStyle = surfaceHighlightPalette[tone]; context.stroke(highlights[tone]); }
      for (let tone = 1; tone < pulseCaps.length; tone++) {
        if (!pulseCaps[tone]) continue;
        context.fillStyle = surfacePulsePalette[tone]; context.fill(pulseCaps[tone]);
        context.strokeStyle = surfacePulseHighlightPalette[tone]; context.stroke(pulseHighlights[tone]);
      }
      needsPaint = false; host.classList.remove('field-unavailable'); host.classList.add('field-ready');
    } catch { failed = true; showFallback(); }
  };
  const schedule = () => { if (!frame && canPaint() && (needsPaint || activeMotion())) frame = requestAnimationFrame(tick); };
  const tick = now => {
    frame = 0;
    if (!canPaint()) { stop(); return; }
    let delta = 0;
    if (activeMotion()) {
      const interval = 1000 / (mobile ? 30 : 45), sinceRender = now - lastRendered;
      if (lastRendered && sinceRender < interval - .5) { schedule(); return; }
      delta = previous ? Math.min((now - previous) / 1000, .1) : 1 / 60;
      elapsed += delta;
      previous = now; lastRendered = now - (lastRendered ? Math.max(0, sinceRender) % interval : 0);
      needsPaint = true;
    }
    if (needsPaint) paint(delta);
    if (activeMotion()) schedule(); else stop();
  };
  const resize = () => {
    if (disposed || failed || contextLost) return;
    const rect = host.getBoundingClientRect(); width = rect.width; height = rect.height;
    hasSize = width > 0 && height > 0;
    if (!hasSize) { stop(); return; }
    visible = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    mobile = window.innerWidth <= 650;
    ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    surface = createWaveSurface(sharedArt, width, height, mobile);
    for (const pin of surface.pins) Object.assign(pin, planePoint(pin.x, pin.y));
    sockets = new Path2D();
    for (const pin of surface.pins) {
      sockets.moveTo(pin.x + surface.radius * 1.35, pin.y);
      sockets.ellipse(pin.x, pin.y, surface.radius * 1.35, surface.radius * .78, 0, 0, Math.PI * 2);
    }
    // A ripple lasts long enough to reach the opposite corner of this surface.
    const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => planePoint(x, y));
    const diameter = Math.max(...corners.flatMap(a => corners.map(b => Math.hypot(a.u - b.u, a.v - b.v))));
    ({ speed, lifetime, band } = createRippleTiming(diameter, mobile));
    clearRipples(); if (!visible) stop(); schedule();
  };
  const emitRipple = strength => {
    // Active waves finish their trip; sustained movement never truncates them.
    const available = ripples.findIndex((ripple, index) => {
      const candidate = ripples[(index + rippleCursor) % RIPPLE_COUNT];
      return !candidate.strength || elapsed - candidate.born >= lifetime;
    });
    if (available < 0) return;
    rippleCursor = (available + rippleCursor) % RIPPLE_COUNT;
    const ripple = ripples[rippleCursor];
    ripple.u = pointerU; ripple.v = pointerV; ripple.born = elapsed; ripple.strength = strength;
    ripple.pulsesLogo = Boolean(logoReveal);
    logoReveal = startLogoReveal(logoReveal, surface.logoFrame, pointerU, pointerV, speed);
    rippleCursor = (rippleCursor + 1) % RIPPLE_COUNT;
    lastEmission = elapsed; lastEmissionU = pointerU; lastEmissionV = pointerV; needsPaint = true; schedule();
  };
  const onPointer = event => {
    if (!canPaint() || !surface || event.target?.closest?.('button, a, input, select, textarea, [role=button]')) return;
    if (paused && !reduced.matches) return;
    const rect = host.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > width || y > height) { resetPointer(); return; }
    const point = planePoint(x, y), now = event.timeStamp / 1000, entering = !pointerInside;
    const velocity = !entering && pointerTime ? Math.hypot(point.u - pointerU, point.v - pointerV) / clamp(now - pointerTime, .008, .15) : 0;
    pointerU = point.u; pointerV = point.v; pointerTime = now; pointerInside = true;
    if (!motionEnabled()) {
      if (logoReveal?.complete) return;
      logoReveal = startLogoReveal(logoReveal, surface.logoFrame, pointerU, pointerV, speed, true);
      logoReveal.complete = true;
      needsPaint = true; schedule(); return;
    }
    const moved = Math.hypot(pointerU - lastEmissionU, pointerV - lastEmissionV) > 26;
    if (entering || event.type === 'pointerdown' || (moved && elapsed - lastEmission >= .95)) emitRipple(.72 + Math.min(.23, velocity / 1800));
  };
  const syncMotion = () => { stop(); resetPointer(); needsPaint = true; schedule(); };
  const onVisibility = () => { stop(); resetPointer(); if (!document.hidden) { needsPaint = true; schedule(); } };
  const dispose = () => {
    if (disposed) return;
    disposed = true; stop(); observer?.disconnect(); resizeObserver?.disconnect();
    listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
    canvas.remove(); canvas.width = canvas.height = 0; host.classList.remove('field-ready');
  };
  try {
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        if (disposed) return;
        visible = entries[0].isIntersecting;
        if (visible) { needsPaint = true; schedule(); } else { stop(); resetPointer(); }
      }); observer.observe(host);
    }
    if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); }
    listen(window, 'pointermove', onPointer, { passive: true });
    listen(window, 'pointerdown', onPointer, { passive: true });
    listen(window, 'pointerup', event => { if (event.pointerType === 'touch') resetPointer(); }, { passive: true });
    listen(window, 'pointercancel', resetPointer, { passive: true });
    listen(window, 'blur', resetPointer); listen(window, 'scroll', resetPointer, { passive: true });
    listen(document.documentElement, 'pointerleave', resetPointer); listen(window, 'resize', resize, { passive: true });
    listen(document, 'visibilitychange', onVisibility); listen(reduced, 'change', syncMotion);
    listen(canvas, 'contextlost', event => { event.preventDefault(); contextLost = true; clearRipples(); showFallback(); });
    listen(canvas, 'contextrestored', () => {
      if (disposed) return;
      contextLost = false; failed = false; context = canvas.getContext('2d', { alpha: true });
      if (!context) { failed = true; showFallback(); return; } resize();
    });
    listen(window, 'pagehide', event => { suspended = true; stop(); resetPointer(); if (!event.persisted) dispose(); });
    listen(window, 'pageshow', () => { if (!disposed && suspended) { suspended = false; resize(); } });
    resize();
  } catch { dispose(); host.classList.add('field-unavailable'); }
  return { setPaused(value) { if (!disposed) { paused = Boolean(value); syncMotion(); } }, dispose };
}
