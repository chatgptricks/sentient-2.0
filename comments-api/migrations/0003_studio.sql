-- Decks published from the deck studio, and the images they use.
CREATE TABLE IF NOT EXISTS studio_decks (
  slug TEXT PRIMARY KEY CHECK(length(slug) BETWEEN 2 AND 64),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  deck TEXT NOT NULL CHECK(json_valid(deck) AND length(CAST(deck AS BLOB)) <= 524288),
  revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Content-addressed (SHA-256) so the same image is stored once. Base64 text
-- keeps each row under D1's 2 MB value limit for images up to 1.4 MB.
CREATE TABLE IF NOT EXISTS studio_assets (
  id TEXT PRIMARY KEY CHECK(length(id) = 64),
  type TEXT NOT NULL CHECK(type IN ('image/webp', 'image/png', 'image/jpeg', 'image/gif')),
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
