import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from './worker.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// The site's forms and live figures call this API from the custom domain. If the
// domain changes without this list, browsers block every inquiry.
test('the deployed site domain may call the API', async () => {
  const domain = read('../site/public/CNAME').trim();
  const ALLOWED_ORIGINS = read('./wrangler.jsonc').match(/"ALLOWED_ORIGINS":\s*"([^"]+)"/)[1];
  for (const origin of [`https://${domain}`, `https://www.${domain}`]) {
    const response = await worker.fetch(new Request('https://api.example/inquiries', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } }), { ALLOWED_ORIGINS });
    assert.equal(response.status, 204, origin);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  }
});
