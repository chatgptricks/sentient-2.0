// A public/CNAME file means the site is served from that domain's root
// (sentientagency.io since 2026-11-17). It overrides the /sentient-2.0 GitHub
// Pages path the workflow passes. Import this before anything reads process.env.
import { readFileSync } from 'node:fs';
let domain = '';
try { domain = readFileSync(new URL('../public/CNAME', import.meta.url), 'utf8').trim(); } catch {}
if (domain) Object.assign(process.env, { BASE_PATH: '', PUBLIC_BASE_PATH: '', PUBLIC_ORIGIN: `https://${domain}`, PUBLIC_INDEXING: '1' });
export const customDomain = domain;
