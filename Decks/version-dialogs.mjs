const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);

function choose(markup, setup) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'deck-version-dialog';
    dialog.setAttribute('aria-label', 'Deck versions');
    dialog.innerHTML = markup;
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
    setup(dialog, finish, signal);
    document.body.append(dialog);
    dialog.showModal();
  });
}

export const chooseSaveTarget = ({ currentName = 'Original', copyName = '' } = {}) => choose(`
  <header><h2>Save changes</h2><button type="button" data-cancel aria-label="Cancel">×</button></header>
  <form class="deck-version-copy-form">
    <label for="deck-copy-name">New copy name</label>
    <input id="deck-copy-name" name="name" maxlength="80" required autocomplete="off" placeholder="e.g. Acme launch proposal" value="${escape(copyName)}">
    <button class="deck-version-primary" type="submit">Save as a copy</button>
  </form>
  <button class="deck-version-save-current" type="button">Save changes to ${escape(currentName)}</button>
  <footer><button type="button" data-cancel>Cancel</button></footer>`, (dialog, finish, signal) => {
    const input = dialog.querySelector('input');
    input.addEventListener('input', () => input.setCustomValidity(''), { signal });
    dialog.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name || name.toLowerCase() === 'original') {
        input.setCustomValidity(name ? 'Choose a name other than Original.' : 'Give this copy a name.');
        input.reportValidity();
        return;
      }
      finish({ mode:'copy', name, id:crypto.randomUUID() });
    }, { signal });
    dialog.querySelector('.deck-version-save-current').addEventListener('click', () => finish({ mode:'current' }), { signal });
  });

export const chooseTextVersion = (versions, currentId) => choose(`
  <header><h2>Other versions</h2><button type="button" data-cancel aria-label="Close versions">×</button></header>
  <div class="deck-version-list">
    <button type="button" data-version="" ${!currentId ? 'aria-current="true"' : ''}><strong>Original</strong><span>${!currentId ? 'Current' : 'Open original'}</span></button>
    ${versions.map(version => `<button type="button" data-version="${escape(version.id)}" ${version.id === currentId ? 'aria-current="true"' : ''}><strong>${escape(version.name)}</strong><span>${version.id === currentId ? 'Current' : 'Open version'}</span></button>`).join('')}
  </div>
  <footer><button type="button" data-cancel>Close</button></footer>`, (dialog, finish, signal) => {
    dialog.querySelectorAll('[data-version]').forEach(button => button.addEventListener('click', () => finish({ id:button.dataset.version }), { signal }));
  });
