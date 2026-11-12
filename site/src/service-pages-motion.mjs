// Scroll motion for the service landing pages. Everything renders in its final
// state without JavaScript or with motion paused; these tweens only animate
// from an earlier state when motion is on, inside the shared gsap.matchMedia.
export function setupServicePageMotion(gsap, { phone = false } = {}) {
  const once = (trigger, start = 'top 80%') => ({ trigger, start, once: true });

  // Launch: bars rise in the order the quote posts landed.
  const chart = document.querySelector('.lx-wave-chart');
  if (chart) {
    const bars = [...chart.querySelectorAll('.lx-wave-bar')];
    const timeline = gsap.timeline({ scrollTrigger: once(chart, 'top 85%') });
    bars.forEach(bar => {
      const hours = Number(bar.dataset.hours) || 0;
      timeline.from(bar, { scaleY: 0, duration: .5, ease: 'power3.out', clearProps: 'transform' }, Math.sqrt(hours / 24) * 1.8);
    });
    timeline.from(chart.querySelectorAll('.lx-wave-band'), { opacity: 0, duration: .6, stagger: .9, clearProps: 'opacity' }, 0);
  }

  gsap.utils.toArray(`${phone ? '' : '.lx-case, '}.lx-wave-steps > li, .lx-creator, .lx-creator-total, .lx-report figure, .gx-result, .gx-steps > div, .gx-phases > article, .sx-timeline > li`).forEach(element => {
    const siblings = [...element.parentElement.children];
    gsap.from(element, { y: 22, opacity: .4, duration: .7, ease: 'power3.out', delay: (siblings.indexOf(element) % 4) * .07, clearProps: 'transform,opacity', scrollTrigger: once(element, 'top 90%') });
  });

  gsap.utils.toArray('.lx-package').forEach((row, index) => {
    gsap.from(row.querySelector('strong'), { xPercent: -6, opacity: .2, duration: .8, delay: index * .12, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: once(row, 'top 88%') });
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

  // Growth: the pool dims, the picks light up, the posts fan out, ads fill the winner.
  const pipeline = document.querySelector('.gx-pipeline');
  if (pipeline) {
    const timeline = gsap.timeline({ scrollTrigger: once(pipeline, 'top 75%') });
    timeline.from(pipeline.querySelectorAll('.gx-pool img'), { opacity: 1, filter: 'grayscale(0) contrast(1)', duration: .4, stagger: .02, clearProps: 'opacity,filter' }, 0)
      .from(pipeline.querySelectorAll('.gx-pool .is-picked img'), { scale: .7, duration: .5, ease: 'back.out(2.4)', stagger: .12, clearProps: 'transform' }, .55)
      .from(pipeline.querySelectorAll('.gx-pool li > span'), { scale: 0, duration: .35, stagger: .12, ease: 'back.out(3)', clearProps: 'transform' }, .75)
      .from(pipeline.querySelectorAll('.gx-fan img'), { y: 40, rotate: 0, opacity: 0, duration: .7, stagger: .12, ease: 'power3.out', clearProps: 'transform,opacity' }, .9)
      .from(pipeline.querySelectorAll('.gx-ads-bar i'), { width: 0, duration: .9, stagger: .1, ease: 'power2.out', clearProps: 'width' }, 1.4)
      .from(pipeline.querySelector('.gx-ads b'), { scale: 0, duration: .4, ease: 'back.out(3)', clearProps: 'transform' }, 2.1);
  }

  const art = document.querySelector('.gx-narrative-art');
  if (art) {
    gsap.timeline({ scrollTrigger: once(art) })
      .from(art.querySelector('.gx-ig-card'), { y: 50, opacity: 0, duration: .8, ease: 'power3.out', clearProps: 'transform,opacity' })
      .from(art.querySelectorAll('.gx-behind'), { rotate: 0, x: (index) => index ? -60 : 60, opacity: 0, duration: .8, ease: 'power3.out', clearProps: 'transform,opacity' }, .2);
  }
}
