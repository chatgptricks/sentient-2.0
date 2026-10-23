-- Named copies contain text JSON only; the presentation and original stay shared.
CREATE TABLE IF NOT EXISTS deck_text_versions (
  deck_slug TEXT NOT NULL CHECK(length(deck_slug) BETWEEN 2 AND 64),
  id TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
  fields TEXT NOT NULL CHECK(json_valid(fields) AND length(CAST(fields AS BLOB)) <= 131072),
  revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (deck_slug, id),
  UNIQUE (deck_slug, name COLLATE NOCASE)
);
