/**
 * Billing: the payments ledger, refunds and numbered invoices / credit notes.
 * Pattern from duties-api (PaymentRecorder, invoices with a per-type sequence) on Landed's
 * deposit + balance model. Orders keep the current state in their deposit and balance columns; every
 * money movement also lands here so the admin has a ledger, exports and documents to print.
 */
import { getDb, getSetting, setSetting } from './db.js'
import { logOrderEvent } from './order-events.js'
import { money } from './http.js'

export const PAYMENT_KINDS = ['deposit', 'balance', 'refund']
export const INVOICE_TYPES = ['invoice', 'credit_note']
const round2 = n => Math.round(n * 100) / 100
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export class BillingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

export const providerFor = method => (method === 'card' || method === 'link' ? 'stripe' : 'manual')

/** Append a ledger row. Never decides state; callers update orders first. */
export async function recordPayment(ctx, { ref, kind, amount, currency = 'GBP', method = null, provider = null, providerRef = null, refundOf = null, note = null, userId = null }) {
  const db = ctx.db || getDb(ctx.env)
  if (!PAYMENT_KINDS.includes(kind)) throw new BillingError(`Bad payment kind ${kind}`)
  const r = await db.execute({
    sql: `INSERT INTO payments (order_ref, kind, amount, currency, method, provider, provider_ref, refund_of, note, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [ref, kind, round2(Math.abs(Number(amount) || 0)), currency, method, provider || providerFor(method), providerRef, refundOf, note, userId ?? ctx.userId ?? null],
  })
  return Number(r.lastInsertRowid)
}

const rowToPayment = row => ({
  id: row.id, ref: row.order_ref, kind: row.kind, amount: row.amount, currency: row.currency, method: row.method, provider: row.provider,
  providerRef: row.provider_ref, refundOf: row.refund_of, note: row.note, userId: row.user_id, createdAt: row.created_at,
  name: row.name, email: row.email, halls: row.halls, orderStatus: row.order_status,
})

export async function listPayments(db, { kind, method, provider, ref, q, from, to, limit = 200, offset = 0 } = {}) {
  let sql = `SELECT p.*, o.name, o.email, o.halls, o.status AS order_status FROM payments p JOIN orders o ON o.ref = p.order_ref WHERE 1=1`
  const args = []
  const add = (c, v) => { sql += ` AND ${c}`; args.push(v) }
  if (kind) add('p.kind = ?', kind)
  if (method) add('p.method = ?', method)
  if (provider) add('p.provider = ?', provider)
  if (ref) add('p.order_ref = ?', String(ref).toUpperCase())
  if (from) add('p.created_at >= ?', from)
  if (to) add('p.created_at <= ?', to + (to.length === 10 ? ' 23:59:59' : ''))
  if (q) { sql += ' AND (p.order_ref LIKE ? OR o.name LIKE ? OR o.email LIKE ? OR p.provider_ref LIKE ?)'; const like = `%${q}%`; args.push(like, like, like, like) }
  sql += ' ORDER BY p.id DESC LIMIT ? OFFSET ?'; args.push(Math.min(Number(limit) || 200, 2000), Number(offset) || 0)
  const r = await db.execute({ sql, args })
  return r.rows.map(rowToPayment)
}

export async function paymentsForOrder(db, ref) {
  const r = await db.execute({ sql: 'SELECT * FROM payments WHERE order_ref = ? ORDER BY id', args: [ref] })
  return r.rows.map(rowToPayment)
}

/** Dashboard numbers for the billing page: taken, refunded, outstanding, by method, by week. */
export async function billingSummary(db) {
  const one = async (sql, args = []) => (await db.execute({ sql, args })).rows[0]
  const many = async (sql, args = []) => (await db.execute({ sql, args })).rows.map(r => ({ ...r }))
  const n = v => Number(v || 0)
  const t = await one(`SELECT
      SUM(CASE WHEN kind = 'deposit' THEN amount ELSE 0 END) AS deposits,
      SUM(CASE WHEN kind = 'deposit' THEN 1 ELSE 0 END) AS deposits_n,
      SUM(CASE WHEN kind = 'balance' THEN amount ELSE 0 END) AS balances,
      SUM(CASE WHEN kind = 'balance' THEN 1 ELSE 0 END) AS balances_n,
      SUM(CASE WHEN kind = 'refund' THEN amount ELSE 0 END) AS refunds,
      SUM(CASE WHEN kind = 'refund' THEN 1 ELSE 0 END) AS refunds_n
    FROM payments`)
  const o = await one(`SELECT
      SUM(CASE WHEN status <> 'cancelled' AND balance_status = 'due' THEN MAX(0, total - deposit - referral_credit) ELSE 0 END) AS balance_due,
      SUM(CASE WHEN status <> 'cancelled' AND balance_status = 'due' THEN 1 ELSE 0 END) AS balance_due_n,
      SUM(CASE WHEN status <> 'cancelled' AND deposit_status = 'pending' THEN deposit ELSE 0 END) AS deposits_pending,
      SUM(CASE WHEN status <> 'cancelled' AND deposit_status = 'pending' THEN 1 ELSE 0 END) AS deposits_pending_n,
      SUM(CASE WHEN status <> 'cancelled' THEN total ELSE 0 END) AS booked
    FROM orders`)
  const byMethod = await many(`SELECT COALESCE(method, 'unknown') AS method, kind, COUNT(*) AS n, SUM(amount) AS value FROM payments GROUP BY method, kind ORDER BY method, kind`)
  const byWeek = await many(`SELECT strftime('%Y-%W', created_at) AS week, MIN(date(created_at, 'weekday 0', '-6 days')) AS starts,
      SUM(CASE WHEN kind <> 'refund' THEN amount ELSE 0 END) AS taken, SUM(CASE WHEN kind = 'refund' THEN amount ELSE 0 END) AS refunded
    FROM payments GROUP BY week ORDER BY week DESC LIMIT 12`)
  const invoices = await one(`SELECT SUM(CASE WHEN type = 'invoice' THEN 1 ELSE 0 END) AS invoices, SUM(CASE WHEN type = 'credit_note' THEN 1 ELSE 0 END) AS credit_notes FROM invoices`)
  const taken = round2(n(t.deposits) + n(t.balances))
  return {
    deposits: { value: round2(n(t.deposits)), n: n(t.deposits_n) },
    balances: { value: round2(n(t.balances)), n: n(t.balances_n) },
    refunds: { value: round2(n(t.refunds)), n: n(t.refunds_n) },
    taken, net: round2(taken - n(t.refunds)),
    outstanding: { balance: round2(n(o.balance_due)), balanceN: n(o.balance_due_n), deposits: round2(n(o.deposits_pending)), depositsN: n(o.deposits_pending_n) },
    booked: round2(n(o.booked)),
    byMethod, byWeek: byWeek.reverse(),
    invoices: { invoices: n(invoices.invoices), creditNotes: n(invoices.credit_notes) },
  }
}

// ---------------------------------------------------------------- refunds

/**
 * Refund a paid deposit or balance. Card payments go back through Stripe when `refund(paymentId, amount)` is
 * injected; cash and bank refunds are recorded on trust (the admin hands the money back). Full amount by default.
 */
export async function refundOrder(ctx, order, { kind = 'deposit', amount = null, reason = '', refund = null, userId = 'admin' } = {}) {
  const db = ctx.db || getDb(ctx.env)
  if (!['deposit', 'balance'].includes(kind)) throw new BillingError('kind must be deposit or balance')
  const paid = kind === 'deposit' ? ['paid', 'kept'].includes(order.depositStatus) : order.balanceStatus === 'paid'
  if (!paid) throw new BillingError(`The ${kind} is not paid, nothing to refund`, 409)
  const ledger = (await paymentsForOrder(db, order.ref)).filter(p => p.kind === kind)
  const paidAmount = ledger.length ? ledger[ledger.length - 1].amount : (kind === 'deposit' ? order.deposit : order.balance)
  const value = round2(amount == null ? paidAmount : Number(amount))
  if (!(value > 0) || value > paidAmount + 0.005) throw new BillingError(`Refund must be between £0.01 and ${money(paidAmount)}`)
  const method = kind === 'deposit' ? order.depositMethod : order.balanceMethod
  const paymentId = kind === 'deposit' ? order.depositPaymentId : order.balancePaymentId
  let provider = 'manual', providerRef = null
  if (providerFor(method) === 'stripe' && paymentId) {
    if (!refund) throw new BillingError('Card refunds need Stripe (STRIPE_SECRET_KEY)', 503)
    const r = await refund(paymentId, value)
    provider = 'stripe'; providerRef = r?.id || null
  }
  const col = kind === 'deposit' ? 'deposit_status' : 'balance_status'
  await db.execute({ sql: `UPDATE orders SET ${col} = 'refunded', updated_at = datetime('now') WHERE ref = ?`, args: [order.ref] })
  const paymentRowId = await recordPayment({ ...ctx, db }, { ref: order.ref, kind: 'refund', amount: value, method, provider, providerRef, refundOf: kind, note: reason || null, userId })
  await logOrderEvent({ ...ctx, db, userId }, order.ref, 'refund', { kind, amount: value, provider, provider_ref: providerRef, reason })
  const creditNote = await issueDocument({ ...ctx, db }, { ...order, [kind === 'deposit' ? 'depositStatus' : 'balanceStatus']: 'refunded' }, { type: 'credit_note', amount: value, paymentId: paymentRowId, reason })
  return { kind, amount: value, provider, providerRef, paymentId: paymentRowId, creditNote }
}

// ---------------------------------------------------------------- invoices

export async function billingSettings(db) {
  return getSetting(db, 'billing', { business_name: 'Landed', address: '', email: '', phone: '', vat_number: '', invoice_prefix: 'LND-', next_number: 1, footer: '' })
}

async function nextNumber(db, type) {
  const s = await billingSettings(db)
  const seq = Number(s.next_number) || 1
  await setSetting(db, 'billing', { ...s, next_number: seq + 1 })
  return `${s.invoice_prefix || ''}${type === 'credit_note' ? 'CN-' : ''}${String(seq).padStart(4, '0')}`
}

/** Line items for a document, from the order as priced by the server. */
export function invoiceLines(order) {
  const CAT = globalThis.LANDED_CATALOGUE, names = CAT.names
  const lines = []
  if (order.kit === 'mix') {
    const price = Object.fromEntries([...CAT.items.arrival, ...CAT.items.winter])
    for (const i of order.items || []) lines.push({ description: names.item[i] || i, qty: 1, unit: price[i] ?? 0, amount: price[i] ?? 0 })
  } else lines.push({ description: names.kit[order.kit] || order.kit, qty: 1, unit: order.kitTotal, amount: order.kitTotal })
  for (const a of order.addons || []) lines.push({ description: names.addon[a.id] || a.id, qty: a.n, unit: a.price, amount: round2(a.n * a.price) })
  if (order.discount) lines.push({ description: `Referral discount${order.referral ? ` (${order.referral})` : ''}`, qty: 1, unit: -order.discount, amount: -order.discount })
  if (order.referralCredit) lines.push({ description: 'Referral credit earned', qty: 1, unit: -order.referralCredit, amount: -order.referralCredit })
  return lines
}

const rowToInvoice = row => ({ id: row.id, number: row.number, ref: row.order_ref, type: row.type, amount: row.amount, currency: row.currency, issuedAt: row.issued_at, data: JSON.parse(row.data || '{}'), name: row.name, email: row.email })

/**
 * Issue a document. One invoice per order (re-issuing returns the existing one); a credit note per refund.
 * The snapshot in `data` is what gets printed, so later edits to the order do not rewrite history.
 */
export async function issueDocument(ctx, order, { type = 'invoice', amount = null, paymentId = null, reason = '', userId = 'admin' } = {}) {
  const db = ctx.db || getDb(ctx.env)
  if (!INVOICE_TYPES.includes(type)) throw new BillingError(`Bad document type ${type}`)
  if (type === 'invoice') {
    const existing = await db.execute({ sql: `SELECT * FROM invoices WHERE order_ref = ? AND type = 'invoice' LIMIT 1`, args: [order.ref] })
    if (existing.rows.length) return rowToInvoice(existing.rows[0])
  }
  const payments = await paymentsForOrder(db, order.ref)
  const settings = await billingSettings(db)
  const lines = invoiceLines(order)
  const total = round2(lines.reduce((s, l) => s + l.amount, 0))
  const paid = round2(payments.filter(p => p.kind !== 'refund').reduce((s, p) => s + p.amount, 0) - payments.filter(p => p.kind === 'refund').reduce((s, p) => s + p.amount, 0))
  const value = type === 'credit_note' ? round2(Number(amount) || 0) : total
  const number = await nextNumber(db, type)
  const data = {
    business: { name: settings.business_name, address: settings.address, email: settings.email, phone: settings.phone, vat_number: settings.vat_number, footer: settings.footer },
    customer: { name: order.name, email: order.email, phone: order.phone, halls: order.halls, building: order.building, uni: order.uni },
    order: { ref: order.ref, placedAt: order.createdAt, arrival: order.arrival, kit: order.kit, status: order.status, depositStatus: order.depositStatus, balanceStatus: order.balanceStatus },
    lines, total, paid, outstanding: round2(Math.max(0, total - paid)), payments, reason: reason || null, refundsPayment: paymentId,
  }
  const r = await db.execute({
    sql: `INSERT INTO invoices (number, order_ref, type, amount, currency, data) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [number, order.ref, type, value, order.currency || 'GBP', JSON.stringify(data)],
  })
  await logOrderEvent({ ...ctx, db, userId }, order.ref, type === 'invoice' ? 'invoice_issued' : 'credit_note_issued', { number, amount: value })
  return rowToInvoice({ id: Number(r.lastInsertRowid), number, order_ref: order.ref, type, amount: value, currency: order.currency || 'GBP', issued_at: new Date().toISOString().replace('T', ' ').slice(0, 19), data: JSON.stringify(data) })
}

