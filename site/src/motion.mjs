import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setupServicePreviews } from './preview-motion.mjs';

gsap.registerPlugin(ScrollTrigger);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const toggle = document.querySelector('.motion-toggle');
let userPaused = false;
try { userPaused = localStorage.getItem('sentient-motion') === 'off'; } catch {}
let paused = reduced.matches || userPaused;
let context, media, heroVisual;
let introPlayed = false;
const revealed = new WeakSet();
const cleanups = [];
const listen = (target, event, callback, options) => {
  target.addEventListener(event, callback, options);
  cleanups.push(() => target.removeEventListener(event, callback, options));
};

function setupIntro() {
  if (introPlayed) return;
  introPlayed = true;
  const hero = document.querySelector('.hero, .service-landing, .about-story-intro, .universe-heading');
  if (!hero) return;
  const lines = hero.querySelectorAll('h1 .title-line > span, .about-story-intro h1 > span');
  const headings = lines.length ? lines : hero.querySelectorAll('h1');
  const eyebrow = hero.querySelectorAll('.hero-topline, .hero-kicker, .eyebrow');
  const description = hero.querySelectorAll('.hero-desc > p, .service-landing-copy > p, .about-story-intro > p, .universe-heading > p');
  const actions = hero.querySelectorAll('.hero-actions, .service-landing-copy > .button');
  const timeline = gsap.timeline({ defaults: { duration: .65, ease: 'power3.out', clearProps: 'transform,opacity' } });
  if (eyebrow.length) timeline.from(eyebrow, { y: 6, opacity: .55, duration: .45, stagger: .04 }, 0);
  if (headings.length) timeline.from(headings, { yPercent: lines.length ? 55 : 12, opacity: .25, stagger: .085 }, .04);
  const visual = hero.querySelector('.hero-scene, .service-visual');
  // Only opacity here: the scroll sequence owns the scene's transform.
  if (visual) timeline.from(visual, { opacity: .5, duration: .9, clearProps: 'opacity' }, .08);
  if (description.length) timeline.from(description, { y: 10, opacity: .55, stagger: .03 }, .26);
  if (actions.length) timeline.from(actions, { y: 8, opacity: .6, duration: .55 }, .4);
}

function reveal(element, extra = {}) {
  if (revealed.has(element)) return;
  gsap.from(element, {
    y: 18, opacity: .72, duration: .7, ease: 'power3.out', clearProps: 'transform,opacity',
    scrollTrigger: { trigger: element, start: 'top 92%', once: true },
    onStart: () => revealed.add(element), ...extra,
  });
}

