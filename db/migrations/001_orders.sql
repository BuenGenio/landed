-- Landed orders. Adapted from shima.shop's orders/order_events model:
-- one row per reservation, an audit row per touch, deliveries as their own rows.

CREATE TABLE IF NOT EXISTS orders (
  ref              TEXT PRIMARY KEY,            -- LND-XXXX, also the customer's referral code
  status           TEXT NOT NULL DEFAULT 'reserved',  -- reserved | confirmed | delivered | closed | cancelled
  kit              TEXT NOT NULL,               -- arrival | winter | both | mix
  items            TEXT NOT NULL DEFAULT '[]',  -- JSON: item ids (mix only)
  addons           TEXT NOT NULL DEFAULT '[]',  -- JSON: [{id, n, price}]
  currency         TEXT NOT NULL DEFAULT 'GBP',
  kit_total        REAL NOT NULL DEFAULT 0,     -- kit or mix price
  addons_total     REAL NOT NULL DEFAULT 0,
  discount         REAL NOT NULL DEFAULT 0,     -- referral discount applied to this order
  total            REAL NOT NULL DEFAULT 0,     -- kit_total + addons_total - discount
  deposit          REAL NOT NULL DEFAULT 20,
  deposit_status   TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | refunded | kept | void
  deposit_method   TEXT,                        -- card | cash | bank | monobank
  deposit_payment_id TEXT,                      -- Stripe payment_intent / session id
  deposit_paid_at  TEXT,
  balance_status   TEXT NOT NULL DEFAULT 'due', -- due | paid | waived
  balance_method   TEXT,                        -- card | cash | bank | link
  balance_payment_id TEXT,
  balance_paid_at  TEXT,
  referral_used    TEXT,                        -- code the customer typed (validated)
  referral_credit  REAL NOT NULL DEFAULT 0,     -- earned by referring others; comes off the balance
  storage_interest INTEGER NOT NULL DEFAULT 0,
  uni              TEXT,
  halls            TEXT,
  building         TEXT,
  arrival_date     TEXT,                        -- YYYY-MM-DD check-in date
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  from_country     TEXT,
  notes            TEXT,
  lang             TEXT DEFAULT 'en',
  admin_notes      TEXT,
  cancelled_at     TEXT,
  cancel_reason    TEXT,
  data             TEXT NOT NULL DEFAULT '{}',  -- anything else (raw page payload, stripe session ids)
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_arrival ON orders(arrival_date);
CREATE INDEX IF NOT EXISTS idx_orders_halls ON orders(halls);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_deposit ON orders(deposit_status);

-- One row per physical drop: the arrival box on check-in day, the winter box in October,
-- a storage collection in May. The run sheet is a query over this table.
CREATE TABLE IF NOT EXISTS deliveries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref      TEXT NOT NULL,
  kind           TEXT NOT NULL,                 -- arrival | winter | storage_collection | storage_return
  scheduled_date TEXT,                          -- YYYY-MM-DD
  status         TEXT NOT NULL DEFAULT 'planned',  -- planned | packed | delivered | reception | failed | cancelled
  note           TEXT,                          -- "left with reception, name on box" etc.
  delivered_at   TEXT,
  reminder_sent_at TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_ref) REFERENCES orders(ref) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_ref);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- Audit: every create/read/update, with origin (from shima.shop order_events)
CREATE TABLE IF NOT EXISTS order_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref      TEXT NOT NULL,
  activity       TEXT NOT NULL,
  user_id        TEXT,
  origin_ip      TEXT,
  origin_country TEXT,
  user_agent     TEXT,
  technology     TEXT,
  method         TEXT,
  payload        TEXT DEFAULT '{}',
  created_at     TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_ref) REFERENCES orders(ref) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_ref);
CREATE INDEX IF NOT EXISTS idx_order_events_created ON order_events(created_at);
