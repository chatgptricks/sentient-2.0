import { loadNetworkAccounts, loadNetworkPosts, selectCampaignPosts, installAvatarFallbacks } from '../public/network-data.js';
import { renderAccountCards, renderCampaignCards } from './network-markup.mjs';

// Owned pages render into the auto-scrolling strip, twice so the loop stays seamless.
const ownedStrip = accounts => {
  const items = accounts.filter(account => !account.relationship || account.relationship === 'owned').map(account => `<li>${renderAccountCards([account])}</li>`).join('');
  return items + items.replace(/<li>/g, '<li aria-hidden="true">');
};

const section = document.getElementById('owned-media');
const fallbackData = document.getElementById('network-fallback-data');
if (section && fallbackData) {
  installAvatarFallbacks();
  const fallback = JSON.parse(fallbackData.textContent);
  const showAccounts = result => {
    section.dataset.networkSource = result.source;
    section.dataset.networkStale = String(Boolean(result.stale));
    section.querySelector('.v2-owned-accounts').innerHTML = ownedStrip(result.accounts);
    window.dispatchEvent(new Event('resize'));
    section.querySelector('.v2-snapshot').textContent = result.stale || result.source === 'fallback'
      ? 'All our own pages · latest saved follower figures.'
      : 'All our own pages · latest available follower figures.';
  };
  const accounts = async () => showAccounts(await loadNetworkAccounts(fallback, { onSaved:showAccounts }));
  const campaigns = async () => {
    const wall = document.getElementById('campaign-wall');
    if (!wall) return;
    const fallback = JSON.parse(document.getElementById('campaign-fallback-data').textContent);
    const byCode = new Map(fallback.map(post => [post.shortcode, post]));
    const seed = Math.floor(Math.random() * 2147483646) + 1;
    const draw = posts => {
      let state = seed;
      return selectCampaignPosts(posts, 5, () => ((state = state * 16807 % 2147483647) - 1) / 2147483646);
    };
    const show = ({ posts, source, endpoint = '', stale = false }) => {
      const selected = draw(posts).map(post => ({ ...post, imageFallback: byCode.get(post.shortcode)?.image }));
      wall.querySelector('.v2-post-grid').innerHTML = renderCampaignCards(selected, endpoint);
      wall.dataset.networkSource = source;
      wall.dataset.networkStale = String(stale);
    };
    // The same per-load draw is retained when the live pool matches the local
    // snapshot, avoiding an extra visual rotation during initial hydration.
    show({ posts:fallback, source:'fallback' });
    show(await loadNetworkPosts(fallback, { onSaved:show }));
  };
  await Promise.allSettled([accounts(), campaigns()]);
}
