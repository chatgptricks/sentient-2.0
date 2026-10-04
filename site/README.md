# Sentient 2.0

An agency website with animated campaign artwork, a 3D Sentient emblem on Home, a physical pin surface and an interactive isometric crowd on the service landings. Phones use a compact Home composition with an oversized moving mark behind the headline, a persistent five-tab bottom navigation (Home, Viral, Growth, About, Call), native swipe galleries, and compact timelines. Call opens the contact section; tapping the current page tab returns to the top without restarting its animation.

## Run

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Open http://localhost:4322. The server binds to this Mac only. `PORT` can change the port. Keep the process running while previewing.

```sh
npm run build
npm run check
```

Run `build` after editing and reload the browser. The server builds at startup; it does not watch source files. Checks cover routes, asset links, the account roster, content limits, request validation, and actual local inquiry persistence.

## Routes and implementation

- `/`: agency home, offers, campaign evidence, inquiry form.
- `/viral-launch-campaigns`: launch process and four-column campaign gallery.
- `/growth-campaigns`: ongoing campaign offer.
- `/about`: founders and network relationships.
- Universe is currently hidden. Its source is retained behind `features.universe` in `src/site-config.mjs`.

Static HTML is rendered by `src/pages.mjs`. GSAP powers motion; Three.js renders the Home symbol, Launch crowd, and account universe. Growth uses Canvas 2D for a shaded pin surface with the Sentient logo raised within it. esbuild bundles browser code. Fonts and visual assets are local. Lovelo Black is Sentient's primary display font; Space Grotesk is used for body text and controls. All typography is sans-serif. The map has a directory fallback when WebGL is unavailable, and the motion switch honors reduced-motion preferences.

Content lives in `src/content.mjs` and `src/universe-data.mjs`. Base styles are in `public/styles.css`; the current visual pass is in `public/art-direction.css` and `public/universe-polish.css`. `src/service-hero.mjs` and `public/service-fields.css` define the launch/growth hero layouts and static artwork. The final shared spacing and material rules live in `public/refinement.css`; dedicated phone layouts and interactions live in `public/mobile-experience.css` and `public/mobile.js`. `src/service-previews.mjs` provides compact SVG echoes of the crowd and pin surface for the Home service cards, without additional canvas renderers.

`src/viral-crowd.mjs` renders the dense, full-hero Launch crowd using simple head-and-body marks. Its orthographic camera sits at approximately 35.264° elevation and 30° azimuth, giving the rows a more diagonal view. Figures and contact shadows retain their requested 2× local scale; the 112 × 112 grid, all 12,544 positions, and propagation remain unchanged. `src/viral-crowd-model.mjs` schedules an organic chain reaction through neighboring people, with curved branches, faster clusters, slower pockets, and individual fade-in speeds. A single seed reaches the whole crowd in about 20 seconds of active animation. The crowd starts dark; mouse movement or touch ignites a person and gradually lights the crowd. Progress survives pauses and scrolling away, and resets only on page reload. No start or reset controls are shown.

`src/point-logo.mjs` renders Growth's entire hero as a 2D affine pin surface, with the official Sentient symbol raised above the background pins. Hover or touch across the hero sends traveling ripples through the surface; links and controls are excluded. The first wave progressively lights only logo pins, preserving the dark background and logo openings. Logo lighting stays on through subsequent waves, pauses, and resizing until page reload. Later waves briefly brighten only the already-lit logo caps, then settle back to their steady lime color. Additional wave lift is bounded at 20 pixels on desktop and 14 pixels on mobile. Waves cross the field in about 8.4 seconds, with critically damped pin travel, fixed cap sizes, visible shafts, and contact shadows. Up to ten can coexist; a full buffer waits for a wave to finish instead of cutting an active wave short. `src/wave-surface-art.mjs` shares the pin layout, heights, shading, and palettes between Canvas and `src/point-logo-fallback.mjs`; adaptive spacing caps the field at 22,000 pins. The official silhouette still comes from `src/point-logo-art.mjs`, including its holes. The static SVG field remains available for paused or reduced-motion startup and unavailable rendering.

Both service visuals respect the motion toggle and reduced-motion setting, stop rendering offscreen or when hidden, and stop at rest. `dist/` is generated output. Checks cover the four active routes and local inquiry behavior. Browser review covers desktop and 320–390px phone layouts, navigation, swipe controls, contact docking, and animation triggering.

## Local forms

The Node server saves inquiries in `.local/inquiries.jsonl`. Nothing is emailed or sent to a CRM. `SENTIENT_LOCAL_DATA_DIR` can select another private local storage directory. Test fixtures created by `npm run check` use a temporary directory and are cleaned up.

## GitHub Pages

The root GitHub Actions workflow checks the site and deploys pushes to `main` at https://chatgptricks.github.io/sentient-2.0/. Public builds use `BASE_PATH=/sentient-2.0 STATIC_HOSTING=1` for route and asset paths. GitHub Pages has no inquiry backend, so the public form is visibly disabled; local inquiry handling remains available during development.

Private local data, visual review captures, internal briefs, and provenance manifests are excluded from Git.

## Shared links

Every route includes an absolute canonical URL, Open Graph metadata, and a large Twitter/X card. The shared 1200×630 artwork is `public/assets/social-preview.jpg`; route titles and descriptions come from the page definitions. Public share URLs default to the GitHub Pages deployment. `PUBLIC_ORIGIN` and `PUBLIC_BASE_PATH` can override them for a future domain.
