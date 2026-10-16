-- Caravela Control Preview only: bounded, privacy-minimised mail intelligence.
-- Apply to caravela-zoho-test only; do not modify Production.
-- Stores only categorized review hints, never subject, body, attachment, snippet or token.
-- Separate from append-only historical bookings and commercial decisions.
CREATE TABLE IF NOT EXISTS control_mail_signals (
  mailbox TEXT NOT NULL,
  folder_kind TEXT NOT NULL CHECK(folder_kind IN ('incoming','outgoing')),
  message_id TEXT NOT NULL,
  thread_id TEXT,
  external_email TEXT,
  message_ms INTEGER,
  topic TEXT NOT NULL CHECK(topic IN ('booking','partnership','press','other','unclear')),
  signal TEXT NOT NULL CHECK(signal IN ('interest','decline','possible_confirmation','needs_reply','none','ambiguous')),
  confidence TEXT NOT NULL CHECK(confidence IN ('rule_based','insufficient')),
  reason_code TEXT NOT NULL,
  classifier_version INTEGER NOT NULL DEFAULT 1,
  observed_ms INTEGER NOT NULL,
  PRIMARY KEY(mailbox,folder_kind,message_id),
  FOREIGN KEY(mailbox,folder_kind,message_id)
    REFERENCES control_mail_headers(mailbox,folder_kind,message_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS control_mail_signals_recent
  ON control_mail_signals(observed_ms DESC);
CREATE INDEX IF NOT EXISTS control_mail_signals_review
  ON control_mail_signals(signal,message_ms DESC);
