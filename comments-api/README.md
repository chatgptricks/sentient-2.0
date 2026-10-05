# Proposal comments

GitHub Pages serves the site. A dedicated Cloudflare Worker and D1 database store public feedback for all five proposal pages. Names are self-reported; no sign-in is required. Notes are displayed as text, never interpreted as HTML. Posts have bounded inputs and a per-IP rate limit. Only configured site origins can submit through the browser. The API supports reads and creates, with no public update/delete access.

The browser refreshes the current page's comments every 15 seconds while visible. Anchors store a content selector, text excerpt, and relative coordinates; a page-position fallback keeps older notes accessible if markup changes. The Notes list includes notes whose desktop target is hidden on mobile.

## Local development

Run `npm ci` here, then `npx wrangler d1 migrations apply sentient-proposal-comments --local` and `npm run dev`. Run the site with `npm run dev` in `../site`. Localhost uses the local Worker/database to keep test notes out of the public proposal.

## Deploy

Run `npm test`, `npx wrangler d1 migrations apply sentient-proposal-comments --remote`, and `npm run deploy` here. Cloudflare OAuth credentials stay in Wrangler's user configuration, outside this repository. The public API URL is in `../site/public/comments-config.json`; `COMMENTS_API_URL` can override it at build time. Push the site to `main` for GitHub Pages deployment.

D1 is the persistent source of truth. Site rebuilds and Worker deployments do not recreate or clear its rows. Cloudflare administrators can review/export notes with `npx wrangler d1 execute sentient-proposal-comments --remote --command "SELECT * FROM comments"`. Take a database export before any manual cleanup.
