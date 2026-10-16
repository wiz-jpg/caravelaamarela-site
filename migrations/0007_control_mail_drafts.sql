-- Caravela Control PREVIEW D1 (caravela-zoho-test) ONLY.
-- Encrypted, recoverable mail drafts. Never stores plaintext subject, body or addresses.
-- Manual SQL migration. No DROP/DELETE, no production tables or SMTP/OAuth send permission.
CREATE TABLE IF NOT EXISTS control_mail_drafts (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','archived')),
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  edited_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS control_mail_drafts_recent
  ON control_mail_drafts(status,updated_ms DESC);
CREATE TABLE IF NOT EXISTS control_mail_draft_versions (
  draft_id TEXT NOT NULL REFERENCES control_mail_drafts(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK(revision>=1),
  ciphertext TEXT NOT NULL,
  created_ms INTEGER NOT NULL,
  edited_by TEXT NOT NULL,
  PRIMARY KEY(draft_id,revision)
);
CREATE INDEX IF NOT EXISTS control_mail_draft_versions_recent
  ON control_mail_draft_versions(draft_id,revision DESC);
