-- Caravela Control password accounts and isolated sessions. Preview D1 only.
-- Apply each statement separately in Cloudflare console if needed.
-- Additive migration: no changes to existing OAuth or CRM snapshot tables.
CREATE TABLE IF NOT EXISTS control_auth_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS control_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','manager','viewer')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0,1)),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  rounds INTEGER NOT NULL CHECK(rounds BETWEEN 200000 AND 1000000),
  created_ms INTEGER NOT NULL,
  last_login_ms INTEGER
);
CREATE TABLE IF NOT EXISTS control_sessions (
  token_sha256 TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES control_users(id) ON DELETE RESTRICT,
  created_ms INTEGER NOT NULL,
  expires_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS control_sessions_by_user ON control_sessions(user_id,expires_ms);
CREATE TABLE IF NOT EXISTS control_login_attempts (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS control_login_attempts_expiry ON control_login_attempts(reset_ms);
