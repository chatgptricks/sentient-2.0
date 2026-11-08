import { formatFollowers } from '../public/network-data.js';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function accountDisplayHandle(account) {
  return String(account.displayHandle || account.handle).replace(/^@/, '');
}

export function accountRelationship(account) {
  return account.relationship === 'owned' ? 'Sentient owned' : 'Creator partner';
}

export function accountAvatarFallback(account) {
  return account.avatarFallback ? ` data-avatar-fallback="${escapeHtml(account.avatarFallback)}"` : '';
}

export function accountSnapshotDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(value));
}

function networkStatus({ source, accounts }) {
  if (source !== 'cortex') return 'Selected accounts · rounded follower counts.';
  const dates = accounts.map(account => account.followersAsOf).filter(value => value && Number.isFinite(Date.parse(value))).sort();
  const first = accountSnapshotDate(dates[0]);
  const last = accountSnapshotDate(dates.at(-1));
  return first ? `Latest follower snapshots · ${first}${first === last ? '' : ` – ${last}`}.` : 'Follower figures shown when available.';
}

export function renderUniverse(accounts, { source = 'fallback', fetchedAt } = {}) {
  const owned = accounts.filter(account => account.relationship === 'owned').length;
  const partners = accounts.filter(account => account.relationship === 'partner').length;
  const rows = accounts.map(account => {
    const followers = formatFollowers(account);
    return `<button type="button" class="directory-account" data-account="${escapeHtml(account.handle)}"><img src="${escapeHtml(account.avatar)}"${accountAvatarFallback(account)} alt="" width="40" height="40" loading="lazy"><span><strong>@${escapeHtml(accountDisplayHandle(account))}</strong><small>${followers ? `${escapeHtml(followers)} followers` : 'Followers unavailable'} · ${accountRelationship(account)}</small></span><span class="explored-check" aria-label="Explored" hidden>✓</span></button>`;
  }).join('');
  return `<section class="universe-app" data-network-source="${escapeHtml(source)}" aria-label="Interactive Sentient account universe"><div class="universe-canvas" id="universe-canvas" aria-hidden="true"></div><div class="universe-vignette" aria-hidden="true"></div><div class="universe-heading"><h1>OUR UNIVERSE.<br><em>YOUR AUDIENCE.</em></h1><p>${source === 'pending' ? 'Loading current accounts…' : `${accounts.length} accounts. Countless rabbit holes.<br>Pick a world. See where it takes you.`}</p></div><div class="universe-toolbar"><label class="universe-search"><span class="sr-only">Search Instagram accounts</span><span aria-hidden="true">⌕</span><input id="account-search" type="search" placeholder="Find an account…" autocomplete="off"></label><div class="universe-filters" role="group" aria-label="Filter account relationship"><button type="button" data-filter="all" aria-pressed="true">All <span>${accounts.length}</span></button><button type="button" data-filter="owned" aria-pressed="false"${owned ? '' : ' disabled'}>Owned <span>${owned}</span></button><button type="button" data-filter="partner" aria-pressed="false"${partners ? '' : ' disabled'}>Partners <span>${partners}</span></button></div><button class="universe-list-toggle" type="button" aria-expanded="true" aria-controls="universe-directory">Account list</button></div><div class="universe-directory" id="universe-directory"><div class="directory-heading"><span>Accounts</span><span id="directory-count">${accounts.length} accounts</span></div><p class="universe-data-status" data-network-status>${escapeHtml(networkStatus({ source, accounts }))}</p><div class="directory-results">${rows}</div><p class="directory-empty" hidden>No accounts match. Try another name or filter.</p></div><div class="universe-nodes" id="universe-nodes"></div><aside class="account-panel" aria-label="Selected account" hidden><button class="panel-close" type="button" aria-label="Close account details">×</button><div id="account-details"></div><button class="next-account" type="button">Discover another account <span aria-hidden="true">+</span></button></aside><div class="universe-bottom"><div class="exploration-progress"><div><span>EXPLORATION LOG</span><strong id="explored-count" aria-live="polite">0 / ${accounts.length}</strong></div><div class="exploration-bar"><span id="explored-bar"></span></div><p id="explored-caption">Every account is a new perspective.</p></div><div class="flight-controls"><button type="button" id="surprise-account">Surprise me <span aria-hidden="true">✳</span></button><button type="button" id="reset-universe" aria-label="Reset universe camera">Reset view</button><button type="button" id="zoom-in" aria-label="Zoom into universe">+</button><button type="button" id="zoom-out" aria-label="Zoom out of universe">−</button></div><div class="universe-hint"><span class="owned-key">●</span> OWNED <span class="partner-key">●</span> PARTNERS<br><span>Drag to orbit · scroll to travel</span></div></div><p class="universe-warning" role="status" hidden>3D is unavailable in this browser. Every account is available in the list.</p><script type="application/json" id="universe-data">${JSON.stringify(accounts).replace(/</g,'\\u003c')}</script></section>`;
}
