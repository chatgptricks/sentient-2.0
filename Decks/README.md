# Sentient campaign deck

The presentation has exactly the twelve slides from the supplied campaign brief. Its first slide is the cover. Content, conditions and placeholders come from that brief; there are no additional account lists or promotional examples.

The deck has its own layouts, system typography and styles. It uses the original upright Sentient logo as its brand identity. It does not use website scenes, animations, photos or visual components.

Every slide shares the same viewport dimensions and margins. The complete content, including notes, is fitted within the space between the floating controls. Printed pages share the same 16:9 dimensions.

- Local: `http://localhost:4322/#/campaign-deck`
- Published: https://chatgptricks.github.io/sentient-2.0/#/campaign-deck

`campaign-deck.mjs` owns content; `player.mjs` owns rendering and navigation; `fit.mjs` owns responsive fitting. Rebuild and reload after edits using `npm run build` from `site/`. Run `npm run check` before publishing. A push to `main` deploys through the existing GitHub Pages workflow.

The `#/…` hash namespace selects a deck from `registry.mjs`. Crossing between the normal website and the presentation reloads the document so each starts with its own styles and behavior. Public builds use `BASE_PATH=/sentient-2.0 STATIC_HOSTING=1 npm run build`.
