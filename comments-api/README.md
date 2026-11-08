# Proposal comments

GitHub Pages serves the site. A dedicated Cloudflare Worker and D1 database store public feedback for all five proposal pages. Names are self-reported; no sign-in is required. Notes are displayed as text, never interpreted as HTML. Posts have bounded inputs and a per-IP rate limit. Only configured site origins can submit through the browser. The API supports reads and creates, with no public update/delete access.

The browser refreshes the current page's comments every 15 seconds while visible. Anchors store a content selector, text excerpt, and relative coordinates; a page-position fallback keeps older notes accessible if markup changes. The Notes list includes notes whose desktop target is hidden on mobile.

## Local development

Run `npm ci` here, then `npx wrangler d1 migrations apply sentient-proposal-comments --local` and `npm run dev`. Run the site with `npm run dev` in `../site`. Localhost uses the local Worker/database to keep test notes out of the public proposal.

The allowed browser origins are GitHub Pages plus `localhost` and `127.0.0.1` on ports `4322` and `14323`. The latter supports the presentation editing preview. Origin matching is exact; changing a preview port requires updating `ALLOWED_ORIGINS` and redeploying this Worker.

## Deploy

Run `npm test`, `npx wrangler d1 migrations apply sentient-proposal-comments --remote`, and `npm run deploy` here. Cloudflare OAuth credentials stay in Wrangler's user configuration, outside this repository. The public API URL is in `../site/public/comments-config.json`; `COMMENTS_API_URL` can override it at build time. Push the site to `main` for GitHub Pages deployment.

D1 is the persistent source of truth. Site rebuilds and Worker deployments do not recreate or clear its rows. Cloudflare administrators can review/export notes with `npx wrangler d1 execute sentient-proposal-comments --remote --command "SELECT * FROM comments"`. Take a database export before any manual cleanup.

## Private website inquiries

`POST /inquiries` accepts JSON (or URL-encoded form fields) containing a stable UUID `id`, `name`, `company`, `email`, `description`, `budget`, `stage`, and `service` (`campaign`, `launch`, or `growth`). Launch requires a real `launchDate` in `YYYY-MM-DD`; Growth requires `frequency` (`Weekly`, `Monthly`, `Quarterly`, or `Still planning`). Budgets and company stages match the site form. Keep the UUID unchanged for retries of the same brief; a changed brief with an existing UUID returns `409`. An optional `Idempotency-Key` header must equal `id`.

The JavaScript flow uses JSON receipts and supplies its stable draft UUID. A native URL-encoded form may omit `id`; the server generates a fresh UUID per submission and returns an escaped, readable HTML receipt/error with a link back to the primary site. No static build UUID is shared between visitors.

Migration `0006_inquiries.sql` stores validated briefs in a private D1 `inquiries` table. There is no public read/list route for this personal data. Requests require a configured site origin, a bounded 16 KB body, and the `INQUIRY_RATE` binding (10 attempts per minute per IP). The receipt contains only `id`, `saved`, `notificationStatus`, and `message`; it never returns names, contact details, brief text, provider IDs, credentials, or destination configuration.

The production recipient is configured server-side as `INQUIRY_TO=contact@sentientagency.io`; callers cannot change the recipient or sender. A durable save without an enabled notifier returns HTTP `202`, `saved: true`, and `notificationStatus: "not_configured"`. This is a saved inquiry, **not** an email-delivery claim. Production already has the restricted `INQUIRY_EMAIL` binding and Cloudflare provider selected, but deliberately omits `INQUIRY_FROM` while that production destination remains unverified. The handler therefore preserves incoming briefs without attempting notification or consuming an uncertain send attempt.

To notify the team through Cloudflare, configure an onboarded sender domain, the fixed/verified recipient, `INQUIRY_FROM`, and `INQUIRY_DELIVERY_PROVIDER=cloudflare`, plus a restricted binding:

```json
{"send_email":[{"name":"INQUIRY_EMAIL","destination_address":"contact@sentientagency.io"}]}
```

Email Routing is ready on the dedicated sender subdomain `forms.sentientdash.app`; its setup left the parent domain's MX and TXT records unchanged. After the production recipient's verification is confirmed, set `INQUIRY_FROM=website@forms.sentientdash.app` and redeploy to enable notification. Keep production's fixed recipient unchanged.

The adapter calls the documented structured `INQUIRY_EMAIL.send()` API with plain-text content, the validated visitor email as `replyTo`, and the inquiry UUID as an `X-Inquiry-ID` tracking header. It does not override the provider's `Message-ID`. See [Cloudflare's send API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/) and [restricted bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/). A resolved provider response with its message ID is recorded as `accepted`; that confirms notification submission, not delivery to the recipient's inbox. One isolated QA Worker using this exact handler sent a single synthetic inquiry to a separately verified test recipient: Cloudflare accepted it and the tester confirmed inbox receipt. The temporary Worker was then deleted; no QA message was sent to the production recipient.

