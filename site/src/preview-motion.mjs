// Called from the page's active GSAP context. Every replay is finite; cleanup
// also covers timelines created later by pointer, focus, or observer callbacks.
export function setupServicePreviews({ gsap, ScrollTrigger, listen }) {
  const previews = [...document.querySelectorAll('.offer-preview')];
  const cleanups = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let disposed = false;

  const addListener = (target, event, callback) => {
    if (listen) listen(target, event, callback);
    else target.addEventListener(event, callback);
    cleanups.push(() => target.removeEventListener(event, callback));
  };
  const baseStroke = path => path.getAttribute('stroke') || '#68814d';
  const lightStroke = path => {
    const base = baseStroke(path).slice(1);
    const highlight = [232, 255, 184];
    return `#${highlight.map((channel, index) => Math.round(parseInt(base.slice(index * 2, index * 2 + 2), 16) * .44 + channel * .56).toString(16).padStart(2, '0')).join('')}`;
  };

  for (const preview of previews) {
    const offer = preview.closest('.offer');
    const bands = [...preview.querySelectorAll('[data-preview-band]')];
    const paths = bands.flatMap(band => [...band.querySelectorAll('path')]);
    const growth = preview.classList.contains('offer-preview--growth');
    if (!offer || !bands.length) continue;
    let animation;

    const restore = () => {
      gsap.set(paths, { clearProps: 'stroke' });
      if (growth) gsap.set(bands, { clearProps: 'transform' });
    };
    const play = () => {
      if (disposed || reduced.matches || document.documentElement.classList.contains('motion-paused') || animation?.isActive()) return;
      restore();
      if (growth) gsap.set(bands, { y: 0 });
      animation = gsap.timeline({ onComplete: restore });
      bands.forEach((band, index) => {
        const strokes = band.querySelectorAll('path');
        const start = index * .065;
        animation.to(strokes, { stroke: (_, path) => lightStroke(path), duration: .17, ease: 'sine.out' }, start)
          .to(strokes, { stroke: (_, path) => baseStroke(path), duration: .4, ease: 'sine.inOut' }, start + .17);
        if (growth) {
          animation.to(band, { y: -3.5, duration: .19, ease: 'sine.out' }, start)
            .to(band, { y: 0, duration: .38, ease: 'sine.inOut' }, start + .19);
        }
      });
    };

    addListener(offer, 'pointerenter', () => { if (hover.matches) play(); });
    addListener(offer, 'focusin', play);

    if ('IntersectionObserver' in window) {
      // A viewport observer also clips against overflow ancestors, so the
      // second card in a native horizontal mobile rail waits for its own turn.
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .55)) {
          play();
          observer.disconnect();
        }
      }, { threshold: .55 });
      observer.observe(preview);
      cleanups.push(() => observer.disconnect());
    } else if (ScrollTrigger) {
      const trigger = ScrollTrigger.create({ trigger: preview, start: 'top 85%', once: true, onEnter: play });
      cleanups.push(() => trigger.kill());
    }
    cleanups.push(() => { animation?.kill(); restore(); });
  }

  return () => {
    disposed = true;
    cleanups.splice(0).forEach(cleanup => cleanup());
  };
}
