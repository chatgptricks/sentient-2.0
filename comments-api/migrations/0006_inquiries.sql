CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'saved'
    CHECK(delivery_status IN ('saved','sending','accepted','failed','uncertain')),
  delivery_provider TEXT,
  delivery_attempt_id TEXT,
  delivery_started_at TEXT,
  delivery_first_attempt_at TEXT,
  delivery_uncertain_at TEXT,
  delivery_accepted_at TEXT,
  provider_message_id TEXT,
  delivery_error_code TEXT
);
CREATE INDEX IF NOT EXISTS inquiries_delivery_date ON inquiries(delivery_status, created_at);
