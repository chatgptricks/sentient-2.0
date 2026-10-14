import './editor.css';

const MAX_FIELD_LENGTH = 1000;
const safeFieldKey = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,159}$/;
const cleanText = value => String(value ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');

export function textOf(element) {
  // Read DOM text so CSS casing and the current slide's visibility never become edits.
  // Browsers create DIV/P/BR nodes for Enter in plaintext-only contenteditable.
  const read = node => {
    if (node.nodeType === 3) return node.nodeValue ?? '';
    if (node.nodeName === 'BR') return '\n';
    let result = '';
    const children = [...node.childNodes];
    children.forEach((child, index) => {
      const block = child.nodeName === 'DIV' || child.nodeName === 'P';
      if (block && result && !result.endsWith('\n')) result += '\n';
      result += read(child);
      if (block && index < children.length - 1 && !result.endsWith('\n')) result += '\n';
    });
    return result;
  };
  return cleanText(read(element)).replace(/\n$/, '');
}

function validFields(value) {
  const fields = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fields;
  for (const [key, text] of Object.entries(value)) {
    if (safeFieldKey.test(key) && typeof text === 'string' && text.length <= MAX_FIELD_LENGTH) fields[key] = cleanText(text);
  }
  return fields;
}

function sameFields(a, b) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && a[key] === b[key]);
}

