# Sentient decks

Web presentations share the Sentient website's Lovelo display font, Space Grotesk body font, local assets and GitHub Pages deployment. Their source lives here, beside `site/`.

Slides fill the viewport with floating controls. Keep the Sentient logo and wordmark upright, preserve their proportions, and use the `upright` scene option for dimensional brand artwork.

Open the campaign deck at:

- Local: `http://localhost:4322/#/campaign-deck`
- Published: https://chatgptricks.github.io/sentient-2.0/#/campaign-deck
- A specific slide: https://chatgptricks.github.io/sentient-2.0/#/campaign-deck/2

## Add a deck

1. Create a module in this folder following the structure in `campaign-deck.mjs`. Use a unique lowercase slug, such as `partner-proposal`, for its URL.
2. Import that deck in `registry.mjs` and add it to the exported `decks` array.
3. Reuse website images from `site/public/assets/`. New public deck images can be added there too; keep private briefs and internal source material outside tracked public files.
4. Run `npm run build` and `npm run check` from `site/`, then review `/#/<slug>` in the local browser. The preview server builds at startup and does not watch files, so rebuild and reload after changes.
5. Publishing a push to `main` runs the existing GitHub Pages workflow. No separate host or Pages configuration is needed.

`campaign-deck.mjs` contains a cover, the twelve slides from the supplied campaign brief, and a gallery of recent promotional examples selected from Sentient Dash. `examples.mjs` retains their source links and stored engagement measurements. The CPM and delivery compensation remain placeholders for proposal-specific terms.

## Runtime and build

`router.mjs` owns the root page's `#/…` namespace. Normal website anchors such as `#contact` keep their existing behavior. Deck links do not require server rewrites because GitHub Pages receives the same root document.

For a deck hash, the router calls `mountDeck(hash)` from `player.mjs`. The player owns slide hash changes and clears the initial `document.documentElement.dataset.deck` marker once it has rendered. The initial marker hides the website while the deck is loading.

For normal Home visits, the router imports the website's navigation, comments and animation scripts. Changing between Home and a deck reloads the document so each mode starts cleanly; slide changes stay within the player. The other website pages keep their existing entry scripts.

The site build bundles this router to `site/dist/Decks/router.js`. The player's CSS import produces `router.css`; the existing build rewrites resource paths for `/sentient-2.0` in public builds.

To check the public build locally, run from `site/`:

```sh
BASE_PATH=/sentient-2.0 STATIC_HOSTING=1 npm run build
```
