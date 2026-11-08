CREATE TABLE IF NOT EXISTS network_snapshots (
  resource TEXT NOT NULL CHECK(resource IN ('accounts', 'posts')),
  authorization_fingerprint TEXT NOT NULL CHECK(length(authorization_fingerprint) = 64),
  schema_version INTEGER NOT NULL DEFAULT 1,
  payload TEXT,
  signature TEXT,
  fetched_at TEXT,
  saved_at TEXT,
  authorization_rejected_at TEXT,
  authorization_rejected_status INTEGER CHECK(authorization_rejected_status IN (401, 403)),
  PRIMARY KEY(resource, authorization_fingerprint)
);