function setupResponsiveMotion({ desktop, phone, fine }, listenMedia, cleanup) {
  gsap.utils.toArray('[data-reveal], .section-heading h2, .story-founder-bio, .network-types article, .faq-items, .feature-case-info').forEach(element => {
    if (phone && element.closest('[data-mobile-carousel]')) return;
    reveal(element);
  });
  gsap.utils.toArray('.story-portrait').forEach((element, index) => {
    reveal(element, { delay: phone ? 0 : index * .08 });
    if (desktop) gsap.fromTo(element.querySelector('img'), { scale: 1.035, yPercent: 1 }, {
      scale: 1, yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: element, start: 'top bottom', end: 'center center', scrub: .7 },
    });
  });

  gsap.utils.toArray('.process-grid, .growth-steps').forEach(list => {
    const steps = [...list.children];
    list.classList.add('gsap-process');
    cleanup.push(() => list.classList.remove('gsap-process'));
    steps.forEach((step, index) => reveal(step, { delay: phone ? 0 : index * .045 }));
    if (phone) {
      steps.forEach(step => gsap.fromTo(step, { '--step-progress': 0 }, {
        '--step-progress': 1, duration: .5, ease: 'power2.out',
        scrollTrigger: { trigger: step, start: 'top 78%', once: true },
      }));
    } else {
      const timeline = gsap.timeline({ scrollTrigger: {
        trigger: list.closest('section') || list, start: 'top 65%', end: 'bottom 55%', scrub: .3,
      } });
      steps.forEach((step, index) => timeline.fromTo(step, { '--step-progress': 0 }, {
        '--step-progress': 1, duration: 1, ease: 'none',
      }, index * .65));
    }
  });

  if (phone) {
    // IntersectionObserver honors horizontal clipping inside native swipe rails.
    const railAnimations = new Map();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < .18) continue;
        const animation = railAnimations.get(entry.target);
        if (animation) { revealed.add(entry.target); animation.play(); }
        observer.unobserve(entry.target);
      }
    }, { threshold: .18 });
    for (const card of document.querySelectorAll('[data-mobile-carousel] > *')) {
      if (revealed.has(card)) continue;
      railAnimations.set(card, gsap.from(card, { y: 12, opacity: .7, duration: .5, ease: 'power3.out', paused: true, clearProps: 'transform,opacity' }));
      observer.observe(card);
    }
    cleanup.push(() => observer.disconnect());
  }

  if (desktop) {
    const hero = document.querySelector('.hero');
    if (hero) {
      gsap.to('.hero-title', { y: -22, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: .7 } });
      gsap.to('.hero > .hero-scene', { y: 36, rotation: 3, scale: 1.025, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1 } });
      gsap.to('.hero-glow', { x: -36, scale: 1.05, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1.2 } });
    }
    const wall = document.querySelector('.campaign-wall');
    if (wall) {
      const cards = [...wall.querySelectorAll('.wall-card-wrap')];
      const middle = (cards.length - 1) / 2;
      const timeline = gsap.timeline({ scrollTrigger: { trigger: wall, start: 'top 90%', end: 'center 55%', scrub: .6 } });
      cards.forEach((card, index) => {
        const distance = index - middle;
        timeline.from(card, { x: -distance * 24, y: 14 + Math.abs(distance) * 3, rotation: distance * 4.5, scale: .975, ease: 'power2.out', duration: 1 }, Math.abs(distance) * .045);
      });
      timeline.from('.wall-statement', { y: 12, opacity: .75, duration: .6 }, .25);
    }
    gsap.utils.toArray('.case-image').forEach(element => gsap.fromTo(element.querySelector('img'), { scale: 1.04, yPercent: 1.5 }, {
      scale: 1.02, yPercent: -1, ease: 'none', scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: 1 },
    }));
    gsap.utils.toArray('.growth-showcase > a').forEach((element, index) => gsap.from(element, {
      rotation: index % 2 ? 5 : -5, y: 20, ease: 'none',
      scrollTrigger: { trigger: '.growth-showcase', start: 'top bottom', end: 'center center', scrub: 1 },
    }));
  }

  gsap.utils.toArray('.feature-case-art').forEach((element, index) => {
    const image = element.querySelector('img');
    if (!image || (!desktop && !fine)) return;
    const original = image.style.transform;
    const angle = (index % 2 ? 1 : -1) * (phone ? 3 : 7);
    const state = { scrollY: 0, scrollRotation: angle, scrollTilt: 0, hoverY: 0, hoverRotation: 0 };
    // One composed transform for scroll and hover; no competing CSS transition.
    const render = () => { image.style.transform = `translate3d(0,${state.scrollY + state.hoverY}px,0) rotate(${state.scrollRotation + state.hoverRotation}deg) rotateY(${state.scrollTilt}deg)`; };
    element.classList.add('gsap-feature-art');
    cleanup.push(() => { image.style.transform = original; element.classList.remove('gsap-feature-art'); });
    if (desktop) {
      gsap.fromTo(state, { scrollY: 20, scrollRotation: angle, scrollTilt: index % 2 ? -4 : 4 }, {
        scrollY: -12, scrollRotation: angle * .6, scrollTilt: index % 2 ? 2 : -2, ease: 'none', onUpdate: render,
        scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: 1.1 },
      });
      const halo = element.querySelector('.feature-art-halo');
      if (halo) gsap.fromTo(halo, { scale: .96 }, { scale: 1.04, ease: 'none', scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: 1 } });
    }
    if (fine) {
      const hoverY = gsap.quickTo(state, 'hoverY', { duration: .4, ease: 'power3.out', onUpdate: render });
      const hoverRotation = gsap.quickTo(state, 'hoverRotation', { duration: .4, ease: 'power3.out', onUpdate: render });
      const enter = () => { hoverY(-6); hoverRotation(-state.scrollRotation * .45); };
      const leave = () => { hoverY(0); hoverRotation(0); };
      listenMedia(element, 'pointerenter', enter);
      listenMedia(element, 'pointerleave', leave);
      listenMedia(element, 'focus', enter);
      listenMedia(element, 'blur', leave);
    }
    render();
  });

  if (!fine) return;
  const cursor = document.querySelector('.view-cursor');
  if (cursor) {
    const cursorX = gsap.quickTo(cursor, 'x', { duration: .18, ease: 'power3.out' });
    const cursorY = gsap.quickTo(cursor, 'y', { duration: .18, ease: 'power3.out' });
    const cursorOpacity = gsap.quickTo(cursor, 'opacity', { duration: .2 });
    const cursorScale = gsap.quickTo(cursor, 'scale', { duration: .2 });
    listenMedia(window, 'pointermove', event => { cursorX(event.clientX); cursorY(event.clientY); }, { passive: true });
    for (const element of document.querySelectorAll('.case-image, .wall-card, .growth-showcase > a, .feature-case-art')) {
      listenMedia(element, 'pointerenter', () => { cursorOpacity(1); cursorScale(1); });
      listenMedia(element, 'pointerleave', () => { cursorOpacity(0); cursorScale(.5); });
    }
    cleanup.push(() => gsap.set(cursor, { opacity: 0, clearProps: 'transform' }));
  }
  const measured = new Map();
  const bounds = element => {
    if (!measured.has(element)) measured.set(element, element.getBoundingClientRect());
    return measured.get(element);
  };
  listenMedia(window, 'scroll', () => measured.clear(), { passive: true });
  listenMedia(window, 'resize', () => measured.clear(), { passive: true });
  for (const element of document.querySelectorAll('.offer')) {
    listenMedia(element, 'pointerenter', () => measured.delete(element));
    listenMedia(element, 'pointermove', event => {
      const box = bounds(element);
      element.style.setProperty('--mx', `${event.clientX - box.left}px`);
      element.style.setProperty('--my', `${event.clientY - box.top}px`);
    }, { passive: true });
    cleanup.push(() => { element.style.removeProperty('--mx'); element.style.removeProperty('--my'); });
  }
  for (const element of document.querySelectorAll('.wall-card, .button:not(.form-submit)')) {
    const card = element.classList.contains('wall-card');
    const x = gsap.quickTo(element, card ? 'rotationY' : 'x', { duration: .4, ease: 'power3.out' });
    const y = gsap.quickTo(element, card ? 'rotationX' : 'y', { duration: .4, ease: 'power3.out' });
    listenMedia(element, 'pointerenter', () => measured.delete(element));
    listenMedia(element, 'pointermove', event => {
      const box = bounds(element);
      if (!box.width || !box.height) return;
      const dx = event.clientX - box.left - box.width / 2;
      const dy = event.clientY - box.top - box.height / 2;
      x(card ? dx / box.width * 8 : dx * .06);
      y(card ? -dy / box.height * 6 : dy * .08);
    }, { passive: true });
    listenMedia(element, 'pointerleave', () => { x(0); y(0); });
  }
}