export async function getInvoice(db, number) {
  const r = await db.execute({ sql: 'SELECT i.*, o.name, o.email FROM invoices i JOIN orders o ON o.ref = i.order_ref WHERE i.number = ?', args: [number] })
  return r.rows.length ? rowToInvoice(r.rows[0]) : null
}

export async function listInvoices(db, { type, ref, q, from, to, limit = 200 } = {}) {
  let sql = 'SELECT i.*, o.name, o.email FROM invoices i JOIN orders o ON o.ref = i.order_ref WHERE 1=1'
  const args = []
  const add = (c, v) => { sql += ` AND ${c}`; args.push(v) }
  if (type) add('i.type = ?', type)
  if (ref) add('i.order_ref = ?', String(ref).toUpperCase())
  if (from) add('i.issued_at >= ?', from)
  if (to) add('i.issued_at <= ?', to + (to.length === 10 ? ' 23:59:59' : ''))
  if (q) { sql += ' AND (i.number LIKE ? OR i.order_ref LIKE ? OR o.name LIKE ? OR o.email LIKE ?)'; const like = `%${q}%`; args.push(like, like, like, like) }
  sql += ' ORDER BY i.id DESC LIMIT ?'; args.push(Math.min(Number(limit) || 200, 2000))
  const r = await db.execute({ sql, args })
  return r.rows.map(rowToInvoice)
}

