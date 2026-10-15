// Edit-mode pickers for the accounts and promotional-post slides. Choices are
// stored as ordinary editor fields (`account-N-id`, `post-N-url`,
// `post-N-source`), so they save, load and revert exactly like the deck's text.
// Post data comes from SentientDash through the deck Worker, never from Instagram.
import { universeAccounts } from '../site/src/universe-data.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const followers = count => Number(count).toLocaleString('en-US');
const compact = count => new Intl.NumberFormat('en-US', { notation:'compact', maximumFractionDigits:1 }).format(count);
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' });
// Visible labels may differ from the source identity (for example the requested
// `@chatpgtricks` label), so every lookup resolves through the source ID.
const aliases = { chatpgtricks:'chatgptricks' };
const accountId = value => {
  const id = String(value ?? '').trim().replace(/^@/, '').toLowerCase();
  return aliases[id] ?? id;
};

// Sentient-owned accounts with a recorded follower count. The deck's own
// snapshots are newer than the website's, so they take precedence.
export function accountCatalog(slide) {
  const catalog = new Map();
  for (const account of slide.accounts) {
    catalog.set(account.id, { id:account.id, handle:account.handle, followers:Number(String(account.followers).replace(/,/g, '')), asOf:slide.followersAsOf, avatar:account.image });
  }
  for (const account of universeAccounts) {
    if (account.relationship !== 'owned' || !account.followerCount || catalog.has(account.handle)) continue;
    catalog.set(account.handle, { id:account.handle, handle:`@${account.handle}`, followers:account.followerCount, asOf:account.followersAsOf, avatar:account.avatar });
  }
  return new Map([...catalog].sort(([, a], [, b]) => b.followers - a.followers));
}

export const accountPicker = (catalog, index) => `<label class="deck-picker deck-account-picker"><span class="deck-picker-cue" aria-hidden="true">Change ▾</span><span>Choose account</span><select data-account-picker="${index}">${[...catalog.values()].map(account => `<option value="${escape(account.id)}">${escape(account.handle)} · ${compact(account.followers)}</option>`).join('')}</select></label>`;

export const postPicker = index => `<form class="deck-picker deck-post-picker" data-post-picker="${index}" novalidate><label><span>Instagram post link</span><input type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://www.instagram.com/p/…"></label><button type="submit">Show</button><output aria-live="polite"></output></form>`;

const recordedDate = iso => new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'America/Costa_Rica' });
// The caption's first line, without hashtags or mentions, as an editable title.
const titleFrom = caption => {
  const line = String(caption ?? '').split('\n').map(text => text.replace(/[#@][\w.]+/g, '').replace(/\s+/g, ' ').trim()).find(Boolean) ?? '';
  if (line.length <= 56) return line || 'Promotional post';
  return `${line.slice(0, 56).replace(/\s+\S*$/, '')}…`;
};

export function initDeckPickers({ root, deck, asset }) {
  const accountsSlide = deck.slides.find(slide => slide.layout === 'accounts');
  const postsSlide = deck.slides.find(slide => slide.layout === 'promos');
  const catalog = accountsSlide ? accountCatalog(accountsSlide) : new Map();
  const field = (scope, name) => scope?.querySelector(`[data-edit-field="${name}"]`);
  const setText = (scope, name, value) => { const element = field(scope, name); if (element) element.textContent = value; };
  // Let the editor mark the deck as changed and the fitter re-measure.
  const changed = element => element?.dispatchEvent(new Event('input', { bubbles:true }));

  const accountCards = () => [...root.querySelectorAll('.deck-account')];
  const selectedAccounts = () => accountCards().map((card, i) => catalog.get(accountId(field(card, `account-${i}-id`)?.textContent))).filter(Boolean);
  // A handle typed by hand (before the dropdown existed) still selects its account.
  const showAccount = (card, i) => {
    const byHandle = catalog.get(accountId(field(card, `account-${i}-handle`)?.textContent));
    const original = accountsSlide.accounts[i];
    if (byHandle && byHandle.id !== accountId(field(card, `account-${i}-id`)?.textContent)) {
      setText(card, `account-${i}-id`, byHandle.id);
      if (field(card, `account-${i}-followers`)?.textContent === original.followers) setText(card, `account-${i}-followers`, followers(byHandle.followers));
      corrected = true;
    }
    const account = catalog.get(accountId(field(card, `account-${i}-id`)?.textContent));
    if (!account) return;
    const avatar = card.querySelector('.deck-account-avatar');
    avatar.src = asset(account.avatar);
    avatar.alt = account.handle;
    card.querySelector('select').value = account.id;
  };
  // A single date when every count comes from the same snapshot, otherwise the range.
  const accountsNote = () => {
    const dates = [...new Set(selectedAccounts().map(account => account.asOf))].sort();
    if (!dates.length) return '';
    if (dates.length === 1) return `Follower counts recorded ${longDate(dates[0])}.`;
    return `Follower counts recorded between ${longDate(dates[0])} and ${longDate(dates.at(-1))}.`;
  };

  const postCards = () => [...root.querySelectorAll('.deck-promo')];
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
    const note = root.querySelector('.deck-accounts .deck-note');
    if (corrected && note) note.textContent = accountsNote();
    if (postsSlide) postCards().forEach((card, i) => {
      showPost(card, i);
      const input = card.querySelector('input');
      if (document.activeElement !== input) input.value = field(card, `post-${i}-url`)?.textContent.trim() ?? '';
    });
  };

  root.addEventListener('change', event => {
    const select = event.target.closest('[data-account-picker]');
    if (!select) return;
    const i = Number(select.dataset.accountPicker);
    const card = accountCards()[i];
    const account = catalog.get(select.value);
    if (!card || !account) return;
    setText(card, `account-${i}-id`, account.id);
    setText(card, `account-${i}-handle`, account.handle);
    setText(card, `account-${i}-followers`, followers(account.followers));
    showAccount(card, i);
    const note = root.querySelector('.deck-accounts .deck-note');
    if (note) note.textContent = accountsNote();
    changed(field(card, `account-${i}-id`));
  });
  root.addEventListener('submit', event => {
    const form = event.target.closest('[data-post-picker]');
    if (!form) return;
    event.preventDefault();
    const i = Number(form.dataset.postPicker);
    void usePost(postCards()[i], i, form.querySelector('input').value);
  });

  sync();
  return { catalog, sync, connect(value) { services = value; sync(); } };
}
