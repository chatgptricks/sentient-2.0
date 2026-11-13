const presenceGallery = `
    <section class="v2-presence shell" aria-labelledby="v2-presence-title">
      <div class="v2-presence-heading">
        <span class="eyebrow">BEYOND THE FEED</span>
        <h2 id="v2-presence-title">In the<br> <em>conversation.</em></h2>
      </div>
      <div class="v2-presence-grid">
        <figure class="v2-presence-card">
          <div class="v2-presence-image"><img src="/assets/v2/people/ivan-meta-event.png" alt="Ivan displayed on a screen while Mark Zuckerberg presents at an event" width="510" height="510" loading="lazy" decoding="async"></div>
          <figcaption><h3>Inside the AI conversation.</h3><p>Ivan on screen during a presentation by Mark Zuckerberg.</p></figcaption>
        </figure>
        <figure class="v2-presence-card">
          <div class="v2-presence-image"><img src="/assets/v2/people/louis-nathan-lyon.png" alt="Louis and Nathan Lyon seated during an interview" width="510" height="510" loading="lazy" decoding="async"></div>
          <figcaption><h3>Stories worth sharing.</h3><p>Louis in conversation with cricketer Nathan Lyon.</p></figcaption>
        </figure>
      </div>
    </section>`;

// The About page is rebuilt in about-page.mjs (2026-11-13); its founders and
// moments are part of that markup now, so the V2 pass leaves it as is.
export function reviseV2About(html) {
  return html;
}
