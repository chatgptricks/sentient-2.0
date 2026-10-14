# Sentient campaign deck

The presentation has an opening cover, twelve slides condensed from the supplied campaign brief and a dark closing slide with the Sentient logo centred in neon lime. The brief slides use one idea per slide, a short headline and a visual composition (a monumental metric, flow, funnel, comparison, timeline, equation or loop) instead of paragraphs. The brief's conditions — follower overlap, CPM guarantee terms and paid-media requirements — stay as footnotes.

The deck has its own layouts. Titles and body copy use system Helvetica; Sentient's Lovelo Black display face sets the cover, metrics, numerals and keywords. The cover reuses the website's 3D Sentient emblem (`site/src/scene.mjs`), loaded only when the cover is shown; no other website scenes or animations are used. The only photographs are the authorised Louis Gleeson and Ivan portraits. Slides alternate dark, paper and acid-green surfaces.

Every slide shares one master grid: identical viewport dimensions and margins, fixed eyebrow and page-number anchors, and one title font and starting position. A common title band reserves the longest heading across the deck (the cover sets its own headline and is excluded). The body fills the workspace below it. On screens wider than a phone the layout always spans the full workspace while `fit.mjs` adapts only the type scale (the container that `cqw` units refer to): it shrinks on wide, short screens and grows up to 20% where height is left over, and treats any word wider than its box as not fitting, so words never break mid-word. Printed pages share the same 16:9 dimensions and anchors. Every editable text node declares its field name in `player.mjs`.

- Local: `http://localhost:4322/#/campaign-deck`
- Published: https://chatgptricks.github.io/sentient-2.0/#/campaign-deck

`campaign-deck.mjs` owns content; `player.mjs` owns rendering and navigation; `fit.mjs` owns responsive fitting. Rebuild and reload after edits using `npm run build` from `site/`. Run `npm run check` before publishing. A push to `main` deploys through the existing GitHub Pages workflow.

The `#/…` hash namespace selects a deck from `registry.mjs`. Crossing between the normal website and the presentation reloads the document so each starts with its own styles and behavior. Public builds use `BASE_PATH=/sentient-2.0 STATIC_HOSTING=1 npm run build`.
