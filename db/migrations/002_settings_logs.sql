-- Settings (key/value JSON) and application logs (from shima.shop)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  severity    TEXT NOT NULL DEFAULT 'info',
  type        TEXT NOT NULL DEFAULT 'application',
  message     TEXT NOT NULL,
  metadata    TEXT DEFAULT '{}',
  source      TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);

INSERT OR IGNORE INTO settings (key, value) VALUES ('app.settings', '{"log-level":"info","log-drivers":["console","db"]}');
INSERT OR IGNORE INTO settings (key, value) VALUES ('general', '{"admin_email":"","whatsapp_number":"","winter_delivery_date":"2026-10-17","site_url":""}');

-- Processed payment webhooks, so a redelivered event is a no-op
CREATE TABLE IF NOT EXISTS webhook_events (
  id          TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  type        TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
