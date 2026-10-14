# Sentient campaign deck

The presentation has an opening cover followed by the twelve slides from the supplied campaign brief. Content, conditions and placeholders come from that brief; there are no additional account lists or promotional examples.

The deck has its own layouts, system typography and styles. It uses the original upright Sentient logo as its brand identity. It does not use website scenes, animations or visual components. The only photographs are the authorised Louis Gleeson and Ivan portraits, with matched framing.

Every slide shares one master grid: identical viewport dimensions and margins, fixed eyebrow and page-number anchors, and one title font and starting position. A common title band reserves the longest heading across the deck. The body fills the workspace below it; only this body scales when space is limited, including footnotes. Printed pages share the same 16:9 dimensions and anchors.

- Local: `http://localhost:4322/#/campaign-deck`
- Published: https://chatgptricks.github.io/sentient-2.0/#/campaign-deck

`campaign-deck.mjs` owns content; `player.mjs` owns rendering and navigation; `fit.mjs` owns responsive fitting. Rebuild and reload after edits using `npm run build` from `site/`. Run `npm run check` before publishing. A push to `main` deploys through the existing GitHub Pages workflow.

The `#/…` hash namespace selects a deck from `registry.mjs`. Crossing between the normal website and the presentation reloads the document so each starts with its own styles and behavior. Public builds use `BASE_PATH=/sentient-2.0 STATIC_HOSTING=1 npm run build`.