function setupMotion() {
  if (paused) return;
  context = gsap.context(() => {
    setupIntro();
    gsap.to('.scroll-progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .15 } });
    cleanups.push(setupServicePreviews({ gsap, ScrollTrigger, listen }));
    media = gsap.matchMedia();
    media.add({ all: '(min-width: 0px)', desktop: '(min-width: 901px)', phone: '(max-width: 650px)', fine: '(hover: hover) and (pointer: fine)' }, mediaContext => {
      const cleanup = [];
      const listenMedia = (target, event, callback, options) => {
        target.addEventListener(event, callback, options);
        cleanup.push(() => target.removeEventListener(event, callback, options));
      };
      setupResponsiveMotion(mediaContext.conditions, listenMedia, cleanup);
      return () => cleanup.splice(0).forEach(fn => fn());
    });
  });
  document.fonts.ready.then(() => { if (!paused) ScrollTrigger.refresh(); });
}

function updateState() {
  document.documentElement.classList.toggle('motion-paused', paused);
  if (toggle) {
    toggle.hidden = false;
    toggle.disabled = reduced.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', reduced.matches ? 'Reduced motion enabled' : paused ? 'Enable animations' : 'Pause animations');
    toggle.querySelector('.motion-label').textContent = reduced.matches ? 'Reduced motion' : paused ? 'Motion off' : 'Motion on';
    toggle.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ';
  }
  if (paused) {
    context?.revert(); media?.revert(); context = null; media = null;
    cleanups.splice(0).forEach(fn => fn?.());
    gsap.killTweensOf('.view-cursor, .wall-card, .button');
    gsap.set('.view-cursor', { opacity: 0 });
    gsap.set('.wall-card, .button', { clearProps: 'transform' });
  } else if (!context) setupMotion();
  heroVisual?.setPaused(paused);
  document.dispatchEvent(new CustomEvent('sentient:motion', { detail: { paused } }));
}
toggle?.addEventListener('click', () => {
  userPaused = !userPaused;
  paused = reduced.matches || userPaused;
  try { localStorage.setItem('sentient-motion', userPaused ? 'off' : 'on'); } catch {}
  updateState();
  if (!paused && !heroVisual) loadScene();
});
reduced.addEventListener('change', () => { paused = reduced.matches || userPaused; updateState(); if (!paused && !heroVisual) loadScene(); });
let sceneLoading = false;
async function loadScene() {
  const host = document.querySelector('[data-service-field], [data-scene]');
  if (!host || reduced.matches || sceneLoading) return;
  sceneLoading = true;
  try {
    if (host.dataset.serviceField === 'growth') {
      const { createPointLogo } = await import('./point-logo.mjs');
      heroVisual = createPointLogo(host, paused);
    } else if (host.hasAttribute('data-service-field')) {
      const { createViralCrowd } = await import('./viral-crowd.mjs');
      heroVisual = createViralCrowd(host, paused);
    } else {
      const { createScene } = await import('./scene.mjs');
      heroVisual = createScene(host, paused);
    }
  } catch { host.classList.add(host.hasAttribute('data-service-field') ? 'field-unavailable' : 'scene-unavailable'); }
}
updateState();
if (!paused) loadScene();
window.addEventListener('pagehide', () => heroVisual?.setPaused(true));
window.addEventListener('pageshow', () => heroVisual?.setPaused(paused));
