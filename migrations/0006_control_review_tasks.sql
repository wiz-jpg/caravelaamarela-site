-- Caravela Control Preview D1 ONLY — pending human-review tasks from Zoho signals.
-- Append-only mail sources and original commercial decision events remain untouched.
-- Run on caravela-zoho-test, never production. Idempotent; no deletions.
CREATE TABLE IF NOT EXISTS control_review_tasks (
  mailbox TEXT NOT NULL,
  folder_kind TEXT NOT NULL CHECK(folder_kind='incoming'),
  message_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','dismissed')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL,
  reviewed_ms INTEGER,
  reviewed_by TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(mailbox,folder_kind,message_id),
  FOREIGN KEY(mailbox,folder_kind,message_id)
    REFERENCES control_mail_signals(mailbox,folder_kind,message_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS control_review_tasks_queue
  ON control_review_tasks(status,created_ms DESC);
CREATE INDEX IF NOT EXISTS control_review_tasks_reviewed
  ON control_review_tasks(reviewed_ms DESC);
