CREATE TABLE inquiry_pipedrive (
  inquiry_id TEXT PRIMARY KEY REFERENCES inquiries(id) ON DELETE CASCADE,
  next_attempt_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  person_id INTEGER,
  lead_id TEXT,
  pending_write TEXT CHECK (pending_write IN ('person', 'lead', 'note')),
  last_error TEXT,
  synced_at TEXT
);

CREATE INDEX inquiry_pipedrive_due ON inquiry_pipedrive(next_attempt_at) WHERE synced_at IS NULL;

CREATE TRIGGER queue_new_inquiry_for_pipedrive AFTER INSERT ON inquiries
BEGIN
  INSERT INTO inquiry_pipedrive (inquiry_id, next_attempt_at) VALUES (NEW.id, NEW.created_at);
END;
