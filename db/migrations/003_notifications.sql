-- Notification templates and log (from shima.shop), seeded with Landed's lifecycle emails.
-- Placeholders: {{ref}} {{name}} {{total}} {{deposit}} {{balance}} {{arrival}} {{halls}} {{building}}
--               {{pay_url}} {{status_url}} {{whatsapp}} {{site_url}} {{items}}
CREATE TABLE IF NOT EXISTS notification_templates (
  id          TEXT PRIMARY KEY,
  event       TEXT NOT NULL UNIQUE,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  body_text   TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event         TEXT NOT NULL,
  recipient     TEXT NOT NULL,
  subject       TEXT,
  template_id   TEXT,
  order_ref     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',   -- sent | failed | skipped
  error_message TEXT,
  body_text     TEXT,
  sent_at       TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notification_log_event ON notification_log(event);
CREATE INDEX IF NOT EXISTS idx_notification_log_order ON notification_log(order_ref);
CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(created_at);

INSERT OR IGNORE INTO notification_templates (id, event, subject, body_html, body_text, enabled) VALUES
('tpl-reservation', 'reservation_received', 'Reserved: your Landed kit, ref {{ref}}',
 '<p>Hi {{name}},</p><p>Your box is held. Reference <b>{{ref}}</b>.</p><p>{{items}}</p><p>Total {{total}}. Pay the {{deposit}} deposit to confirm: <a href="{{pay_url}}">{{pay_url}}</a></p><p>The balance of {{balance}} is paid at your door on delivery day, by card or cash.</p><p>Check-in {{arrival}}, {{halls}} {{building}}. We message you on WhatsApp the week before to confirm the room.</p><p>Your reference is also your referral code: a friend who reserves with it gets £10 off and you get £10 off your balance.</p><p>Free cancellation up to 14 days before check-in.</p>',
 'Hi {{name}},\nYour box is held. Reference {{ref}}.\n{{items}}\nTotal {{total}}. Pay the {{deposit}} deposit to confirm: {{pay_url}}\nBalance {{balance}} at your door on delivery day.\nCheck-in {{arrival}}, {{halls}} {{building}}.\nYour reference is also your referral code (£10 off for a friend, £10 off your balance).\nFree cancellation up to 14 days before check-in.', 1),
('tpl-deposit', 'deposit_received', 'Deposit received, {{ref}} is confirmed',
 '<p>Hi {{name}},</p><p>We have your {{deposit}} deposit for <b>{{ref}}</b>. Your box is now bought against your order.</p><p>Balance on delivery: <b>{{balance}}</b>.</p><p>Check-in {{arrival}}, {{halls}} {{building}}. The week before, we message you on WhatsApp to check the building and room.</p>',
 'Hi {{name}},\nWe have your {{deposit}} deposit for {{ref}}. Balance on delivery: {{balance}}.\nCheck-in {{arrival}}, {{halls}} {{building}}.', 1),
('tpl-reminder', 'delivery_reminder', 'Your Landed box arrives {{arrival}}',
 '<p>Hi {{name}},</p><p>Your box for <b>{{ref}}</b> is packed for {{arrival}} at {{halls}} {{building}}.</p><p>If the building or room has changed, reply to this email or message us on WhatsApp: {{whatsapp}}.</p><p>Balance on the day: <b>{{balance}}</b>, card or cash. Or pay it now: <a href="{{pay_url}}">{{pay_url}}</a></p>',
 'Hi {{name}},\nYour box for {{ref}} is packed for {{arrival}} at {{halls}} {{building}}.\nIf the room has changed, reply or WhatsApp {{whatsapp}}.\nBalance on the day: {{balance}}. Or pay now: {{pay_url}}', 1),
('tpl-delivered', 'delivered', 'Delivered: {{ref}}',
 '<p>Hi {{name}},</p><p>Your box for <b>{{ref}}</b> has landed. {{note}}</p><p>Balance: <b>{{balance}}</b>. {{balance_line}}</p><p>Anything missing or broken, message us on WhatsApp: {{whatsapp}}.</p>',
 'Hi {{name}},\nYour box for {{ref}} has landed. {{note}}\nBalance: {{balance}}. {{balance_line}}\nAnything wrong, WhatsApp {{whatsapp}}.', 1),
('tpl-balance', 'balance_received', 'Paid in full: {{ref}}',
 '<p>Hi {{name}},</p><p>Thanks, the balance of {{balance}} for <b>{{ref}}</b> is paid. That is everything settled.</p><p>Summer storage opens in April; you asked us to tell you, so we will.</p>',
 'Hi {{name}},\nThe balance of {{balance}} for {{ref}} is paid. All settled.', 1),
('tpl-cancelled', 'cancelled', 'Cancelled: {{ref}}',
 '<p>Hi {{name}},</p><p>Your reservation <b>{{ref}}</b> is cancelled. {{deposit_line}}</p><p>If that was not you, message us on WhatsApp: {{whatsapp}}.</p>',
 'Hi {{name}},\nYour reservation {{ref}} is cancelled. {{deposit_line}}', 1),
('tpl-admin-new', 'admin_new_order', 'New reservation {{ref}}: {{name}}, {{halls}}, {{arrival}}',
 '<p><b>{{ref}}</b> {{name}} &lt;{{email}}&gt; {{phone}}</p><p>{{items}}</p><p>Total {{total}}, deposit {{deposit}} ({{deposit_status}}). {{halls}} {{building}}, check-in {{arrival}}.</p><p>Notes: {{notes}}</p><p><a href="{{site_url}}/admin/#orders/{{ref}}">Open in admin</a></p>',
 '{{ref}} {{name}} {{email}} {{phone}}\n{{items}}\nTotal {{total}}, deposit {{deposit}} ({{deposit_status}}). {{halls}} {{building}}, check-in {{arrival}}.\nNotes: {{notes}}', 1);
