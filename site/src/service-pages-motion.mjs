// Scroll motion for the service landing pages. Everything renders in its final
// state without JavaScript or with motion paused; these tweens only animate
// from an earlier state when motion is on, inside the shared gsap.matchMedia.
export function setupServicePageMotion(gsap) {
  const once = (trigger, start = 'top 80%') => ({ trigger, start, once: true });

  gsap.utils.toArray('.lx-quote, .lx-pack, .gx-result, .gx-deal-card').forEach(element => {
    const siblings = [...element.parentElement.children];
    gsap.from(element, { y: 22, opacity: .4, duration: .7, ease: 'power3.out', delay: (siblings.indexOf(element) % 4) * .07, clearProps: 'transform,opacity', scrollTrigger: once(element, 'top 90%') });
  });

  gsap.utils.toArray('.sx-orb').forEach(orb => gsap.from(orb, { scale: .86, opacity: .3, duration: 1, ease: 'elastic.out(1, .7)', clearProps: 'transform,opacity', scrollTrigger: once(orb) }));

  // Count-ups keep the final text in the markup for no-JS and paused states.
  gsap.utils.toArray('[data-count]').forEach(element => {
    const target = Number(element.dataset.count);
    const suffix = element.dataset.suffix || '';
    const value = { n: 0 };
    gsap.to(value, { n: target, duration: 1.4, ease: 'power2.out', scrollTrigger: once(element, 'top 90%'),
      onUpdate: () => { element.textContent = `${Math.round(value.n).toLocaleString('en-US')}${suffix}`; },
      onComplete: () => { element.textContent = `${target.toLocaleString('en-US')}${suffix}`; } });
  });

  // Both pipelines: the pool dims and the picks light up. Growth then fans the
  // posts out and fills the winner's ad bar; Viral launch stacks the founder post
  // and quote posts, then grows the 24-hour chart.
  const add = (timeline, targets, vars, at) => { if (targets && (targets.length ?? 1)) timeline.from(targets, vars, at); };
  for (const pipeline of document.querySelectorAll('.gx-pipeline')) {
    const timeline = gsap.timeline({ scrollTrigger: once(pipeline, 'top 75%') });
    const q = selector => pipeline.querySelectorAll(selector);
    add(timeline, q('.gx-pool img'), { opacity: 1, filter: 'grayscale(0) contrast(1)', duration: .4, stagger: .02, clearProps: 'opacity,filter' }, 0);
    add(timeline, q('.gx-pool .is-picked img'), { scale: .7, duration: .5, ease: 'back.out(2.4)', stagger: .12, clearProps: 'transform' }, .55);
    add(timeline, q('.gx-pool li > span'), { scale: 0, duration: .35, stagger: .12, ease: 'back.out(3)', clearProps: 'transform' }, .75);
    add(timeline, q('.gx-fan img'), { y: 40, rotate: 0, opacity: 0, duration: .7, stagger: .12, ease: 'power3.out', clearProps: 'transform,opacity' }, .9);
    add(timeline, q('.gx-ads-bar i'), { width: 0, duration: .9, stagger: .1, ease: 'power2.out', clearProps: 'width' }, 1.4);
    add(timeline, q('.gx-ads b'), { scale: 0, duration: .4, ease: 'back.out(3)', clearProps: 'transform' }, 2.1);
    add(timeline, q('.lx-flow-founder, .lx-flow-quote'), { y: 30, opacity: 0, duration: .6, stagger: .18, ease: 'power3.out', clearProps: 'transform,opacity' }, .9);
    add(timeline, q('.lx-flow-chart rect'), { scaleY: 0, transformOrigin: '50% 100%', duration: .5, stagger: .012, ease: 'power2.out', clearProps: 'transform' }, 1.4);
  }

  const art = document.querySelector('.gx-narrative-art');
  if (art) {
    gsap.timeline({ scrollTrigger: once(art) })
      .from(art.querySelector('.gx-ig-card'), { y: 50, opacity: 0, duration: .8, ease: 'power3.out', clearProps: 'transform,opacity' })
      .from(art.querySelectorAll('.gx-behind'), { rotate: 0, x: (index) => index ? -60 : 60, opacity: 0, duration: .8, ease: 'power3.out', clearProps: 'transform,opacity' }, .2);
  }
}
