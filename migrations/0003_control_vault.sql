-- Caravela Control Vault v1 | Preview D1 ONLY.
-- Apply manually to caravela-zoho-test after reviewing the migration.
-- No deletion or mutation of Zoho OAuth tables or public-site data.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS control_snapshots (
  id TEXT PRIMARY KEY,
  raw_sha256 TEXT NOT NULL UNIQUE CHECK(length(raw_sha256)=64),
  manifest_sha256 TEXT NOT NULL CHECK(length(manifest_sha256)=64),
  declared_bytes INTEGER NOT NULL CHECK(declared_bytes>0 AND declared_bytes<=12582912),
  declared_parts INTEGER NOT NULL CHECK(declared_parts BETWEEN 1 AND 128),
  state TEXT NOT NULL CHECK(state IN ('staging','sealed')),
  created_ms INTEGER NOT NULL,
  sealed_ms INTEGER,
  entity_count INTEGER,
  action_count INTEGER,
  artist_count INTEGER,
  triage_count INTEGER,
  CHECK((state='staging' AND sealed_ms IS NULL) OR (state='sealed' AND sealed_ms IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS control_snapshots_recent ON control_snapshots(created_ms DESC);

CREATE TABLE IF NOT EXISTS control_snapshot_parts (
  snapshot_id TEXT NOT NULL REFERENCES control_snapshots(id) ON DELETE RESTRICT,
  part_index INTEGER NOT NULL CHECK(part_index>=0 AND part_index<128),
  bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=131072),
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  encoded TEXT NOT NULL,
  created_ms INTEGER NOT NULL,
  PRIMARY KEY(snapshot_id,part_index)
);

CREATE TABLE IF NOT EXISTS control_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  changed_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS control_audit (
  id TEXT PRIMARY KEY,
  occurred_ms INTEGER NOT NULL,
  operation TEXT NOT NULL,
  target TEXT,
  details_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS control_audit_time ON control_audit(occurred_ms DESC);

-- Observations NEVER assert "proposal sent", "reply received" or "contact approved".
CREATE TABLE IF NOT EXISTS control_mail_headers (
  mailbox TEXT NOT NULL,
  folder_kind TEXT NOT NULL CHECK(folder_kind IN ('incoming','outgoing')),
  message_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  from_email TEXT,
  to_json TEXT NOT NULL,
  received_ms INTEGER,
  thread_id TEXT,
  first_seen_ms INTEGER NOT NULL,
  PRIMARY KEY(mailbox,folder_kind,message_id)
);
CREATE INDEX IF NOT EXISTS control_mail_date ON control_mail_headers(received_ms DESC);

CREATE TABLE IF NOT EXISTS control_mail_sync_position (
  folder_kind TEXT PRIMARY KEY CHECK(folder_kind IN ('incoming','outgoing')),
  folder_id TEXT NOT NULL,
  older_start INTEGER NOT NULL CHECK(older_start>=1),
  updated_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS control_sync_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('zoho','sheets','gmail')),
  started_ms INTEGER NOT NULL,
  completed_ms INTEGER,
  status TEXT NOT NULL CHECK(status IN ('running','complete','failed','partial')),
  new_records INTEGER NOT NULL DEFAULT 0,
  examined_records INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS control_sync_recent ON control_sync_runs(provider,started_ms DESC);

CREATE TABLE IF NOT EXISTS control_source_revisions (
  source_key TEXT NOT NULL,
  revision_sha256 TEXT NOT NULL CHECK(length(revision_sha256)=64),
  provider TEXT NOT NULL,
  title TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  captured_ms INTEGER NOT NULL,
  PRIMARY KEY(source_key,revision_sha256)
);
CREATE INDEX IF NOT EXISTS control_source_latest ON control_source_revisions(source_key,captured_ms DESC);

-- Append-only manual decisions; never overwrite data imported from original sources.
CREATE TABLE IF NOT EXISTS control_decision_events (
  id TEXT PRIMARY KEY,
  entity_id TEXT,
  artist_name TEXT,
  operation TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS control_decisions_entity ON control_decision_events(entity_id,artist_name,created_ms);
