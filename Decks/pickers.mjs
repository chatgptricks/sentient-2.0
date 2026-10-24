// Edit-mode pickers for the accounts and promotional-post slides. Choices are
// stored as ordinary editor fields (`account-N-id`, `post-N-url`,
// `post-N-source`), so they save, load and revert exactly like the deck's text.
// Post data comes from SentientDash through the deck Worker, never from Instagram.
import { universeAccounts } from '../site/src/universe-data.mjs';
import { chooseInstagramAccount } from './account-dialog.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const followers = count => Number(count).toLocaleString('en-US');
const compact = count => new Intl.NumberFormat('en-US', { notation:'compact', maximumFractionDigits:1 }).format(count);
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });
// Saved copy from before may carry the `chatpgtricks` typo of the real
// `chatgptricks` handle; it still resolves to the right account.
const aliases = { chatpgtricks:'chatgptricks' };
const accountId = value => {
  const id = String(value ?? '').trim().replace(/^@/, '').toLowerCase();
  return aliases[id] ?? id;
};

// Sentient-owned accounts with a recorded follower count. The deck's own
// snapshots are newer than the website's, so they take precedence.
export function accountCatalog(slide) {
  const catalog = new Map();
  for (const account of slide?.accounts ?? []) {
    catalog.set(account.id, { id:account.id, handle:account.handle, followers:Number(String(account.followers).replace(/,/g, '')), asOf:slide.followersAsOf, avatar:account.image });
  }
  for (const account of universeAccounts) {
    if (account.relationship !== 'owned' || !account.followerCount || catalog.has(account.handle)) continue;
    catalog.set(account.handle, { id:account.handle, handle:`@${account.handle}`, followers:account.followerCount, asOf:account.followersAsOf, avatar:account.avatar });
  }
  return new Map([...catalog].sort(([, a], [, b]) => b.followers - a.followers));
}

export const accountPicker = (catalog, index) => `<label class="deck-picker deck-account-picker"><span class="deck-picker-cue" aria-hidden="true">Change ▾</span><span>Choose account</span><select data-account-picker="${index}"><option value="__custom__">Add another Instagram account…</option>${[...catalog.values()].map(account => `<option value="${escape(account.id)}">${escape(account.handle)} · ${compact(account.followers)}</option>`).join('')}</select></label>`;

export const accountRefresh = `<div class="deck-picker deck-account-refresh"><button type="button" data-refresh-accounts>↻ Update followers & profile photos</button><output aria-live="polite"></output></div>`;

export const postPicker = index => `<form class="deck-picker deck-post-picker" data-post-picker="${index}" novalidate><label><span>Instagram post link</span><input type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://www.instagram.com/p/…"></label><button type="submit">Show</button><output aria-live="polite"></output></form>`;

