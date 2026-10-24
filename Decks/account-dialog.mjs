// Look up a profile before changing the selected account card.
export function chooseInstagramAccount(lookup) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'deck-version-dialog deck-account-dialog';
    dialog.setAttribute('aria-label', 'Add Instagram account');
    dialog.innerHTML = `<header><h2>Add Instagram account</h2><button type="button" data-cancel aria-label="Cancel">×</button></header><form class="deck-version-copy-form"><label for="deck-custom-account">Instagram username or profile link</label><input id="deck-custom-account" type="text" placeholder="@username or https://www.instagram.com/username/" maxlength="200" required autocomplete="off" autocapitalize="none" spellcheck="false" autofocus><p class="deck-account-feedback" role="status" aria-live="polite"></p><button class="deck-version-primary" type="submit">Use account</button></form><footer><button type="button" data-cancel>Cancel</button></footer>`;
    const input = dialog.querySelector('input');
    const submit = dialog.querySelector('[type="submit"]');
    const feedback = dialog.querySelector('[role="status"]');
    const previous = document.activeElement;
    const lifecycle = new AbortController();
    const { signal } = lifecycle;
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      lifecycle.abort();
      dialog.close();
      dialog.remove();
      previous?.isConnected && previous.focus?.({ preventScroll:true });
      resolve(result);
    };
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); }, { signal });
    dialog.addEventListener('close', () => finish(null), { signal });
    dialog.addEventListener('keydown', event => event.stopPropagation(), { signal });
    dialog.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', () => finish(null), { signal }));
    dialog.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      feedback.textContent = 'Loading followers and profile photo…';
      try {
        const profile = await lookup(input.value.trim());
        if (!settled) finish(profile);
      } catch (error) {
        if (!settled) feedback.textContent = error.message || 'Could not load this profile. Check the username and try again.';
      } finally { submit.disabled = false; }
    }, { signal });
    document.body.append(dialog);
    dialog.showModal();
  });
}
