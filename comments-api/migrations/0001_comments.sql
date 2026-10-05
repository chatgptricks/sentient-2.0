CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,
  author TEXT NOT NULL CHECK(length(author) BETWEEN 1 AND 80),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),
  anchor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_page_date ON comments(page, created_at);
