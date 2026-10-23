-- Other deck slugs use the same versioned inline editing as the campaign.
-- Keep the existing campaign table and all of its saved edits unchanged.
CREATE TABLE IF NOT EXISTS deck_text_edits (
  slug TEXT PRIMARY KEY CHECK(length(slug) BETWEEN 2 AND 64),
  fields TEXT NOT NULL CHECK(json_valid(fields) AND length(CAST(fields AS BLOB)) <= 131072),
  revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
  updated_at TEXT NOT NULL
);
