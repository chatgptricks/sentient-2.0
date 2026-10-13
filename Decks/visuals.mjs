const visualFactories = {
  sculpture: () => import('../site/src/scene.mjs').then(module => (host, paused) => module.createScene(host, paused, { upright: true })),
  pins: () => import('../site/src/point-logo.mjs').then(module => module.createPointLogo),
  crowd: () => import('../site/src/viral-crowd.mjs').then(module => module.createViralCrowd),
};

export function initDeckVisuals(root) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const records = [...root.querySelectorAll('[data-deck-visual]')].map(host => ({
    host,
    slide: host.closest('article'),
    type: host.dataset.deckVisual,
    fallbacks: [...host.querySelectorAll('[data-deck-fallback]')],
    instance: null,
    loading: false,
    failed: false,
    paused: null,
  }));
  const byHost = new Map(records.map(record => [record.host, record]));
  let disposed = false, suspended = false, scheduled = 0;

  const showFallback = record => {
    const ready = record.host.classList.contains('scene-ready') || record.host.classList.contains('field-ready');
    const unavailable = record.host.classList.contains('scene-unavailable') || record.host.classList.contains('field-unavailable');
    for (const fallback of record.fallbacks) fallback.hidden = ready && !unavailable;
  };
  const visible = record => {
    if (disposed || suspended || document.hidden || !record.host.isConnected || !root.contains(record.host)
      || record.host.hidden || record.slide?.hidden) return false;
    const { width, height } = record.host.getBoundingClientRect();
    return width > 0 && height > 0;
  };
  const pause = (record, value) => {
    if (!record.instance || record.paused === value) return;
    record.paused = value;
    record.instance.setPaused(value);
  };
  const initialize = async record => {
    const factory = visualFactories[record.type];
    if (!factory || record.loading || record.failed || record.instance || !visible(record)) return;
    record.loading = true;
    try {
      const createVisual = await factory();
      // A slide may have closed or the player may have unmounted while its
      // module loaded. Construct only after checking the current dimensions.
      if (!visible(record)) return;
      record.paused = reduced.matches;
      record.instance = createVisual(record.host, record.paused);
      pause(record, !visible(record) || reduced.matches);
    } catch {
      record.failed = true;
      record.host.classList.remove('scene-ready', 'field-ready');
      record.host.classList.add(record.type === 'sculpture' ? 'scene-unavailable' : 'field-unavailable');
    } finally {
      record.loading = false;
      showFallback(record);
    }
  };

  function update() {
    if (disposed) return;
    for (const record of records) {
      const active = visible(record);
      if (record.instance) pause(record, !active || reduced.matches);
      else if (active) void initialize(record);
      showFallback(record);
    }
  }
  const scheduleUpdate = () => {
    if (disposed || scheduled) return;
    scheduled = window.requestAnimationFrame(() => { scheduled = 0; update(); });
  };
  const observer = new MutationObserver(changes => {
    let slideChanged = false;
    for (const change of changes) {
      if (change.attributeName === 'hidden' && change.target.matches('article, [data-deck-visual]')) slideChanged = true;
      if (change.attributeName === 'class') {
        const record = byHost.get(change.target);
        if (record) showFallback(record);
      }
    }
    if (slideChanged) scheduleUpdate();
  });
  observer.observe(root, { attributes: true, subtree: true, attributeFilter: ['hidden', 'class'] });
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate);
  for (const record of records) resizeObserver?.observe(record.host);
  const onPageHide = event => {
    if (!event.persisted) { dispose(); return; }
    suspended = true;
    for (const record of records) pause(record, true);
  };
  const onPageShow = () => { suspended = false; update(); };

  function dispose() {
    if (disposed) return;
    disposed = true;
    window.cancelAnimationFrame(scheduled);
    observer.disconnect();
    resizeObserver?.disconnect();
    reduced.removeEventListener('change', scheduleUpdate);
    document.removeEventListener('visibilitychange', scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    for (const record of records) {
      record.instance?.dispose();
      record.instance = null;
      for (const fallback of record.fallbacks) fallback.hidden = false;
    }
  }

  reduced.addEventListener('change', scheduleUpdate);
  document.addEventListener('visibilitychange', scheduleUpdate);
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  update();
  return { update, dispose };
}
