import './editor.css';
import { chooseSaveTarget, chooseTextVersion } from './version-dialogs.mjs';

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

export function initDeckEditor({ root, deck, apiUrl, onFieldsApplied, onEditStart, onDownloadPdf }) {
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
  toolbar.innerHTML = '<p class="deck-edit-feedback" role="status" aria-live="polite"></p><button class="deck-edit-pdf" type="button">Download PDF</button><button class="deck-edit-done" type="button">Done <span aria-hidden="true">✓</span></button>';
  const versionsToolbar = document.createElement('div');
  versionsToolbar.className = 'deck-version-toolbar';
  versionsToolbar.dataset.pdfExclude = '';
  versionsToolbar.hidden = true;
  versionsToolbar.innerHTML = '<button type="button">Other versions</button><span class="deck-version-current">Original</span>';
  root.append(dialog, toolbar, versionsToolbar);
  const versionsButton = versionsToolbar.querySelector('button');
  const versionLabel = versionsToolbar.querySelector('.deck-version-current');
  const passwordInput = dialog.querySelector('input');
  const accessFeedback = dialog.querySelector('.deck-access-feedback');
  const continueButton = dialog.querySelector('.deck-access-continue');
  const doneButton = toolbar.querySelector('.deck-edit-done');
  const pdfButton = toolbar.querySelector('.deck-edit-pdf');
  const editFeedback = toolbar.querySelector('.deck-edit-feedback');
  let credential = '';
  let revision = 0;
  let serverFields = Object.create(null);
  let originalFields = Object.create(null);
  let originalRevision = 0;
  let activeVersion = null;
  let pendingSave = null;
  let lastCopyName = '';
  let choosing = false;
  let savedSnapshot = '';
  let editing = false;
  let saving = false;
  let exporting = false;
  let loadingError = false;
  let lastFocused;
  let accessGeneration = 0;

  const snapshot = () => JSON.stringify(fields.map(({ key, element }) => [key, textOf(element)]));
  const dirty = () => editing && snapshot() !== savedSnapshot;
  const notifyApplied = () => onFieldsApplied?.({ ...serverFields });
  const apply = (values, reset = false) => {
    for (const { key, element, original } of fields) {
      if (reset) element.textContent = original;
      if (Object.hasOwn(values, key)) {
        // `@chatgptricks` is the real Instagram handle. Saved copy from before
        // carries the `chatpgtricks` typo, so correct it when it is shown.
        element.textContent = deck.slug === 'campaign-deck'
          ? values[key].replace(/@?chatpgtricks\b/gi, match => match.startsWith('@') ? '@chatgptricks' : 'chatgptricks')
          : values[key];
      }
    }
    notifyApplied();
  };
  const request = async (url, options = {}) => {
    if (!endpoint || signal.aborted) throw new Error('unavailable');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = window.setTimeout(abort, options.timeout ?? 15000);
    try {
      const { timeout: _, ...init } = options;
      const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store', credentials: 'omit' });
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
    originalFields = { ...serverFields };
    originalRevision = revision;
    activeVersion = null;
    versionLabel.textContent = 'Original';
    apply(serverFields, true);
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
    versionsToolbar.hidden = false;
    versionLabel.textContent = activeVersion?.name ?? 'Original';
    closeAccess();
    if (!activeVersion) onEditStart?.();
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
    versionsToolbar.hidden = true;
    pendingSave = null;
    lastCopyName = '';
    editFeedback.textContent = '';
    brand?.focus?.({ preventScroll: true });
  };
  const save = async (target = pendingSave ?? { mode:'current' }) => {
    if (!editing || saving || exporting || choosing) return;
    const asCopy = target.mode === 'copy';
    if (!asCopy && !dirty()) { leave(); return; }
    const textOnly = asCopy || Boolean(activeVersion);
    const values = textOnly ? Object.create(null) : { ...serverFields };
    pendingSave = target;
    for (const { key, element, original } of fields) {
      if (textOnly && element.hidden) continue;
      const value = textOf(element);
      if (value.length > MAX_FIELD_LENGTH) {
        editFeedback.textContent = 'This text is too long. Shorten it and try again.';
        element.focus({ preventScroll: false });
        return;
      }
      if (!textOnly && value === original) delete values[key];
      else values[key] = value;
    }
    saving = true;
    doneButton.disabled = true;
    pdfButton.disabled = true;
    versionsButton.disabled = true;
    doneButton.setAttribute('aria-busy', 'true');
    doneButton.textContent = 'Saving…';
    editFeedback.textContent = '';
    // Freeze the text while the shared snapshot is being written.
    fields.forEach(({ element }) => element.setAttribute('contenteditable', 'false'));
    try {
      const destination = asCopy ? `${endpoint}/versions` : activeVersion ? `${endpoint}/versions/${activeVersion.id}` : endpoint;
      const body = asCopy ? { fields:values, name:target.name, id:target.id } : { fields:values, revision };
      const { response, payload } = await request(destination, {
        method: asCopy ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
        body: JSON.stringify(body)
      });
      // A retry can encounter its own completed write if the first response was lost.
      const recoveredWrite = response.status === 409 && Number.isSafeInteger(payload?.revision) && sameFields(validFields(payload?.fields), values);
      if (response.status === 409 && !recoveredWrite) {
        editFeedback.textContent = payload?.error || 'This version changed in another session. Your edits are still here.';
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
      if (asCopy) activeVersion = { id:payload.id, name:payload.name };
      if (activeVersion) apply({ ...originalFields, ...serverFields }, true);
      else {
        originalFields = { ...serverFields };
        originalRevision = revision;
        apply(serverFields, true);
      }
      versionLabel.textContent = activeVersion?.name ?? 'Original';
      savedSnapshot = snapshot();
      leave();
    } catch {
      editFeedback.textContent = 'Could not save. Your edits are still here. Try again.';
    } finally {
      saving = false;
      doneButton.disabled = false;
      pdfButton.disabled = false;
      versionsButton.disabled = false;
      doneButton.removeAttribute('aria-busy');
      doneButton.innerHTML = 'Done <span aria-hidden="true">✓</span>';
      if (editing) fields.forEach(({ element }) => element.setAttribute('contenteditable', 'plaintext-only'));
    }
  };

  const finishEditing = async () => {
    if (!editing || saving || exporting || choosing) return;
    choosing = true;
    doneButton.disabled = pdfButton.disabled = versionsButton.disabled = true;
    let target;
    try { target = await chooseSaveTarget({ currentName:activeVersion?.name ?? 'Original', copyName:lastCopyName }); }
    finally {
      choosing = false;
      doneButton.disabled = pdfButton.disabled = versionsButton.disabled = false;
    }
    if (target) {
      if (target.mode === 'copy') {
        if (pendingSave?.mode === 'copy' && pendingSave.name === target.name) target.id = pendingSave.id;
        lastCopyName = target.name;
      }
      await save(target);
    }
  };

  versionsButton.addEventListener('click', async () => {
    if (!editing || saving || exporting || choosing) return;
    choosing = true;
    doneButton.disabled = pdfButton.disabled = versionsButton.disabled = true;
    fields.forEach(({ element }) => element.setAttribute('contenteditable', 'false'));
    try {
      const headers = { Authorization:`Bearer ${credential}` };
      const list = await request(`${endpoint}/versions`, { headers });
      if (!list.response.ok || !Array.isArray(list.payload?.versions)) throw new Error(list.payload?.error || 'Could not load versions.');
      const selected = await chooseTextVersion(list.payload.versions, activeVersion?.id);
      if (!selected) return;
      if (dirty() && !window.confirm('Discard your unsaved edits and open this version?')) return;
      const [original, version] = await Promise.all([
        request(endpoint),
        selected.id ? request(`${endpoint}/versions/${encodeURIComponent(selected.id)}`, { headers }) : Promise.resolve(null),
      ]);
      if (!original.response.ok || !Number.isSafeInteger(original.payload?.revision)) throw new Error('Could not load the original.');
      if (version && (!version.response.ok || !Number.isSafeInteger(version.payload?.revision))) throw new Error(version.payload?.error || 'Could not load this version.');
      originalFields = validFields(original.payload.fields);
      originalRevision = original.payload.revision;
      activeVersion = version ? { id:version.payload.id, name:version.payload.name } : null;
      serverFields = version ? validFields(version.payload.fields) : { ...originalFields };
      revision = version ? version.payload.revision : originalRevision;
      apply({ ...originalFields, ...serverFields }, true);
      savedSnapshot = snapshot();
      pendingSave = null;
      lastCopyName = '';
      versionLabel.textContent = activeVersion?.name ?? 'Original';
      editFeedback.textContent = '';
    } catch (error) {
      editFeedback.textContent = error.message || 'Could not load versions. Your edits are still here.';
    } finally {
      choosing = false;
      doneButton.disabled = pdfButton.disabled = versionsButton.disabled = false;
      if (editing) fields.forEach(({ element }) => element.setAttribute('contenteditable', 'plaintext-only'));
    }
  }, { signal });

  pdfButton.addEventListener('click', async () => {
    if (!editing || saving || exporting || choosing || !onDownloadPdf) return;
    exporting = true;
    pdfButton.disabled = doneButton.disabled = versionsButton.disabled = true;
    pdfButton.setAttribute('aria-busy', 'true');
    document.activeElement?.blur();
    try {
      await onDownloadPdf(({ index, total }) => { editFeedback.textContent = `Preparing PDF ${index + 1}/${total}…`; });
      editFeedback.textContent = '';
    } catch {
      editFeedback.textContent = 'Could not download PDF. Try again.';
    } finally {
      exporting = false;
      pdfButton.disabled = doneButton.disabled = versionsButton.disabled = false;
      pdfButton.removeAttribute('aria-busy');
    }
  }, { signal });

  const logoSelector = '.deck-brand,.deck-end-glow,.deck-end-logo,.deck-cover-emblem:not([data-art]),img[alt="Sentient" i],img[src*="sentient-logo"],[role="img"][aria-label="Sentient" i]';
  root.addEventListener('click', event => {
    if (event.target.closest(logoSelector)) { event.preventDefault(); event.stopPropagation(); }
  }, { signal });
  root.addEventListener('dblclick', event => {
    if (event.target.closest(logoSelector)) openAccess(event);
  }, { signal });
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
  doneButton.addEventListener('click', () => void finishEditing(), { signal });
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
      void finishEditing();
    }
  }, { signal });
  window.addEventListener('beforeunload', event => {
    if (!dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  }, { signal });

  const sentientDash = async (route, body) => {
    if (!editing || !credential) throw new Error('Enter edit mode to use SentientDash.');
    let result;
    try {
      // SentientDash can take a while on a cold start; allow it longer than a save.
      result = await request(`${endpoint}/${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` }, body: JSON.stringify(body), timeout: 60000
      });
    } catch {
      throw new Error('SentientDash took too long to answer. Try again.');
    }
    const { response, payload } = result;
    if (!response.ok || !payload) throw new Error(payload?.error || 'SentientDash is unavailable right now. Try again.');
    return payload;
  };

  return {
    ready,
    // SentientDash lookups through the Worker, authorised by this editing
    // session's password: a pasted Instagram link, or an account's followers.
    lookupPost: url => sentientDash('instagram-post', { url }),
    lookupAccount: handle => sentientDash('account', { handle }),
    dispose() {
      lifecycle.abort();
      accessGeneration++;
      credential = '';
      editing = false;
      fields.forEach(({ element }) => { element.removeAttribute('contenteditable'); element.removeAttribute('spellcheck'); });
      root.classList.remove('deck-editing');
      dialog.remove();
      toolbar.remove();
      versionsToolbar.remove();
    }
  };
}