export function initDeckEditor({ root, deck, apiUrl, onFieldsApplied }) {
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const brand = root.querySelector('.deck-brand');
  const endpoint = apiUrl ? `${String(apiUrl).replace(/\/+$/, '')}/decks/${encodeURIComponent(deck.slug)}` : '';
  const fields = [...root.querySelectorAll('[data-edit-field]')].map(element => {
    const slideId = element.closest('[data-slide-id]')?.dataset.slideId;
    const key = `${slideId}.${element.dataset.editField}`;
    return { element, key, original: textOf(element) };
  }).filter(field => safeFieldKey.test(field.key) && !field.key.startsWith('undefined.'));
  const dialog = document.createElement('dialog');
  dialog.className = 'deck-access-dialog';
  dialog.setAttribute('aria-labelledby', 'deck-access-label');
  dialog.innerHTML = `<form class="deck-access-form"><button class="deck-access-close" type="button" aria-label="Close">×</button><label id="deck-access-label" for="deck-access-password">Password</label><input id="deck-access-password" type="password" autocomplete="current-password" required aria-describedby="deck-access-feedback"><p id="deck-access-feedback" class="deck-access-feedback" role="status" aria-live="polite"></p><button class="deck-access-continue" type="submit">Continue <span aria-hidden="true">↗</span></button></form>`;
  const toolbar = document.createElement('div');
  toolbar.className = 'deck-edit-toolbar';
  toolbar.hidden = true;
  toolbar.innerHTML = '<p class="deck-edit-feedback" role="status" aria-live="polite"></p><button class="deck-edit-done" type="button">Done <span aria-hidden="true">✓</span></button>';
  root.append(dialog, toolbar);
  const passwordInput = dialog.querySelector('input');
  const accessFeedback = dialog.querySelector('.deck-access-feedback');
  const continueButton = dialog.querySelector('.deck-access-continue');
  const doneButton = toolbar.querySelector('button');
  const editFeedback = toolbar.querySelector('.deck-edit-feedback');
  let credential = '';
  let revision = 0;
  let serverFields = Object.create(null);
  let savedSnapshot = '';
  let editing = false;
  let saving = false;
  let loadingError = false;
  let lastFocused;
  let accessGeneration = 0;

  const snapshot = () => JSON.stringify(fields.map(({ key, element }) => [key, textOf(element)]));
  const dirty = () => editing && snapshot() !== savedSnapshot;
  const notifyApplied = () => onFieldsApplied?.({ ...serverFields });
  const apply = values => {
    for (const { key, element } of fields) {
      if (Object.hasOwn(values, key)) element.textContent = values[key];
    }
    notifyApplied();
  };
  const request = async (url, options = {}) => {
    if (!endpoint || signal.aborted) throw new Error('unavailable');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = window.setTimeout(abort, 15000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store', credentials: 'omit' });
      let payload;
      try { payload = await response.json(); } catch { payload = null; }
      return { response, payload };
    } finally {
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  };
  const load = async () => {
    const { response, payload } = await request(endpoint);
    if (!response.ok || !payload || !Number.isSafeInteger(payload.revision) || payload.revision < 0) throw new Error('unavailable');
    revision = payload.revision;
    serverFields = validFields(payload.fields);
    apply(serverFields);
    loadingError = false;
  };
  // Public viewing is immediately available even if the storage service is offline.
  const ready = load().catch(() => { loadingError = true; });

  const closeAccess = () => {
    accessGeneration++;
    if (dialog.open) dialog.close();
    passwordInput.value = '';
    accessFeedback.textContent = '';
    continueButton.disabled = false;
    continueButton.removeAttribute('aria-busy');
    lastFocused?.focus?.({ preventScroll: true });
  };
  const openAccess = event => {
    event.preventDefault();
    event.stopPropagation();
    if (editing || dialog.open) return;
    accessGeneration++;
    lastFocused = document.activeElement;
    passwordInput.value = '';
    accessFeedback.textContent = '';
    dialog.showModal();
    passwordInput.focus({ preventScroll: true });
  };
  const enter = () => {
    editing = true;
    root.classList.add('deck-editing');
    for (const { element } of fields) {
      element.setAttribute('contenteditable', 'plaintext-only');
      element.setAttribute('spellcheck', 'true');
    }
    savedSnapshot = snapshot();
    editFeedback.textContent = '';
    toolbar.hidden = false;
    closeAccess();
  };
  const leave = () => {
    editing = false;
    credential = '';
    for (const { element } of fields) {
      const value = textOf(element);
      element.textContent = value;
      element.removeAttribute('contenteditable');
      element.removeAttribute('spellcheck');
    }
    root.classList.remove('deck-editing');
    toolbar.hidden = true;
    editFeedback.textContent = '';
    brand?.focus?.({ preventScroll: true });
  };
  const save = async () => {
    if (!editing || saving) return;
    if (!dirty()) { leave(); return; }
    const values = { ...serverFields };
    for (const { key, element, original } of fields) {
      const value = textOf(element);
      if (value.length > MAX_FIELD_LENGTH) {
        editFeedback.textContent = 'This text is too long. Shorten it and try again.';
        element.focus({ preventScroll: false });
        return;
      }
      if (value === original) delete values[key];
      else values[key] = value;
    }
    saving = true;
    doneButton.disabled = true;
    doneButton.setAttribute('aria-busy', 'true');
    doneButton.textContent = 'Saving…';
    editFeedback.textContent = '';
    // Freeze the text while the shared snapshot is being written.
    fields.forEach(({ element }) => element.setAttribute('contenteditable', 'false'));
    try {
      const { response, payload } = await request(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
        body: JSON.stringify({ fields: values, revision })
      });
      // A retry can encounter its own completed write if the first response was lost.
      const recoveredWrite = response.status === 409 && Number.isSafeInteger(payload?.revision) && sameFields(validFields(payload?.fields), values);
      if (response.status === 409 && !recoveredWrite) {
        editFeedback.textContent = 'The deck changed in another session. Your edits are still here; reload after copying them to continue.';
        return;
      }
      if (response.status === 401 || response.status === 403) {
        credential = '';
        editFeedback.textContent = 'Enter your password to save. Your edits are still here.';
        accessGeneration++;
        lastFocused = doneButton;
        passwordInput.value = '';
        accessFeedback.textContent = '';
        dialog.showModal();
        passwordInput.focus({ preventScroll: true });
        return;
      }
      if ((!response.ok && !recoveredWrite) || !payload || !Number.isSafeInteger(payload.revision)) throw new Error('unavailable');
      revision = payload.revision;
      serverFields = validFields(payload.fields ?? values);
      apply(serverFields);
      savedSnapshot = snapshot();
      leave();
    } catch {
      editFeedback.textContent = 'Could not save. Your edits are still here. Try again.';
    } finally {
      saving = false;
      doneButton.disabled = false;
      doneButton.removeAttribute('aria-busy');
      doneButton.innerHTML = 'Done <span aria-hidden="true">✓</span>';
      if (editing) fields.forEach(({ element }) => element.setAttribute('contenteditable', 'plaintext-only'));
    }
  };

  brand?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); }, { signal });
  brand?.addEventListener('dblclick', openAccess, { signal });
  dialog.querySelector('.deck-access-close').addEventListener('click', closeAccess, { signal });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeAccess(); }, { signal });
  dialog.addEventListener('click', event => { if (event.target === dialog) closeAccess(); }, { signal });
  dialog.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    if (continueButton.disabled || !passwordInput.value) return;
    const password = passwordInput.value;
    const attempt = accessGeneration;
    const activeAttempt = () => attempt === accessGeneration && dialog.open && !signal.aborted;
    continueButton.disabled = true;
    continueButton.setAttribute('aria-busy', 'true');
    accessFeedback.textContent = '';
    try {
      const { response, payload } = await request(`${endpoint}/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
      });
      if (!activeAttempt()) return;
      if (response.status === 401 || response.status === 403) {
        accessFeedback.textContent = 'Incorrect password.';
        passwordInput.select();
        return;
      }
      if (!response.ok || payload?.ok !== true) throw new Error('unavailable');
      await ready;
      if (!activeAttempt()) return;
      if (loadingError) await load();
      if (!activeAttempt()) return;
      credential = password;
      if (editing) {
        closeAccess();
        void save();
      } else enter();
    } catch {
      if (activeAttempt()) accessFeedback.textContent = 'Unavailable right now. Please try again.';
    } finally {
      if (attempt === accessGeneration) {
        continueButton.disabled = false;
        continueButton.removeAttribute('aria-busy');
      }
    }
  }, { signal });
  doneButton.addEventListener('click', () => void save(), { signal });
  root.addEventListener('input', event => {
    if (!editing || !event.target.closest('[data-edit-field]')) return;
    editFeedback.textContent = '';
    onFieldsApplied?.(Object.fromEntries(fields.map(({ key, element }) => [key, textOf(element)])));
  }, { signal });
  root.addEventListener('click', event => {
    if (editing && event.target.closest('[data-edit-field]')) event.preventDefault();
  }, { signal });
  root.addEventListener('keydown', event => {
    if (!editing || !event.target.isContentEditable) return;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void save();
    }
  }, { signal });
  window.addEventListener('beforeunload', event => {
    if (!dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  }, { signal });

  return {
    ready,
    dispose() {
      lifecycle.abort();
      accessGeneration++;
      credential = '';
      editing = false;
      fields.forEach(({ element }) => { element.removeAttribute('contenteditable'); element.removeAttribute('spellcheck'); });
      root.classList.remove('deck-editing');
      dialog.remove();
      toolbar.remove();
    }
  };
}
