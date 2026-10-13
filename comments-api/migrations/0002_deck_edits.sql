CREATE TABLE IF NOT EXISTS deck_edits (
  slug TEXT PRIMARY KEY CHECK(slug = 'campaign-deck'),
  fields TEXT NOT NULL CHECK(json_valid(fields) AND length(CAST(fields AS BLOB)) <= 131072),
  revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
  updated_at TEXT NOT NULL
);
