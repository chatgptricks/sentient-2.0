# Proposal comments

GitHub Pages serves the site. A dedicated Cloudflare Worker and D1 database store public feedback for all five proposal pages. Names are self-reported; no sign-in is required. Notes are displayed as text, never interpreted as HTML. Posts have bounded inputs and a per-IP rate limit. Only configured site origins can submit through the browser. The API supports reads and creates, with no public update/delete access.

The browser refreshes the current page's comments every 15 seconds while visible. Anchors store a content selector, text excerpt, and relative coordinates; a page-position fallback keeps older notes accessible if markup changes. The Notes list includes notes whose desktop target is hidden on mobile.

## Local development

Run `npm ci` here, then `npx wrangler d1 migrations apply sentient-proposal-comments --local` and `npm run dev`. Run the site with `npm run dev` in `../site`. Localhost uses the local Worker/database to keep test notes out of the public proposal.

The allowed browser origins are GitHub Pages plus `localhost` and `127.0.0.1` on ports `4322` and `14323`. The latter supports the presentation editing preview. Origin matching is exact; changing a preview port requires updating `ALLOWED_ORIGINS` and redeploying this Worker.

## Deploy

Run `npm test`, `npx wrangler d1 migrations apply sentient-proposal-comments --remote`, and `npm run deploy` here. Cloudflare OAuth credentials stay in Wrangler's user configuration, outside this repository. The public API URL is in `../site/public/comments-config.json`; `COMMENTS_API_URL` can override it at build time. Push the site to `main` for GitHub Pages deployment.

D1 is the persistent source of truth. Site rebuilds and Worker deployments do not recreate or clear its rows. Cloudflare administrators can review/export notes with `npx wrangler d1 execute sentient-proposal-comments --remote --command "SELECT * FROM comments"`. Take a database export before any manual cleanup.

## Shared deck text

The same Worker stores shared text overrides for the campaign deck. Migration `0002_deck_edits.sql` adds `deck_edits` to the existing D1 database; it does not change proposal comments. The only permitted deck slug is `campaign-deck`.

`GET /decks/campaign-deck` is public and returns `{ deck, fields, revision, updatedAt }`. With no saved edits, `fields` is empty, `revision` is `0`, and `updatedAt` is `null`; the browser uses the deck's source copy for fields without overrides. The API origin remains the `apiUrl` in `site/public/comments-config.json`.

`PUT /decks/campaign-deck` accepts JSON `{ fields, revision }` and an `Authorization: Bearer <editor password>` header from an allowed site origin. `fields` is the complete overrides map: up to 1,000 string values, each at most 1,000 characters, in a request of at most 128 KiB. Field keys use letters, numbers, dots, underscores, colons, slashes and hyphens, up to 200 characters. Empty strings are preserved. Saving increments the revision and returns the saved state. HTTP `409` includes the current state when another editor has already saved; reload or reconcile it before retrying.

`POST /decks/campaign-deck/auth` accepts JSON `{ password }` and returns `{ ok: true }` when the configured password matches. Invalid credentials return `401`; successful authentication does not save or modify text. The browser retains the password only for its active editing session and includes it in the bearer header on each save.

The plaintext password is not stored in this repository or returned by the API. Configure `DECK_EDITOR_PASSWORD_SHA256` as a Wrangler secret containing the password's 64-character SHA-256 hex digest. For example, generate the digest with a hidden terminal prompt, then supply that digest to `npx wrangler secret put DECK_EDITOR_PASSWORD_SHA256`. Local development can provide the digest as a runtime binding with `wrangler dev --var DECK_EDITOR_PASSWORD_SHA256:<digest>`. Keep plaintext credentials and local secret files outside tracked files. Without the secret, reads work and writes are unavailable. Edit attempts have a separate per-IP rate limit.

Apply the new migration before deploying the Worker, using the existing local/remote migration commands. A saved deck can be read or downloaded as JSON from the GET endpoint. Administrators can also export the backing database with `npx wrangler d1 export sentient-proposal-comments --remote --output=<private-path>`.

## Promotional-post lookups

The campaign deck's editor can replace a showcased promotional post by pasting its Instagram link. The Worker resolves it through the SentientDash website API, so the browser never sees the SentientDash key and nothing is read from Instagram.

`POST /decks/campaign-deck/instagram-post` accepts JSON `{ url }` with the same editor bearer password, allowed origin and edit rate limit as saving. It accepts `instagram.com/p/…`, `/reel/…` and account-prefixed links. With an account in the link it reads `GET /api/v1/accounts/{handle}/posts/{shortcode}`; otherwise it lists the key's accounts and checks each one. It returns `{ account, shortcode, permalink, publishedAt, likes, comments, caption, isPromo, metricsUpdatedAt, cover }`, `404` when SentientDash has no exported data for the post, and `503` until the key is configured.

`GET /decks/campaign-deck/covers/{handle}/{shortcode}` is public because the deck is public, but it only serves covers whose `handle/shortcode` is saved in a deck `…-source` field. It reads the stored SentientDash cover and caches it for a day.

Configure the key as a secret: create an account-scoped website key at SentientDash `/api.html` covering the Sentient accounts, then run `npx wrangler secret put SENTIENTDASH_API_KEY` here and paste it at the hidden prompt. `SENTIENTDASH_API_URL` optionally overrides the default `https://cortex-api-db2e.onrender.com`. The API key is never stored in this repository.

`POST /decks/campaign-deck/account` accepts JSON `{ handle }` with the same editor authorisation and returns `{ handle, followers, capturedAt }` from SentientDash `GET /api/v1/accounts/{handle}` (the exact latest follower count and when it was recorded). The deck uses it when an account is chosen and from its "Update followers" button.
