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

During a password rotation, optionally configure `DECK_EDITOR_PASSWORD_LEGACY_SHA256` with the previous password's 64-character SHA-256 hex digest. Both passwords then work for classic deck editing, Studio publishing and protected account/post lookups. The primary secret remains required; a missing or malformed legacy digest is ignored. The Worker hashes each submitted password once and compares it against both configured digests without stopping at the first match. To preserve existing access during rollout, deploy this compatibility code and configure the legacy digest before changing the primary digest. Removing the legacy secret revokes the previous password.

Apply the new migration before deploying the Worker, using the existing local/remote migration commands. A saved deck can be read or downloaded as JSON from the GET endpoint. Administrators can also export the backing database with `npx wrangler d1 export sentient-proposal-comments --remote --output=<private-path>`.

## Promotional-post lookups

The campaign deck's editor can replace a showcased promotional post by pasting its Instagram link. The Worker resolves it through the SentientDash website API, so the browser never sees the SentientDash key and nothing is read from Instagram.

`POST /decks/campaign-deck/instagram-post` accepts JSON `{ url }` with the same editor bearer password, allowed origin and edit rate limit as saving. It accepts `instagram.com/p/…`, `/reel/…` and account-prefixed links. With an account in the link it reads `GET /api/v1/accounts/{handle}/posts/{shortcode}`; otherwise it reads `GET /api/v1/posts/{shortcode}`, which finds the account within the key's scope in one call. It returns `{ account, shortcode, permalink, publishedAt, likes, comments, caption, isPromo, metricsUpdatedAt, cover }`, `404` when SentientDash has no exported data for the post, and `503` until the key is configured.

`GET /decks/campaign-deck/covers/{handle}/{shortcode}` is public because the deck is public, but it only serves covers whose `handle/shortcode` is saved in a deck `…-source` field. It reads the stored SentientDash cover and caches it for a day.

Configure the key as a secret: create an account-scoped website key at SentientDash `/api.html` covering the Sentient accounts, then run `npx wrangler secret put SENTIENTDASH_API_KEY` here and paste it at the hidden prompt. `SENTIENTDASH_API_URL` optionally overrides the default `https://cortex-api-db2e.onrender.com`. The API key is never stored in this repository.

`POST /decks/{slug}/account` accepts JSON `{ handle }` with the same editor authorisation and returns `{ handle, followers, avatar, capturedAt }` for any valid Instagram handle or profile URL. The shared account picker works in classic and Studio decks, including named versions.

## Deck Studio publishing

Migration `0003_studio.sql` adds `studio_decks` (published decks, at most 512 KiB of JSON each) and `studio_assets` (their images, content-addressed by SHA-256 and stored as base64 text, at most 1.4 MB each). It does not change comments or the campaign deck. Apply it with the usual local/remote migration commands before deploying the Worker. `STUDIO_RATE` limits studio writes to 120 per minute per IP (a publication uploads each image separately).

- `GET /studio/decks/{slug}` — public; returns `{ slug, title, deck, revision, publishedAt, updatedAt }` or `404`.
- `PUT /studio/decks/{slug}` — `{ deck, revision }`; `revision` is `0` to publish a new slug, otherwise the revision last published from this copy. A stale revision returns `409` with the current publication. Decks must be plain data: a title, 1–80 slides with element arrays, strings of at most 4,000 characters and no `data:`/`javascript:` values (images are uploaded first). The slugs `campaign-deck` and `studio` are reserved.
- `DELETE /studio/decks/{slug}` — unpublishes.
- `GET /studio/decks` — lists published decks (password required).
- `POST /studio/assets` — raw WebP, PNG, JPEG or GIF body; returns `{ id, url }`. `GET /studio/assets/{id}` serves it publicly with an immutable cache.
- `POST /studio/auth` — checks the password. `POST /studio/account` and `POST /studio/instagram-post` are the SentientDash lookups; the post lookup copies the cover into `studio_assets` so a published deck never depends on SentientDash.

Every write uses a deck editor password as `Authorization: Bearer …` from an allowed origin. The primary `DECK_EDITOR_PASSWORD_SHA256` and optional `DECK_EDITOR_PASSWORD_LEGACY_SHA256` secrets apply to Studio as well as the classic deck.

Inline text editing is available at `GET`/`PUT /decks/<slug>` and `POST /decks/<slug>/auth` for every deck. Each slug has its own revision and saved fields. Migration `0004_deck_text_edits.sql` adds storage for additional decks; the existing campaign table and its saved edits remain in place. Apply the migration before deploying this Worker.

Named text copies use `GET`/`POST /decks/<slug>/versions` and `GET`/`PUT /decks/<slug>/versions/<id>`, with the same editor password and permitted origin required for every operation. Migration `0005_deck_text_versions.sql` stores each copy as bounded JSON text fields, a required unique name, and an independent revision. Copies do not write to the original or duplicate the deck design. Normal presentation loads always read the original endpoint; version selection is confined to the current edit session.

Account profile lookups accept any Instagram handle or profile URL through the authenticated SentientDash `/api/decks/profile-preview` action. They do not create or track Dashboard accounts, and they do not require adding the account to a website API key. The protected deck endpoint stores the returned profile photo in the existing content-addressed image store and returns its stable URL together with the follower count. The existing website key needs its accounts grant; stored-data scope restrictions remain unchanged. Profile refresh runs on explicit selection or the Update profiles control. Account identity, photo reference and snapshot date can also be retained in named versions.
