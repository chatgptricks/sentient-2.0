import { loadNetworkAccounts, fetchNetworkData, validatePosts, selectCampaignPosts, formatAudience, installAvatarFallbacks } from '../public/network-data.js';
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
    const known = result.accounts.filter(account => Number.isSafeInteger(account.followerCount));
    const total = known.reduce((sum, account) => sum + account.followerCount, 0);
    if (total > 0) document.querySelectorAll('[data-network-total]').forEach(element => { element.textContent = formatAudience(total); });
  };
  const campaigns = async () => {
    try {
      const result = await fetchNetworkData('posts');
      if (!validatePosts(result)) throw new Error('Invalid campaign pool');
      const selected = selectCampaignPosts(result.posts);
      if (!selected.length) return;
      const wall = document.getElementById('campaign-wall');
      wall.querySelector('.v2-post-grid').innerHTML = renderCampaignCards(selected, result.endpoint);
      wall.dataset.networkSource = 'cortex';
    } catch { /* Keep the local campaign examples available during outages. */ }
  };
  await Promise.allSettled([accounts(), campaigns()]);
}
