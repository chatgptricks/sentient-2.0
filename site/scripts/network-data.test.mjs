import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackAccounts } from '../src/network-fallback.mjs';
import { fallbackCampaignPosts } from '../src/network-post-fallback.mjs';
import { stat } from 'node:fs/promises';
import { formatFollowers, validateAccounts, validatePosts, selectCampaignPosts, loadNetworkAccounts } from '../public/network-data.js';

const liveAccount = { handle: 'chatgptricks', name: 'ChatGPTricks', relationship: 'owned', followerCount: 3000123, followersAsOf: '2026-11-07T12:00:00Z', avatar: '/assets/universe/avatar-chatgptricks.jpg', profileUrl: 'https://www.instagram.com/chatgptricks/' };
const campaign = (handle, shortcode) => ({ handle, shortcode, source: `https://www.instagram.com/p/${shortcode}/`, image: `/network/posts/${handle}/${shortcode}/cover`, caption: 'Campaign', likes: 2500 });

test('reference fallback preserves all ten supplied rounded labels and canonical account identities', () => {
  assert.deepEqual(fallbackAccounts.map(account => [account.displayHandle || account.handle, formatFollowers(account)]), [
    ['mindset.therapy', '11.5M'], ['chatgptricks', '3M'], ['artificialintelligence', '1.5M'], ['passionateincome', '1.2M'], ['stoicreflections', '1.2M'], ['evolving', '1M'], ['chatgptips', '750K'], ['planet.ai', '500K'], ['trends', '250K'], ['ainterestingupdate', '200K'],
  ]);
  assert.equal(fallbackAccounts[2].profileUrl, 'https://www.instagram.com/artificialntellligence/');
  assert.equal(fallbackAccounts[7].profileUrl, 'https://www.instagram.com/planet.ai_/');
  assert.ok(fallbackAccounts.every(account => account.followersAsOf === null));
  assert.equal(formatFollowers({ followerCount: null }), '');
});

test('random campaign slots contain unique posts from unique accounts on every draw', () => {
  const pool = Array.from({ length: 20 }, (_, index) => campaign(`account${index % 7}`, `post${index}`));
  let state = 12345;
  const random = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646;
  const draws = new Set();
  for (let index = 0; index < 40; index++) {
    const selected = selectCampaignPosts(pool, 5, random);
    assert.equal(selected.length, 5);
    assert.equal(new Set(selected.map(post => post.handle)).size, 5);
    assert.equal(new Set(selected.map(post => post.shortcode)).size, 5);
    draws.add(selected.map(post => post.shortcode).join(','));
  }
  assert.ok(draws.size > 1, 'Reload draws must vary');
  const limited = selectCampaignPosts([campaign('one', 'a'), campaign('one', 'b'), campaign('two', 'c')]);
  assert.equal(limited.length, 2, 'Never repeat an account to fabricate variety');
});

test('the offline campaign pool contains twenty real covered posts with enough account variety', async () => {
  assert.equal(fallbackCampaignPosts.length, 20);
  assert.equal(new Set(fallbackCampaignPosts.map(post => post.shortcode)).size, 20);
  assert.ok(new Set(fallbackCampaignPosts.map(post => post.handle)).size >= 5);
  for (const post of fallbackCampaignPosts) {
    assert.equal(post.source, `https://www.instagram.com/p/${post.shortcode}/`);
    assert.ok(Number.isSafeInteger(post.likes) && post.likes >= 0);
    assert.ok(Number.isFinite(Date.parse(post.metricsUpdatedAt)));
    const file = new URL(`../public${post.image}`, import.meta.url);
    assert.ok((await stat(file)).size > 0);
  }
  assert.equal(selectCampaignPosts(fallbackCampaignPosts).length, 5);
});

test('public responses reject invalid measurements, duplicate accounts, and unsafe post links', () => {
  assert.ok(validateAccounts({ source: 'cortex', accounts: [liveAccount] }));
  assert.ok(validateAccounts({ source: 'cortex', accounts: [{ ...liveAccount, followerCount: null, followersAsOf: null }] }));
  assert.equal(validateAccounts({ source: 'cortex', accounts: [liveAccount, liveAccount] }), false);
  assert.equal(validateAccounts({ source: 'cortex', accounts: [{ ...liveAccount, relationship: 'competitor' }] }), false);
  assert.equal(validateAccounts({ source: 'cortex', accounts: [{ ...liveAccount, followerCount: -1 }] }), false);
  assert.ok(validatePosts({ source: 'cortex', posts: [campaign('one', 'first')] }));
  assert.equal(validatePosts({ source: 'cortex', posts: [{ ...campaign('one', 'first'), source: 'javascript:alert(1)' }] }), false);
});

test('Cortex avatars respect the Pages base path and an outage returns the complete reference list', async () => {
  const oldFetch = globalThis.fetch;
  const oldDocument = globalThis.document;
  globalThis.document = { querySelector: () => ({ href: 'https://chatgptricks.github.io/sentient-2.0/comments-config.json' }) };
  globalThis.fetch = async url => String(url).endsWith('comments-config.json')
    ? Response.json({ apiUrl: 'https://network.example' })
    : Response.json({ source: 'cortex', accounts: [liveAccount] });
  try {
    const live = await loadNetworkAccounts(fallbackAccounts);
    assert.equal(live.source, 'cortex');
    assert.equal(live.accounts[0].avatar, 'https://chatgptricks.github.io/sentient-2.0/assets/universe/avatar-chatgptricks.jpg');
    globalThis.fetch = async () => { throw new Error('Cortex unavailable'); };
    const offline = await loadNetworkAccounts(fallbackAccounts);
    assert.equal(offline.source, 'fallback');
    assert.deepEqual(offline.accounts, fallbackAccounts);
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.document = oldDocument;
  }
});
