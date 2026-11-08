import { loadNetworkAccounts, fetchNetworkData, validatePosts, selectCampaignPosts, installAvatarFallbacks } from '../public/network-data.js';
import { renderAccountCards, renderCampaignCards } from './network-markup.mjs';

const section = document.getElementById('owned-media');
const fallbackData = document.getElementById('network-fallback-data');
if (section && fallbackData) {
  installAvatarFallbacks();
  const fallback = JSON.parse(fallbackData.textContent);
  const accounts = async () => {
    const result = await loadNetworkAccounts(fallback);
    section.dataset.networkSource = result.source;
    if (result.source !== 'cortex') return;
    const selected = result.accounts.slice(0, 10);
    section.querySelector('.v2-owned-accounts').innerHTML = renderAccountCards(selected);
    section.querySelector('.v2-snapshot').textContent = 'Selected owned accounts · latest available follower figures.';
  };
  const campaigns = async () => {
    const wall = document.getElementById('campaign-wall');
    const fallback = JSON.parse(document.getElementById('campaign-fallback-data').textContent);
    const byCode = new Map(fallback.map(post => [post.shortcode, post]));
    const seed = Math.floor(Math.random() * 2147483646) + 1;
    const draw = posts => {
      let state = seed;
      return selectCampaignPosts(posts, 5, () => ((state = state * 16807 % 2147483647) - 1) / 2147483646);
    };
    const show = (posts, source, endpoint = '') => {
      const selected = draw(posts).map(post => ({ ...post, imageFallback: byCode.get(post.shortcode)?.image }));
      wall.querySelector('.v2-post-grid').innerHTML = renderCampaignCards(selected, endpoint);
      wall.dataset.networkSource = source;
    };
    // The same per-load draw is retained when the live pool matches the local
    // snapshot, avoiding an extra visual rotation during initial hydration.
    show(fallback, 'fallback');
    try {
      const result = await fetchNetworkData('posts');
      if (!validatePosts(result)) throw new Error('Invalid campaign pool');
      show(result.posts, 'cortex', result.endpoint);
    } catch { /* Keep the local campaign examples available during outages. */ }
  };
  await Promise.allSettled([accounts(), campaigns()]);
}
