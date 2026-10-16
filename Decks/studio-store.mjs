// Studio decks live in this browser's IndexedDB (uploaded images included),
// so they survive reloads without a server. Export/import JSON moves them.
const open = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('sentient-deck-studio', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('decks', { keyPath:'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
let database;
const store = async mode => {
  database ??= open();
  return (await database).transaction('decks', mode).objectStore('decks');
};
const done = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const listDecks = async () => (await done((await store('readonly')).getAll())).sort((a, b) => b.updatedAt - a.updatedAt);
export const getDeck = async id => done((await store('readonly')).get(id));
export const getDeckBySlug = async slug => (await listDecks()).find(deck => deck.slug === slug);
export const putDeck = async deck => done((await store('readwrite')).put({ ...deck, updatedAt:Date.now() }));
export const deleteDeck = async id => done((await store('readwrite')).delete(id));

export const slugify = (title, id) => `${String(title).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'deck'}-${id.slice(0, 4)}`;