Alternatively set `INQUIRY_DELIVERY_PROVIDER=resend`, a verified `INQUIRY_FROM`, and the server secret `RESEND_API_KEY`. This adapter uses the fixed Resend email API and a stable `Idempotency-Key: inquiry/<UUID>`. Resend documents a [24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys); this service uses a conservative 23-hour retry window after an ambiguous attempt. No provider is enabled merely by saving a brief.

An atomic D1 claim prevents concurrent retries from sending twice. Cloudflare offers no documented provider idempotency key, so an interrupted/ambiguous send is retained as `uncertain` and is not blindly repeated. Pending sends are retained with `waitUntil`, and their actual eventual result updates D1. `failed` and `uncertain` receipts still state that the brief was saved and email notification is unavailable. Configuration and delivery gaps must be resolved before claiming the team was emailed.

## Public owned-account network

`GET /network/accounts` reads public stored profiles from Cortex `/api/v1` using the existing server-only `SENTIENTDASH_API_KEY`. It accepts no query parameters or writes. The JSON contains `source: "cortex"`, a separate retrieval `fetchedAt`, `stale: false`, and `accounts` with canonical `handle`, public `name`, `relationship: "owned"`, `followerCount`, `followersAsOf`, local `avatar`, and Instagram `profileUrl`. Counts without a valid Cortex profile observation date remain unknown rather than acquiring the retrieval date.

Ownership is restricted to the key's selected accounts. The primary read is the paginated bulk `/api/v1/tracker/accounts` projection, using only `group: "sentient"`, observed `full_name`, `followers`, and `captured_at`. Account profiles and promotional posts share that ownership snapshot. A Tracker-scope `403` uses the separately authorized public `/accounts` and profile area. In that path, when the existing key grants settings reads, the Worker follows `/api/v1/settings/accounts` pagination and includes only active `group_name: "sentient"` records. A settings-scope `403` uses a verified Sentient ownership registry as a filter on the scoped `/accounts` list; the registry supplies no names or follower metrics. Partners, competitors, and caller-supplied handles never enter the public feed.

`GET /network/accounts/{handle}/avatar` serves the current cached public Instagram profile photo only after checking that handle is still in the website key's owned-account selection. The account JSON's `avatar` points to this proxy; `avatarFallback` is an existing matching site asset or `null`. Under the user's authorization to publish these owned-account photos, the proxy reads the fixed Cortex cached-media path `/api/dashboard/avatar/{handle}` without invoking profile previews, scraping, or refresh jobs. It refuses arbitrary paths and queries, validates membership before consulting its five-minute image cache, accepts only bounded JPEG/PNG/WebP/GIF images up to 2 MiB, and never forwards the website credential to a signed R2 storage redirect. A missing photograph is never replaced with another account's identity or a generic agency logo.

Successful ownership and profile snapshots are cached for five minutes, keyed by a hash of the source and credential, with concurrent refreshes coalesced. API credentials, internal registry labels, settings, and broader Cortex data are never returned. These reads do not change upstream accounts or refresh/scrape Instagram.

Migration `0007_network_snapshots.sql` retains the latest successful public account and promotional-post responses in D1. Apply it before deploying this Worker. Saves run through `waitUntil` without delaying a successful Cortex response; a late older save cannot replace newer figures. Both writes and reads validate the public projection. A credential/source fingerprint and HMAC bind each record to the same authorization and detect payload corruption; neither the credential nor that storage metadata is exposed by the API.

During a transient Cortex failure, `GET /network/accounts` and `GET /network/posts` return the last valid saved response with `source: "cortex"`, `stale: true`, `fallback: "last-saved"`, and its confirmed `savedAt`. `fetchedAt`, `followersAsOf`, and `metricsUpdatedAt` retain their original meanings and values; saving a copy never makes a measurement newer. A live response has `stale: false`; `savedAt` is included only when that exact source response was already saved. The website may hide dates while retaining this provenance internally.

Known upstream `401`/`403` rejections invalidate both saved resources for that authorization and remain HTTP `401`/`403`, allowing browser storage to discard prior data. Another credential cannot read the prior credential's copy. Invalid schemas, signatures, or payloads are never used as fallbacks. D1/cache failures do not prevent a working Cortex read. Avatar and campaign-cover routes still check membership against the permitted account/post snapshot before looking at their image cache, including when that snapshot is the saved outage response.

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
