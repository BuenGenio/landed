-- Billing: a payments ledger and numbered invoices / credit notes.
-- Pattern from duties-api (payments + invoices tables, PaymentRecorder), reduced to Landed's
-- two payments per order (deposit, balance) plus refunds. The orders table keeps its
-- deposit_*/balance_* columns as the current state; this ledger is the history behind them.

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref     TEXT NOT NULL,
  kind          TEXT NOT NULL,                 -- deposit | balance | refund
  amount        REAL NOT NULL,                 -- always positive; refunds carry kind = 'refund'
  currency      TEXT NOT NULL DEFAULT 'GBP',
  method        TEXT,                          -- card | cash | bank | monobank | link
  provider      TEXT NOT NULL DEFAULT 'manual',-- stripe | manual
  provider_ref  TEXT,                          -- Stripe payment_intent / refund id
  refund_of     TEXT,                          -- refunds: deposit | balance
  note          TEXT,
  user_id       TEXT,                          -- admin | customer | stripe | null
  created_at    TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_ref) REFERENCES orders(ref) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_ref);
CREATE INDEX IF NOT EXISTS idx_payments_kind ON payments(kind);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

CREATE TABLE IF NOT EXISTS invoices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  number      TEXT NOT NULL UNIQUE,            -- LND-0001, LND-CN-0002
  order_ref   TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'invoice', -- invoice | credit_note
  amount      REAL NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'GBP',
  issued_at   TEXT DEFAULT (datetime('now')),
  data        TEXT NOT NULL DEFAULT '{}',      -- snapshot: customer, lines, payments at issue time
  FOREIGN KEY (order_ref) REFERENCES orders(ref) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_ref);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type);

INSERT OR IGNORE INTO settings (key, value) VALUES ('billing',
  '{"business_name":"Landed","address":"Aberdeen, Scotland","email":"","phone":"","vat_number":"","invoice_prefix":"LND-","next_number":1,"footer":"Landed is a small Aberdeen business run by students, for students. Not VAT registered; no VAT is charged."}');

-- Backfill the ledger from orders that were paid before the ledger existed.
INSERT INTO payments (order_ref, kind, amount, currency, method, provider, provider_ref, user_id, created_at)
  SELECT ref, 'deposit', deposit, currency, deposit_method,
         CASE WHEN deposit_method = 'card' THEN 'stripe' ELSE 'manual' END, deposit_payment_id, 'backfill', COALESCE(deposit_paid_at, updated_at)
  FROM orders o WHERE deposit_status IN ('paid', 'refunded', 'kept')
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_ref = o.ref AND p.kind = 'deposit');

INSERT INTO payments (order_ref, kind, amount, currency, method, provider, provider_ref, user_id, created_at)
  SELECT ref, 'balance', MAX(0, total - deposit - referral_credit), currency, balance_method,
         CASE WHEN balance_method IN ('card', 'link') THEN 'stripe' ELSE 'manual' END, balance_payment_id, 'backfill', COALESCE(balance_paid_at, updated_at)
  FROM orders o WHERE balance_status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_ref = o.ref AND p.kind = 'balance');

INSERT INTO payments (order_ref, kind, amount, currency, method, provider, refund_of, user_id, created_at)
  SELECT ref, 'refund', deposit, currency, deposit_method,
         CASE WHEN deposit_method = 'card' THEN 'stripe' ELSE 'manual' END, 'deposit', 'backfill', COALESCE(cancelled_at, updated_at)
  FROM orders o WHERE deposit_status = 'refunded'
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_ref = o.ref AND p.kind = 'refund');
