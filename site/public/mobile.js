const mobileViewport = window.matchMedia('(max-width: 650px)');
const reducedMobileMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileRails = [];

for (const rail of document.querySelectorAll('[data-mobile-carousel]')) {
  const controls = rail.nextElementSibling;
  if (controls?.dataset.carouselControls !== rail.id) continue;
  const previous = controls.querySelector('[data-carousel-prev]');
  const next = controls.querySelector('[data-carousel-next]');
  const status = controls.querySelector('[data-carousel-status]');
  if (!previous || !next || !status) continue;
  const originalTabindex = rail.getAttribute('tabindex');
  let current = 0;
  let scheduled = 0;

  const positions = () => {
    const bounds = rail.getBoundingClientRect();
    const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const padding = parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0;
    return [...rail.children].map(child => {
      const box = child.getBoundingClientRect();
      const centered = getComputedStyle(child).scrollSnapAlign.split(' ').includes('center');
      const offset = centered ? (rail.clientWidth - box.width) / 2 : padding;
      const left = rail.scrollLeft + box.left - bounds.left - rail.clientLeft - offset;
      return Math.max(0, Math.min(maximum, left));
    });
  };

  const update = () => {
    scheduled = 0;
    const stops = positions();
    const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
    current = stops.reduce((nearest, left, index) =>
      Math.abs(left - rail.scrollLeft) < Math.abs(stops[nearest] - rail.scrollLeft) ? index : nearest, 0);
    if (rail.scrollLeft <= 2) current = 0;
    else if (maximum > 2 && rail.scrollLeft >= maximum - 2) current = stops.length - 1;
    previous.disabled = maximum <= 2 || current === 0;
    next.disabled = maximum <= 2 || current >= stops.length - 1;
    const label = `${String(stops.length ? current + 1 : 0).padStart(2, '0')} / ${String(stops.length).padStart(2, '0')}`;
    if (status.textContent !== label) status.textContent = label;
    if (mobileViewport.matches) rail.setAttribute('tabindex', originalTabindex ?? '0');
    else if (originalTabindex === null) rail.removeAttribute('tabindex');
  };

  const schedule = () => {
    if (!scheduled) scheduled = requestAnimationFrame(update);
  };

  const move = direction => {
    if (!mobileViewport.matches) return;
    update();
    const stops = positions();
    const target = Math.max(0, Math.min(stops.length - 1, current + direction));
    if (!stops.length) return;
    const quiet = reducedMobileMotion.matches || document.documentElement.classList.contains('motion-paused');
    rail.scrollTo({ left: stops[target], behavior: quiet ? 'instant' : 'smooth' });
    schedule();
  };

  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  rail.addEventListener('scroll', schedule, { passive: true });
  rail.addEventListener('keydown', event => {
    if (!mobileViewport.matches || event.target !== rail || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  });
  mobileRails.push(schedule);
  update();
}

const mobileDock = document.querySelector('.mobile-dock');
const mobileContact = document.querySelector('#contact');
const mobileTabs = Array.from(mobileDock?.querySelectorAll('[data-mobile-tab]') || []);
const normalizeMobilePath = pathname => pathname.replace(/\/+$/, '') || '/';
let dockFrame = 0;

const updateMobileDock = () => {
  dockFrame = 0;
  if (!mobileDock) return;
  const contact = mobileContact?.getBoundingClientRect();
  const contactVisible = Boolean(contact && contact.top < window.innerHeight * 0.65 && contact.bottom > window.innerHeight * 0.25);
  for (const tab of mobileTabs) {
    const key = tab.dataset.mobileTab;
    const current = contactVisible ? (key === 'call' ? 'location' : null) : (key === document.body.dataset.page ? 'page' : null);
    if (current) tab.setAttribute('aria-current', current);
    else tab.removeAttribute('aria-current');
  }
  const active = document.activeElement;
  // Keep a focused link available until focus leaves the dock naturally.
  if (mobileDock.contains(active)) {
    mobileDock.classList.remove('is-hidden');
    return;
  }
  const fieldFocused = active?.matches('textarea, select, input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="hidden"]), [contenteditable]:not([contenteditable="false"])');
  const viewport = window.visualViewport;
  const keyboardVisible = viewport && viewport.scale <= 1.05 && viewport.height < window.innerHeight * 0.75;
  mobileDock.classList.toggle('is-hidden', mobileViewport.matches && Boolean(fieldFocused || keyboardVisible));
};

const scheduleMobileDock = () => {
  if (!dockFrame) dockFrame = requestAnimationFrame(updateMobileDock);
};

for (const tab of mobileTabs) {
  tab.addEventListener('click', event => {
    if (!mobileViewport.matches || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (tab.dataset.mobileTab === 'call') return;
    const destination = new URL(tab.href, window.location.href);
    if (destination.origin !== window.location.origin || normalizeMobilePath(destination.pathname) !== normalizeMobilePath(window.location.pathname)) return;
    event.preventDefault();
    // Retapping the current page returns to its beginning without recreating
    // its animations. Ignore an existing #contact when matching the route.
    if (window.location.hash) history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
    const quiet = reducedMobileMotion.matches || document.documentElement.classList.contains('motion-paused');
    window.scrollTo({ top: 0, behavior: quiet ? 'instant' : 'smooth' });
    scheduleMobileDock();
  });
}

const refreshMobileLayout = () => {
  mobileRails.forEach(update => update());
  scheduleMobileDock();
};

window.addEventListener('resize', refreshMobileLayout, { passive: true });
window.addEventListener('pageshow', refreshMobileLayout);
window.addEventListener('scroll', scheduleMobileDock, { passive: true });
window.addEventListener('hashchange', scheduleMobileDock);
window.visualViewport?.addEventListener('resize', scheduleMobileDock, { passive: true });
window.visualViewport?.addEventListener('scroll', scheduleMobileDock, { passive: true });
mobileViewport.addEventListener('change', refreshMobileLayout);
document.addEventListener('focusin', scheduleMobileDock);
document.addEventListener('focusout', scheduleMobileDock);
if (mobileDock) new MutationObserver(scheduleMobileDock).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
updateMobileDock();