const longDate = iso => iso ? new Date((iso.length === 10 ? iso + 'T12:00:00Z' : iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'))).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''

/** Printable HTML for an invoice or credit note. Self-contained: inline styles, no scripts. */
export function renderInvoiceHtml(inv) {
  const d = inv.data, b = d.business || {}, c = d.customer || {}, o = d.order || {}
  const isCredit = inv.type === 'credit_note'
  const title = isCredit ? 'Credit note' : d.outstanding > 0 ? 'Invoice' : 'Invoice · paid'
  const lines = (d.lines || []).map(l => `<tr><td>${esc(l.description)}</td><td class="n">${l.qty}</td><td class="n">${money(l.unit)}</td><td class="n">${money(l.amount)}</td></tr>`).join('')
  const pays = (d.payments || []).map(p => `<tr><td>${esc(longDate(p.createdAt))}</td><td>${esc(p.kind === 'refund' ? `Refund of ${p.refundOf}` : p.kind)}</td><td>${esc(p.method || '')}${p.provider === 'stripe' ? ' · Stripe' : ''}${p.providerRef ? ` <span class="mono">${esc(p.providerRef)}</span>` : ''}</td><td class="n">${p.kind === 'refund' ? '−' : ''}${money(p.amount)}</td></tr>`).join('')
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(title)} ${esc(inv.number)}</title>
<style>
  body{margin:0;padding:32px;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1B2430;background:#fff}
  .sheet{max-width:760px;margin:0 auto}
  header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:28px}
  .brand{font-weight:800;font-size:24px;letter-spacing:-.02em}.brand span{color:#F0A030;font-weight:500;font-size:14px}
  h1{font-size:20px;margin:0 0 4px}.muted{color:#5F6D79}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#5F6D79;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;margin-bottom:22px}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #D8DFE5;vertical-align:top}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5F6D79;background:#EEF1F4}.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  tfoot td{border-bottom:0}.total td{font-weight:800;font-size:16px;border-top:2px solid #1B2430}
  .stamp{display:inline-block;padding:4px 10px;border:2px solid #1F7A4D;color:#1F7A4D;border-radius:6px;font-weight:800;letter-spacing:.06em}
  .stamp.due{border-color:#D98A12;color:#D98A12}.stamp.credit{border-color:#B3261E;color:#B3261E}
  footer{margin-top:32px;padding-top:12px;border-top:1px solid #D8DFE5;color:#5F6D79;font-size:12px}
  @media print{body{padding:0}.no-print{display:none}}
</style></head><body><div class="sheet">
<header>
  <div><div class="brand">${esc(b.name || 'Landed')} <span>Aberdeen</span></div><div class="muted">${esc(b.address || '')}${b.email ? '<br>' + esc(b.email) : ''}${b.phone ? '<br>' + esc(b.phone) : ''}${b.vat_number ? '<br>VAT ' + esc(b.vat_number) : ''}</div></div>
  <div style="text-align:right"><h1>${esc(title)}</h1><div class="mono">${esc(inv.number)}</div><div class="muted">${esc(longDate(inv.issuedAt))}</div>
    <div style="margin-top:8px">${isCredit ? '<span class="stamp credit">CREDIT NOTE</span>' : d.outstanding > 0 ? `<span class="stamp due">${esc(money(d.outstanding))} DUE</span>` : '<span class="stamp">PAID</span>'}</div></div>
</header>
<div class="cols">
  <div><h2>Billed to</h2><b>${esc(c.name)}</b><br>${esc(c.email || '')}${c.phone ? '<br>' + esc(c.phone) : ''}<br><span class="muted">${esc([c.halls, c.building].filter(Boolean).join(', '))}</span></div>
  <div><h2>Order</h2>Reference <b class="mono">${esc(o.ref)}</b><br>Placed ${esc(longDate(o.placedAt))}<br>Check-in ${esc(longDate(o.arrival))}${d.reason ? `<br><span class="muted">${esc(d.reason)}</span>` : ''}</div>
</div>
${isCredit ? `<table><thead><tr><th>Description</th><th class="n">Amount</th></tr></thead><tbody><tr><td>Refund of the ${esc((d.payments || []).find(p => p.id === d.refundsPayment)?.refundOf || 'payment')} on order ${esc(o.ref)}</td><td class="n">${money(inv.amount)}</td></tr></tbody><tfoot><tr class="total"><td>Credited</td><td class="n">${money(inv.amount)}</td></tr></tfoot></table>`
  : `<table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Amount</th></tr></thead><tbody>${lines}</tbody>
<tfoot><tr class="total"><td colspan="3">Total</td><td class="n">${money(d.total)}</td></tr><tr><td colspan="3" class="muted">Paid</td><td class="n">${money(d.paid)}</td></tr><tr><td colspan="3" class="muted">Outstanding, payable at the door by card or cash</td><td class="n">${money(d.outstanding)}</td></tr></tfoot></table>`}
${pays ? `<h2>Payments</h2><table><thead><tr><th>Date</th><th>Kind</th><th>Method</th><th class="n">Amount</th></tr></thead><tbody>${pays}</tbody></table>` : ''}
<footer>${esc(b.footer || '')}</footer>
<p class="no-print" style="text-align:center;margin-top:24px"><button onclick="print()" style="font:inherit;padding:8px 16px;border-radius:999px;border:1px solid #D8DFE5;background:#fff;cursor:pointer">Print / save as PDF</button></p>
</div></body></html>`
}
