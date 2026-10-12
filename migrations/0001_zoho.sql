-- Apply only to an isolated test D1 first. No public/contact/news tables touched.
CREATE TABLE IF NOT EXISTS zoho_oauth_state (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS zoho_state_expiry ON zoho_oauth_state(expires_at);
CREATE TABLE IF NOT EXISTS zoho_connection (
  mailbox TEXT PRIMARY KEY,
  sealed TEXT NOT NULL,
  lock_id TEXT,
  lock_until INTEGER NOT NULL DEFAULT 0
);