// A stored date (YYYY-MM-DD) or timestamp, as its Costa Rica calendar day.
const dayOf = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date(value).toLocaleDateString('en-CA', { timeZone:'America/Costa_Rica' });
const recordedDate = iso => new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'America/Costa_Rica' });
// The caption's first line, without hashtags or mentions, as an editable title.
const titleFrom = caption => {
  const line = String(caption ?? '').split('\n').map(text => text.replace(/[#@][\w.]+/g, '').replace(/\s+/g, ' ').trim()).find(Boolean) ?? '';
  if (line.length <= 56) return line || 'Promotional post';
  return `${line.slice(0, 56).replace(/\s+\S*$/, '')}…`;
};

export function initDeckPickers({ root, deck, asset }) {
  const postsSlide = deck.slides.find(slide => !slide.blocks && slide.layout === 'promos');
  const catalog = accountCatalog();
  const field = (scope, name) => scope?.querySelector(`[data-edit-field="${name}"]`);
  const setText = (scope, name, value) => { const element = field(scope, name); if (element) element.textContent = value; };
  // Let the editor mark the deck as changed and the fitter re-measure.
  const changed = element => element?.dispatchEvent(new Event('input', { bubbles:true }));

  // Classic and Studio decks share the same account controls. Keep their own
  // field paths so existing saves and named versions remain compatible.
  const accountCards = () => [...root.querySelectorAll('.deck-account')];
  const records = new Map();
  accountCards().forEach((card, i) => {
    const handle = card.querySelector('.deck-account-handle');
    const prefix = handle.dataset.editField.replace(/handle$/, '');
    const block = prefix.startsWith('blocks.');
    const names = { handle:`${prefix}handle`, followers:`${prefix}followers`, id:`${prefix}id`, avatar:`${prefix}${block ? 'image' : 'avatar'}`, asof:`${prefix}${block ? 'asOf' : 'asof'}` };
    const original = { id:accountId(handle.textContent), handle:handle.textContent, followers:field(card, names.followers).textContent, avatar:card.querySelector('img').getAttribute('src') };
    for (const [key, value] of Object.entries({ id:original.id, avatar:original.avatar, asof:'' })) {
      let element = field(card, names[key]);
      if (!element) {
        element = document.createElement('span');
        element.dataset.editField = names[key];
        element.hidden = true;
        element.textContent = value;
        card.append(element);
      }
      element.dataset.accountMeta = '';
    }
    original.avatar = field(card, names.avatar).textContent;
    records.set(card, { names, original });
    catalog.set(original.id, { ...original, followers:Number(original.followers.replace(/,/g, '')), asOf:field(card, names.asof).textContent });
    const media = card.querySelector('.deck-account-media');
    if (!card.querySelector('[data-account-picker]')) media.insertAdjacentHTML('beforeend', accountPicker(catalog, i));
    card.querySelector('[data-account-picker]').dataset.accountPicker = String(i);
    const composition = card.closest('.deck-composition');
    if (!composition.querySelector('[data-refresh-accounts]')) composition.insertAdjacentHTML('beforeend', accountRefresh);
  });
  const accountField = (card, key) => field(card, records.get(card).names[key]);
  const accountText = (card, key) => accountField(card, key)?.textContent.trim() ?? '';
  const setAccountText = (card, key, value) => { accountField(card, key).textContent = value ?? ''; };
  const showAccount = card => {
    const { original } = records.get(card);
    const byHandle = catalog.get(accountId(accountText(card, 'handle')));
    if (byHandle && byHandle.id !== accountId(accountText(card, 'id'))) {
      setAccountText(card, 'id', byHandle.id);
      setAccountText(card, 'avatar', byHandle.avatar);
      if (accountText(card, 'followers') === original.followers) {
        setAccountText(card, 'followers', followers(byHandle.followers));
        setAccountText(card, 'asof', byHandle.asOf);
      }
      corrected = true;
    }
    const id = accountId(accountText(card, 'id'));
    const savedAvatar = accountText(card, 'avatar');
    let account = catalog.get(id);
    if (!account && /^[a-z0-9_.]{1,30}$/.test(id) && savedAvatar) {
      account = { id, handle:`@${id}`, avatar:savedAvatar, followers:Number(accountText(card, 'followers').replace(/,/g, '')), asOf:accountText(card, 'asof') };
      catalog.set(id, account);
    }
    if (!account) return;
    const avatar = card.querySelector('.deck-account-avatar');
    // Older saves lack a photo field; resolve their account from the catalogue.
    const photo = savedAvatar && (id === original.id || savedAvatar !== original.avatar) ? savedAvatar : account.avatar;
    avatar.src = asset(photo);
    avatar.alt = accountText(card, 'handle');
    const select = card.querySelector('select');
    if (![...select.options].some(option => option.value === id)) select.add(new Option(`${account.handle} · ${compact(account.followers)}`, id));
    select.value = id;
  };
  const accountsNote = slide => {
    const dates = [...new Set(accountCards().filter(card => card.closest('.deck-slide') === slide).map(card => accountText(card, 'asof')).filter(Boolean).map(dayOf))].sort();
    if (!dates.length) return '';
    if (dates.length === 1) return `Follower counts recorded ${longDate(dates[0])}.`;
    return `Follower counts recorded between ${longDate(dates[0])} and ${longDate(dates.at(-1))}.`;
  };

  const postCards = () => [...root.querySelectorAll('.deck-promo')].filter(card => card.querySelector('[data-post-picker]'));
  let services = {};
  const showPost = (card, i) => {
    const original = postsSlide.posts[i];
    const source = field(card, `post-${i}-source`)?.textContent.trim() || original.source;
    const permalink = field(card, `post-${i}-url`)?.textContent.trim() || original.url;
    const image = card.querySelector('.deck-promo-image');
    card.querySelectorAll('a[href]').forEach(link => { link.href = permalink; });
    if (source === original.source) {
      if (image.dataset.source) { image.src = asset(original.image); delete image.dataset.source; }
      return;
    }
    if (!services.coverBase || image.dataset.source === source) return;
    image.dataset.source = source;
    image.src = `${services.coverBase}/covers/${source}`;
  };
  const usePost = async (card, i, value) => {
    const original = postsSlide.posts[i];
    const output = card.querySelector('output');
    const button = card.querySelector('.deck-post-picker button');
    const fill = values => Object.entries(values).forEach(([name, text]) => setText(card, `post-${i}-${name}`, text));
    if (!value.trim()) {
      fill({ url:original.url, source:original.source, account:original.account, title:original.title, likes:original.likes, comments:original.comments, date:original.date });
      output.textContent = 'Original post restored.';
    } else {
      if (!services.lookup) { output.textContent = 'Post lookup is unavailable right now.'; return; }
      button.disabled = true;
      output.textContent = 'Getting the post from SentientDash…';
      try {
        const post = await services.lookup(value);
        const account = catalog.get(accountId(post.account))?.handle ?? `@${post.account}`;
        fill({
          url:post.permalink, source:`${post.account}/${post.shortcode}`, account, title:titleFrom(post.caption),
          likes:post.likes == null ? '—' : followers(post.likes),
          comments:post.comments == null ? '—' : followers(post.comments),
          date:recordedDate(post.publishedAt),
        });
        const note = root.querySelector('.deck-promos .deck-note');
        if (note && post.metricsUpdatedAt) note.textContent = `Likes and comments from SentientDash, recorded ${recordedDate(post.metricsUpdatedAt)}.`;
        output.textContent = 'Updated from SentientDash. You can still edit the title.';
      } catch (error) {
        output.textContent = error.message || 'SentientDash is unavailable right now. Try again.';
        return;
      } finally {
        button.disabled = false;
      }
    }
    showPost(card, i);
    changed(field(card, `post-${i}-url`));
  };

  let corrected = false;
  const sync = () => {
    corrected = false;
    accountCards().forEach(showAccount);
    if (corrected) updateAccountsNote();
    if (postsSlide) postCards().forEach((card, i) => {
      showPost(card, i);
      const input = card.querySelector('input');
      if (document.activeElement !== input) input.value = field(card, `post-${i}-url`)?.textContent.trim() ?? '';
    });
  };

  const updateAccountsNote = () => {
    for (const slide of root.querySelectorAll('.deck-slide')) {
      const note = slide.querySelector('.deck-note');
      if (note && slide.querySelector('.deck-account')) {
        const value = accountsNote(slide);
        if (value) note.textContent = value;
      }
    }
  };
  const useAccount = (card, i, result) => {
    const account = { id:result.handle, handle:`@${result.handle}`, followers:result.followers, avatar:result.avatar, asOf:result.capturedAt };
    catalog.set(account.id, account);
    setAccountText(card, 'id', account.id);
    setAccountText(card, 'handle', account.handle);
    setAccountText(card, 'avatar', account.avatar);
    setAccountText(card, 'followers', followers(account.followers));
    if (account.asOf) setAccountText(card, 'asof', account.asOf);
    showAccount(card, i);
    updateAccountsNote();
    changed(accountField(card, 'id'));
  };
  // Refresh both profile values together, including accounts outside the catalogue.
  let pendingAccounts = 0;
  const refreshAccount = async (card, i) => {
    const requested = accountId(accountField(card, 'handle').textContent);
    root.dispatchEvent(new CustomEvent('deck-account-busy', { detail:++pendingAccounts > 0 }));
    try {
      const result = await services.lookupAccount(requested);
      if (accountId(accountField(card, 'handle').textContent) !== requested) return;
      useAccount(card, i, result);
    } finally {
      root.dispatchEvent(new CustomEvent('deck-account-busy', { detail:--pendingAccounts > 0 }));
    }
  };
  const accountStatus = (text, scope = root) => {
    scope.querySelectorAll('.deck-account-refresh output').forEach(output => { output.textContent = text; });
  };

  // Every shown count is replaced by SentientDash's latest exact reading.
  const refreshAccounts = async (scope = root) => {
    const button = scope.querySelector('[data-refresh-accounts]');
    if (!button || !services.lookupAccount || button.disabled) return;
    button.disabled = true;
    accountStatus('Updating followers and profile photos…');
    const failures = [];
    for (const card of accountCards().filter(card => scope.contains(card))) {
      try { await refreshAccount(card); }
      catch (error) { failures.push(error.message); }
    }
    updateAccountsNote();
    accountStatus(failures.length ? failures.join(' ') : 'Followers and profile photos updated. Press Done to save them.');
    button.disabled = false;
  };
  root.addEventListener('click', event => {
    if (event.target.closest('[data-refresh-accounts]')) void refreshAccounts(event.target.closest('.deck-slide'));
  });

  root.addEventListener('change', async event => {
    const select = event.target.closest('[data-account-picker]');
    if (!select) return;
    const i = Number(select.dataset.accountPicker);
    const card = accountCards()[i];
    if (select.value === '__custom__' && card) {
      if (!services.lookupAccount) { showAccount(card, i); return; }
      const profile = await chooseInstagramAccount(value => services.lookupAccount(value));
      if (profile) useAccount(card, i, profile);
      else showAccount(card, i);
      return;
    }
    const account = catalog.get(select.value);
    if (!card || !account) return;
    setAccountText(card, 'id', account.id);
    setAccountText(card, 'avatar', account.avatar);
    setAccountText(card, 'handle', account.handle);
    setAccountText(card, 'followers', followers(account.followers));
    setAccountText(card, 'asof', account.asOf);
    showAccount(card, i);
    updateAccountsNote();
    changed(accountField(card, 'id'));
    if (!services.lookupAccount) return;
    accountStatus(`Updating ${account.handle}…`);
    try {
      await refreshAccount(card, i);
      updateAccountsNote();
      accountStatus(`${account.handle}: followers and profile photo updated.`);
    } catch (error) {
      accountStatus(error.message);
    }
  });
  root.addEventListener('submit', event => {
    const form = event.target.closest('[data-post-picker]');
    if (!form) return;
    event.preventDefault();
    const i = Number(form.dataset.postPicker);
    void usePost(postCards()[i], i, form.querySelector('input').value);
  });

  sync();
  return { catalog, sync, refreshAccounts, connect(value) { services = value; sync(); } };
}
