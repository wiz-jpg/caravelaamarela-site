-- CRM read-only import and Zoho metadata reconciliation.
-- Isolated test DB: the ZOHO_DB Preview binding (caravela-zoho-test).
-- Does NOT touch existing zoho_connection, contact_submissions, or news tables.
CREATE TABLE IF NOT EXISTS crm_imports (
  id TEXT PRIMARY KEY,
  expected_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS crm_entities (
  import_id TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('festival','venue','promoter','press')),
  name TEXT NOT NULL,
  city TEXT,
  priority TEXT,
  recommendation TEXT,
  status_2027 TEXT,
  historical TEXT,
  contacted_source TEXT,
  verification TEXT,
  source_url TEXT,
  origin_json TEXT NOT NULL,
  meta_json TEXT NOT NULL,
  source_review INTEGER NOT NULL DEFAULT 1,
  source_shared INTEGER NOT NULL DEFAULT 0,
  source_suppressed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(import_id,id)
);
CREATE INDEX IF NOT EXISTS crm_entities_kind ON crm_entities(import_id,kind,name);
CREATE TABLE IF NOT EXISTS crm_entity_emails (
  import_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  email TEXT NOT NULL,
  PRIMARY KEY(import_id,entity_id,email)
);
CREATE INDEX IF NOT EXISTS crm_emails_lookup ON crm_entity_emails(import_id,email);
CREATE TABLE IF NOT EXISTS crm_suppressions (
  import_id TEXT NOT NULL,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  origin_json TEXT NOT NULL,
  PRIMARY KEY(import_id,email)
);
CREATE TABLE IF NOT EXISTS crm_messages (
  message_id TEXT PRIMARY KEY,
  folder_kind TEXT NOT NULL CHECK(folder_kind IN ('inbox','sent')),
  folder_id TEXT NOT NULL,
  from_email TEXT,
  to_json TEXT NOT NULL,
  date_ms INTEGER,
  subject TEXT,
  preview TEXT,
  thread_id TEXT,
  synced_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_messages_date ON crm_messages(date_ms);
CREATE TABLE IF NOT EXISTS crm_message_links (
  import_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
  email TEXT NOT NULL,
  PRIMARY KEY(import_id,message_id,entity_id)
);
CREATE INDEX IF NOT EXISTS crm_links_entity ON crm_message_links(import_id,entity_id,direction);
CREATE TABLE IF NOT EXISTS crm_message_review (
  import_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY(import_id,message_id)
);
CREATE TABLE IF NOT EXISTS crm_sync_runs (
  run_id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL,
  folder_kind TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  fetched_count INTEGER NOT NULL,
  matched_count INTEGER NOT NULL,
  ambiguous_count INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);
