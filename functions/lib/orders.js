/**
 * Landed order model: pricing, reservation, deposit/balance, deliveries, referrals, cancellation.
 * Structure follows shima.shop functions/lib/orders.js (ctx = { db, env, request }, audit on every touch);
 * the domain is Landed's: a kit reserved with a deposit, delivered to a halls room, balance at the door.
 */
import '../../web/catalogue.js'
import { getDb, getSetting } from './db.js'
import { logOrderEvent } from './order-events.js'
import { recordPayment, providerFor } from './billing.js'

const CAT = globalThis.LANDED_CATALOGUE
export const CATALOGUE = CAT

export const ORDER_STATUSES = ['reserved', 'confirmed', 'delivered', 'closed', 'cancelled']
export const DEPOSIT_STATUSES = ['pending', 'paid', 'refunded', 'kept', 'void']
export const BALANCE_STATUSES = ['due', 'paid', 'waived', 'refunded']
export const DELIVERY_STATUSES = ['planned', 'packed', 'delivered', 'reception', 'failed', 'cancelled']

const REF_RE = /^LND-[A-Z0-9]{4}$/
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I
const round2 = n => Math.round(n * 100) / 100

export class OrderError extends Error {
  constructor(message, status = 400, field = null) { super(message); this.status = status; this.field = field }
}

function newRef() {
  const bytes = new Uint8Array(4); crypto.getRandomValues(bytes)
  return 'LND-' + Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

export const normalizeRef = s => String(s || '').trim().toUpperCase()
export const isRef = s => REF_RE.test(normalizeRef(s))

const itemPrice = Object.fromEntries([...CAT.items.arrival, ...CAT.items.winter])
const arrivalIds = new Set(CAT.items.arrival.map(i => i[0]))
const winterIds = new Set(CAT.items.winter.map(i => i[0]))
const addonById = Object.fromEntries(CAT.addons.map(a => [a.id, a]))

/** Server-side pricing. Throws OrderError on an invalid basket. */
export function priceOrder({ kit, items = [], addons = [] }, { referralValid = false } = {}) {
  if (!CAT.kits[kit]) throw new OrderError('Unknown kit', 400, 'kit')
  let kitTotal = CAT.kits[kit].price
  let cleanItems = []
  if (kit === 'mix') {
    cleanItems = [...new Set((items || []).map(String))].filter(id => itemPrice[id] != null)
    kitTotal = cleanItems.reduce((s, id) => s + itemPrice[id], 0)
    if (kitTotal < CAT.mixMinimum) throw new OrderError(`Mix and match orders start at £${CAT.mixMinimum}`, 400, 'items')
  }
  const cleanAddons = []
  for (const a of addons || []) {
    const def = addonById[a?.id]; const n = Math.max(0, Math.min(CAT.addonMax, Number(a?.n) || 0))
    if (def && n > 0) cleanAddons.push({ id: def.id, n, price: def.price })
  }
  const addonsTotal = cleanAddons.reduce((s, a) => s + a.price * a.n, 0)
  const discount = referralValid ? CAT.referralDiscount : 0
  const total = round2(Math.max(0, kitTotal + addonsTotal - discount))
  const deposit = Math.min(CAT.deposit, total)
  return { kit, items: cleanItems, addons: cleanAddons, kitTotal, addonsTotal, discount, total, deposit }
}

/** Referral codes are order refs. Valid when the order exists, is live, and belongs to someone else. */
export async function checkReferral(db, code, { email } = {}) {
  const ref = normalizeRef(code)
  if (!ref) return { valid: false, reason: 'empty' }
  if (!REF_RE.test(ref)) return { valid: false, reason: 'format' }
  const r = await db.execute({ sql: 'SELECT ref, email, status FROM orders WHERE ref = ?', args: [ref] })
  if (!r.rows.length) return { valid: false, reason: 'unknown' }
  const row = r.rows[0]
  if (row.status === 'cancelled') return { valid: false, reason: 'cancelled' }
  if (email && String(row.email).toLowerCase() === String(email).toLowerCase()) return { valid: false, reason: 'own' }
  return { valid: true, ref, discount: CAT.referralDiscount }
}

function validateCustomer(input) {
  const name = String(input.name || '').trim()
  const email = String(input.email || '').trim().toLowerCase()
  const phone = String(input.phone || '').trim()
  const arrival = String(input.arrival || input.arrival_date || '').trim()
  if (name.length < 2) throw new OrderError('We need a name for the label on the box', 400, 'name')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OrderError('Enter a valid email address', 400, 'email')
  if (phone.replace(/\D/g, '').length < 9) throw new OrderError('Enter a phone number with the country code', 400, 'phone')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrival) || Number.isNaN(Date.parse(arrival + 'T12:00:00Z'))) throw new OrderError('Tell us the day you check in', 400, 'arrival')
  const uni = CAT.unis.includes(input.uni) ? input.uni : 'Other'
  const halls = CAT.halls.includes(input.halls) ? input.halls : 'Private flat'
  return {
    name, email, phone, arrival, uni, halls,
    building: String(input.building || '').trim().slice(0, 200),
    from: String(input.from || input.from_country || '').trim().slice(0, 100),
    notes: String(input.notes || '').trim().slice(0, 2000),
    lang: String(input.lang || 'en').slice(0, 8),
    storageInterest: !!(input.storageInterest ?? input.storage_interest),
  }
}

export async function winterDeliveryDate(db) {
  const g = await getSetting(db, 'general', {})
  return g.winter_delivery_date || CAT.winterDelivery
}

/** Which physical drops an order needs. */
export function planDeliveries(order, winterDate) {
  const out = []
  const hasArrival = order.kit === 'arrival' || order.kit === 'both' || (order.kit === 'mix' && order.items.some(i => arrivalIds.has(i)))
  const hasWinter = order.kit === 'winter' || order.kit === 'both' || (order.kit === 'mix' && order.items.some(i => winterIds.has(i)))
  const addonsOnly = !hasArrival && !hasWinter && order.addons.length > 0
  if (hasArrival || addonsOnly) out.push({ kind: 'arrival', scheduled_date: order.arrival })
  if (hasWinter) {
    // a winter kit is delivered on the October run, or on check-in day if the student arrives after it
    const date = order.arrival > winterDate ? order.arrival : winterDate
    out.push({ kind: 'winter', scheduled_date: date })
  }
  return out
}

/** Create a reservation from the order page payload. */
export async function createOrder(ctx, input) {
  const db = ctx.db || getDb(ctx.env)
  const customer = validateCustomer(input)
  const referral = input.referral ? await checkReferral(db, input.referral, { email: customer.email }) : { valid: false, reason: 'empty' }
  const priced = priceOrder({ kit: input.kit, items: input.items, addons: input.addons }, { referralValid: referral.valid })

  let ref = null
  for (let i = 0; i < 8 && !ref; i++) {
    const candidate = newRef()
    const dup = await db.execute({ sql: 'SELECT 1 FROM orders WHERE ref = ?', args: [candidate] })
    if (!dup.rows.length) ref = candidate
  }
  if (!ref) throw new OrderError('Could not allocate a reference, try again', 500)

  await db.execute({
    sql: `INSERT INTO orders (ref, status, kit, items, addons, currency, kit_total, addons_total, discount, total, deposit,
            referral_used, storage_interest, uni, halls, building, arrival_date, name, email, phone, from_country, notes, lang, data)
          VALUES (?, 'reserved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [ref, priced.kit, JSON.stringify(priced.items), JSON.stringify(priced.addons), CAT.currency,
      priced.kitTotal, priced.addonsTotal, priced.discount, priced.total, priced.deposit,
      referral.valid ? referral.ref : null, customer.storageInterest ? 1 : 0, customer.uni, customer.halls, customer.building,
      customer.arrival, customer.name, customer.email, customer.phone, customer.from, customer.notes, customer.lang,
      JSON.stringify({ referral_typed: input.referral || null, referral_reason: referral.reason || null, placed_at: input.placedAt || null, client_ref: input.ref || null })],
  })
  const winterDate = await winterDeliveryDate(db)
  for (const d of planDeliveries({ ...priced, arrival: customer.arrival }, winterDate)) {
    await db.execute({ sql: 'INSERT INTO deliveries (order_ref, kind, scheduled_date) VALUES (?, ?, ?)', args: [ref, d.kind, d.scheduled_date] })
  }
  if (referral.valid) {
    await db.execute({ sql: `UPDATE orders SET referral_credit = referral_credit + ?, updated_at = datetime('now') WHERE ref = ?`, args: [CAT.referralCredit, referral.ref] })
    await logOrderEvent(ctx, referral.ref, 'referral_credit', { from: ref, credit: CAT.referralCredit })
  }
  await logOrderEvent(ctx, ref, 'order_created', { kit: priced.kit, total: priced.total, deposit: priced.deposit, referral: referral.valid ? referral.ref : null, halls: customer.halls, arrival: customer.arrival })
  return getOrder(ctx, ref, { audit: false })
}

function rowToOrder(row, deliveries = []) {
  const o = {
    ref: row.ref, status: row.status, kit: row.kit,
    items: JSON.parse(row.items || '[]'), addons: JSON.parse(row.addons || '[]'),
    currency: row.currency, kitTotal: row.kit_total, addonsTotal: row.addons_total, discount: row.discount,
    total: row.total, deposit: row.deposit,
    depositStatus: row.deposit_status, depositMethod: row.deposit_method, depositPaymentId: row.deposit_payment_id, depositPaidAt: row.deposit_paid_at,
    balanceStatus: row.balance_status, balanceMethod: row.balance_method, balancePaymentId: row.balance_payment_id, balancePaidAt: row.balance_paid_at,
    referral: row.referral_used, referralCredit: row.referral_credit, storageInterest: !!row.storage_interest,
    uni: row.uni, halls: row.halls, building: row.building, arrival: row.arrival_date,
    name: row.name, email: row.email, phone: row.phone, from: row.from_country, notes: row.notes, lang: row.lang,
    adminNotes: row.admin_notes, cancelledAt: row.cancelled_at, cancelReason: row.cancel_reason,
    data: JSON.parse(row.data || '{}'), createdAt: row.created_at, updatedAt: row.updated_at,
    deliveries,
  }
  o.balance = round2(Math.max(0, o.total - o.deposit - (o.referralCredit || 0)))
  return o
}

/** Customer-facing view: no admin notes, no payment ids, no raw data. */
export function publicOrder(o) {
  if (!o) return null
  const { adminNotes, data, depositPaymentId, balancePaymentId, ...rest } = o
  return { ...rest, deliveries: (o.deliveries || []).map(d => ({ kind: d.kind, date: d.scheduled_date, status: d.status })) }
}

export async function getOrder(ctx, ref, { audit = true } = {}) {
  const db = ctx.db || getDb(ctx.env)
  ref = normalizeRef(ref)
  const r = await db.execute({ sql: 'SELECT * FROM orders WHERE ref = ?', args: [ref] })
  if (!r.rows.length) return null
  const d = await db.execute({ sql: 'SELECT * FROM deliveries WHERE order_ref = ? ORDER BY scheduled_date, id', args: [ref] })
  if (audit) await logOrderEvent(ctx, ref, 'order_accessed', { action: 'get' })
  return rowToOrder(r.rows[0], d.rows.map(x => ({ ...x })))
}

export async function listOrders(db, opts = {}) {
  const { status, depositStatus, balanceStatus, halls, kit, q, from, to, arrivalFrom, arrivalTo, storage, limit = 100, offset = 0 } = opts
  let sql = `SELECT o.*, (SELECT COUNT(*) FROM deliveries d WHERE d.order_ref = o.ref AND d.status IN ('planned','packed')) AS open_deliveries FROM orders o WHERE 1=1`
  const args = []
  const add = (cond, v) => { sql += ` AND ${cond}`; args.push(v) }
  if (status) add('o.status = ?', status)
  if (depositStatus) add('o.deposit_status = ?', depositStatus)
  if (balanceStatus) add('o.balance_status = ?', balanceStatus)
  if (halls) add('o.halls = ?', halls)
  if (kit) add('o.kit = ?', kit)
  if (from) add('o.created_at >= ?', from)
  if (to) add('o.created_at <= ?', to)
  if (arrivalFrom) add('o.arrival_date >= ?', arrivalFrom)
  if (arrivalTo) add('o.arrival_date <= ?', arrivalTo)
  if (storage) add('o.storage_interest = ?', 1)
  if (q) { sql += ' AND (o.ref LIKE ? OR o.name LIKE ? OR o.email LIKE ? OR o.phone LIKE ? OR o.building LIKE ?)'; const like = `%${q}%`; args.push(like, like, like, like, like) }
  sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'; args.push(Math.min(Number(limit) || 100, 1000), Number(offset) || 0)
  const r = await db.execute({ sql, args })
  return r.rows.map(row => ({ ...rowToOrder(row), openDeliveries: row.open_deliveries }))
}

const ADMIN_FIELDS = {
  status: 'status', deposit_status: 'deposit_status', deposit_method: 'deposit_method', deposit_payment_id: 'deposit_payment_id',
  balance_status: 'balance_status', balance_method: 'balance_method', balance_payment_id: 'balance_payment_id',
  uni: 'uni', halls: 'halls', building: 'building', arrival_date: 'arrival_date', arrival: 'arrival_date',
  name: 'name', email: 'email', phone: 'phone', notes: 'notes', admin_notes: 'admin_notes',
  storage_interest: 'storage_interest', referral_credit: 'referral_credit', from_country: 'from_country',
}

/**
 * Admin update. Returns { order, transitions } where transitions lists side effects the caller
 * should notify about: 'deposit_paid', 'balance_paid', 'cancelled'.
 */
export async function updateOrder(ctx, ref, updates, { userId = 'admin' } = {}) {
  const db = ctx.db || getDb(ctx.env)
  ref = normalizeRef(ref)
  const before = await getOrder({ ...ctx, db }, ref, { audit: false })
  if (!before) throw new OrderError('Order not found', 404)
  const set = [], args = [], changed = {}
  for (const [k, v] of Object.entries(updates || {})) {
    const col = ADMIN_FIELDS[k]; if (!col || v === undefined) continue
    if (col === 'status' && !ORDER_STATUSES.includes(v)) throw new OrderError(`Bad status ${v}`)
    if (col === 'deposit_status' && !DEPOSIT_STATUSES.includes(v)) throw new OrderError(`Bad deposit status ${v}`)
    if (col === 'balance_status' && !BALANCE_STATUSES.includes(v)) throw new OrderError(`Bad balance status ${v}`)
    if (col === 'arrival_date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new OrderError('Bad arrival date')
    const val = col === 'storage_interest' ? (v ? 1 : 0) : col === 'referral_credit' ? Number(v) || 0 : v == null ? null : String(v)
    set.push(`${col} = ?`); args.push(val); changed[col] = val
  }
  const transitions = []
  if (changed.deposit_status === 'paid' && before.depositStatus !== 'paid') { set.push("deposit_paid_at = datetime('now')"); transitions.push('deposit_paid') }
  if (changed.balance_status === 'paid' && before.balanceStatus !== 'paid') {
    set.push("balance_paid_at = datetime('now')"); transitions.push('balance_paid')
    if (!changed.status && before.status === 'delivered') { set.push('status = ?'); args.push('closed'); changed.status = 'closed' }
  }
  if (changed.status === 'cancelled' && before.status !== 'cancelled') { set.push("cancelled_at = datetime('now')"); transitions.push('cancelled') }
  if (!set.length) throw new OrderError('No valid updates')
  set.push("updated_at = datetime('now')"); args.push(ref)
  await db.execute({ sql: `UPDATE orders SET ${set.join(', ')} WHERE ref = ?`, args })
  const ledger = { ...ctx, db, userId }
  if (transitions.includes('deposit_paid')) await recordPayment(ledger, { ref, kind: 'deposit', amount: before.deposit, currency: before.currency, method: changed.deposit_method ?? before.depositMethod ?? null, providerRef: changed.deposit_payment_id ?? before.depositPaymentId ?? null, userId })
  if (transitions.includes('balance_paid')) await recordPayment(ledger, { ref, kind: 'balance', amount: before.balance, currency: before.currency, method: changed.balance_method ?? before.balanceMethod ?? null, providerRef: changed.balance_payment_id ?? before.balancePaymentId ?? null, userId })
  if (changed.deposit_status === 'refunded' && ['paid', 'kept'].includes(before.depositStatus)) await recordPayment(ledger, { ref, kind: 'refund', refundOf: 'deposit', amount: before.deposit, currency: before.currency, method: before.depositMethod, provider: 'manual', note: 'Recorded by hand in the order form', userId })
  if (changed.balance_status === 'refunded' && before.balanceStatus === 'paid') await recordPayment(ledger, { ref, kind: 'refund', refundOf: 'balance', amount: before.balance, currency: before.currency, method: before.balanceMethod, provider: 'manual', note: 'Recorded by hand in the order form', userId })
  if (changed.arrival_date && changed.arrival_date !== before.arrival) {
    await db.execute({ sql: `UPDATE deliveries SET scheduled_date = ?, updated_at = datetime('now') WHERE order_ref = ? AND kind = 'arrival' AND status IN ('planned','packed')`, args: [changed.arrival_date, ref] })
  }
  if (changed.status === 'cancelled') {
    await db.execute({ sql: `UPDATE deliveries SET status = 'cancelled', updated_at = datetime('now') WHERE order_ref = ? AND status IN ('planned','packed')`, args: [ref] })
  }
  await logOrderEvent({ ...ctx, userId }, ref, 'order_updated', { changes: changed, transitions })
  return { order: await getOrder({ ...ctx, db }, ref, { audit: false }), transitions, before }
}

/** Idempotent: record a paid deposit (webhook, success page or admin cash entry). Returns true when it changed. */
export async function markDepositPaid(ctx, ref, { method = 'card', paymentId = null, userId = null } = {}) {
  const db = ctx.db || getDb(ctx.env)
  ref = normalizeRef(ref)
  const r = await db.execute({
    sql: `UPDATE orders SET deposit_status = 'paid', deposit_method = ?, deposit_payment_id = COALESCE(?, deposit_payment_id),
          deposit_paid_at = datetime('now'), updated_at = datetime('now') WHERE ref = ? AND deposit_status <> 'paid'`,
    args: [method, paymentId, ref],
  })
  const changed = r.rowsAffected > 0
  if (changed) {
    const o = (await db.execute({ sql: 'SELECT deposit, currency FROM orders WHERE ref = ?', args: [ref] })).rows[0]
    await recordPayment({ ...ctx, db }, { ref, kind: 'deposit', amount: o.deposit, currency: o.currency, method, provider: providerFor(method), providerRef: paymentId, userId: userId || (method === 'card' ? 'stripe' : null) })
    await logOrderEvent({ ...ctx, userId }, ref, 'deposit_paid', { method, payment_id: paymentId })
  }
  return changed
}

export async function markBalancePaid(ctx, ref, { method = 'card', paymentId = null, userId = null } = {}) {
  const db = ctx.db || getDb(ctx.env)
  ref = normalizeRef(ref)
  const r = await db.execute({
    sql: `UPDATE orders SET balance_status = 'paid', balance_method = ?, balance_payment_id = COALESCE(?, balance_payment_id),
          balance_paid_at = datetime('now'), status = CASE WHEN status = 'delivered' THEN 'closed' ELSE status END, updated_at = datetime('now')
          WHERE ref = ? AND balance_status <> 'paid'`,
    args: [method, paymentId, ref],
  })
  const changed = r.rowsAffected > 0
  if (changed) {
    const o = (await db.execute({ sql: 'SELECT total, deposit, referral_credit, currency FROM orders WHERE ref = ?', args: [ref] })).rows[0]
    await recordPayment({ ...ctx, db }, { ref, kind: 'balance', amount: round2(Math.max(0, o.total - o.deposit - (o.referral_credit || 0))), currency: o.currency, method, provider: providerFor(method), providerRef: paymentId, userId: userId || (method === 'card' ? 'stripe' : null) })
    await logOrderEvent({ ...ctx, userId }, ref, 'balance_paid', { method, payment_id: paymentId })
  }
  return changed
}

export function daysUntil(dateStr, now = new Date()) {
  const d = new Date(dateStr + 'T12:00:00Z'), t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12))
  return Math.round((d - t) / 86400000)
}

/**
 * Cancel. Customers get a free cancellation up to `freeCancelDays` before check-in; inside that the deposit is kept.
 * `refund(paymentId, amount)` is injected by the route so this module stays free of Stripe.
 */
export async function cancelOrder(ctx, ref, { reason = '', by = 'customer', force = false, refund = null, userId = null } = {}) {
  const db = ctx.db || getDb(ctx.env)
  ref = normalizeRef(ref)
  const order = await getOrder({ ...ctx, db }, ref, { audit: false })
  if (!order) throw new OrderError('Order not found', 404)
  if (order.status === 'cancelled') return { order, depositOutcome: order.depositStatus, refunded: false, alreadyCancelled: true }
  if (['delivered', 'closed'].includes(order.status) && !force) throw new OrderError('This order has already been delivered', 409)
  const days = daysUntil(order.arrival)
  const refundable = force || days >= CAT.freeCancelDays
  let depositOutcome = order.depositStatus, refunded = false, refundError = null, refundRef = null
  if (order.depositStatus === 'pending') depositOutcome = 'void'
  else if (order.depositStatus === 'paid') {
    if (refundable) {
      if (order.depositMethod === 'card' && order.depositPaymentId && refund) {
        try { const r = await refund(order.depositPaymentId, order.deposit); refundRef = r?.id || null; refunded = true; depositOutcome = 'refunded' }
        catch (err) { refundError = err.message; depositOutcome = 'paid' } // keep 'paid' so admin sees a manual refund is due
      } else depositOutcome = 'refunded' // cash/bank: admin refunds by hand; recorded as refunded on trust
    } else depositOutcome = 'kept'
  }
  if (depositOutcome === 'refunded') await recordPayment({ ...ctx, db }, { ref, kind: 'refund', refundOf: 'deposit', amount: order.deposit, currency: order.currency, method: order.depositMethod, provider: refunded ? 'stripe' : 'manual', providerRef: refundRef, note: `Cancelled (${by})${reason ? ': ' + reason : ''}`, userId: userId || by })
  await db.execute({
    sql: `UPDATE orders SET status = 'cancelled', deposit_status = ?, cancelled_at = datetime('now'), cancel_reason = ?, updated_at = datetime('now') WHERE ref = ?`,
    args: [depositOutcome, `${by}: ${reason || ''}`.trim(), ref],
  })
  await db.execute({ sql: `UPDATE deliveries SET status = 'cancelled', updated_at = datetime('now') WHERE order_ref = ? AND status IN ('planned','packed')`, args: [ref] })
  await logOrderEvent({ ...ctx, userId }, ref, 'order_cancelled', { by, reason, days_before_checkin: days, refundable, deposit_outcome: depositOutcome, refunded, refund_error: refundError })
  return { order: await getOrder({ ...ctx, db }, ref, { audit: false }), depositOutcome, refunded, refundError, refundable, days }
}

// ---------------------------------------------------------------- deliveries

export async function listDeliveries(db, { date, from, to, halls, status, kind, limit = 500 } = {}) {
  let sql = `SELECT d.*, o.name, o.phone, o.email, o.kit, o.items, o.addons, o.halls, o.building, o.uni, o.notes, o.total, o.deposit, o.deposit_status,
                    o.balance_status, o.referral_credit, o.status AS order_status, o.lang
             FROM deliveries d JOIN orders o ON o.ref = d.order_ref WHERE 1=1`
  const args = []
  const add = (c, v) => { sql += ` AND ${c}`; args.push(v) }
  if (date) add('d.scheduled_date = ?', date)
  if (from) add('d.scheduled_date >= ?', from)
  if (to) add('d.scheduled_date <= ?', to)
  if (halls) add('o.halls = ?', halls)
  if (status) add('d.status = ?', status)
  if (kind) add('d.kind = ?', kind)
  sql += ' ORDER BY d.scheduled_date, o.halls, o.building, d.id LIMIT ?'; args.push(Math.min(Number(limit) || 500, 2000))
  const r = await db.execute({ sql, args })
  return r.rows.map(row => {
    const items = JSON.parse(row.items || '[]'), addons = JSON.parse(row.addons || '[]')
    const balance = round2(Math.max(0, row.total - row.deposit - (row.referral_credit || 0)))
    return {
      id: row.id, ref: row.order_ref, kind: row.kind, date: row.scheduled_date, status: row.status, note: row.note,
      deliveredAt: row.delivered_at, reminderSentAt: row.reminder_sent_at,
      name: row.name, phone: row.phone, email: row.email, kit: row.kit, items, addons, halls: row.halls, building: row.building, uni: row.uni,
      notes: row.notes, total: row.total, deposit: row.deposit, depositStatus: row.deposit_status, balance, balanceStatus: row.balance_status,
      orderStatus: row.order_status, lang: row.lang,
      contents: deliveryContents(row.kit, items, addons, row.kind),
    }
  })
}

/** What goes in the box for this drop, in English, for the packing list. */
export function deliveryContents(kit, items, addons, kind) {
  const names = CAT.names
  let lines = []
  const arrivalList = CAT.items.arrival.map(i => i[0]), winterList = CAT.items.winter.map(i => i[0])
  if (kind === 'arrival') {
    if (kit === 'arrival' || kit === 'both') lines = arrivalList.map(i => names.item[i])
    else if (kit === 'mix') lines = items.filter(i => arrivalIds.has(i)).map(i => names.item[i])
  } else if (kind === 'winter') {
    if (kit === 'winter' || kit === 'both') lines = winterList.map(i => names.item[i])
    else if (kit === 'mix') lines = items.filter(i => winterIds.has(i)).map(i => names.item[i])
  }
  // add-ons ride with the first drop
  const addonsHere = kind === 'arrival' || (kind === 'winter' && !(kit === 'arrival' || kit === 'both' || (kit === 'mix' && items.some(i => arrivalIds.has(i)))))
  if (addonsHere) lines.push(...addons.map(a => `${a.n} × ${names.addon[a.id] || a.id}`))
  return lines
}

export async function updateDelivery(ctx, id, { status, note, scheduled_date, userId = 'admin' } = {}) {
  const db = ctx.db || getDb(ctx.env)
  const cur = await db.execute({ sql: 'SELECT * FROM deliveries WHERE id = ?', args: [id] })
  if (!cur.rows.length) throw new OrderError('Delivery not found', 404)
  const d = cur.rows[0]
  const set = [], args = []
  if (status) { if (!DELIVERY_STATUSES.includes(status)) throw new OrderError(`Bad delivery status ${status}`); set.push('status = ?'); args.push(status) }
  if (note !== undefined) { set.push('note = ?'); args.push(note == null ? null : String(note).slice(0, 500)) }
  if (scheduled_date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date)) throw new OrderError('Bad date'); set.push('scheduled_date = ?'); args.push(scheduled_date) }
  const done = status === 'delivered' || status === 'reception'
  if (done && !d.delivered_at) set.push("delivered_at = datetime('now')")
  if (!set.length) throw new OrderError('No valid updates')
  set.push("updated_at = datetime('now')"); args.push(id)
  await db.execute({ sql: `UPDATE deliveries SET ${set.join(', ')} WHERE id = ?`, args })
  const transitions = []
  if (done && !['delivered', 'reception'].includes(d.status)) {
    transitions.push('delivered')
    const open = await db.execute({ sql: `SELECT COUNT(*) AS n FROM deliveries WHERE order_ref = ? AND status IN ('planned','packed','failed')`, args: [d.order_ref] })
    if (Number(open.rows[0].n) === 0) {
      await db.execute({ sql: `UPDATE orders SET status = CASE WHEN balance_status = 'paid' THEN 'closed' ELSE 'delivered' END, updated_at = datetime('now') WHERE ref = ? AND status NOT IN ('cancelled','closed')`, args: [d.order_ref] })
      transitions.push('all_delivered')
    }
  }
  await logOrderEvent({ ...ctx, userId }, d.order_ref, 'delivery_updated', { delivery_id: id, kind: d.kind, status, note, scheduled_date, transitions })
  return { ref: d.order_ref, kind: d.kind, transitions }
}

// ---------------------------------------------------------------- stats

export async function stats(db, { target = 50, targetDate = '2027-07-31' } = {}) {
  const one = async (sql, args = []) => (await db.execute({ sql, args })).rows[0]
  const many = async (sql, args = []) => (await db.execute({ sql, args })).rows.map(r => ({ ...r }))
  const totals = await one(`SELECT COUNT(*) AS orders,
      SUM(CASE WHEN status <> 'cancelled' THEN 1 ELSE 0 END) AS live,
      SUM(CASE WHEN deposit_status = 'paid' THEN 1 ELSE 0 END) AS deposits_paid,
      SUM(CASE WHEN deposit_status = 'paid' THEN deposit ELSE 0 END) AS deposits_value,
      SUM(CASE WHEN status <> 'cancelled' THEN total ELSE 0 END) AS booked_value,
      SUM(CASE WHEN balance_status = 'paid' THEN total - deposit - referral_credit ELSE 0 END) AS balance_collected,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN storage_interest = 1 AND status <> 'cancelled' THEN 1 ELSE 0 END) AS storage_interest,
      SUM(CASE WHEN referral_used IS NOT NULL AND status <> 'cancelled' THEN 1 ELSE 0 END) AS referred
    FROM orders`)
  const byStatus = await many(`SELECT status, COUNT(*) AS n FROM orders GROUP BY status`)
  const byKit = await many(`SELECT kit, COUNT(*) AS n, SUM(total) AS value FROM orders WHERE status <> 'cancelled' GROUP BY kit`)
  const byHalls = await many(`SELECT halls, COUNT(*) AS n FROM orders WHERE status <> 'cancelled' GROUP BY halls ORDER BY n DESC`)
  const byWeek = await many(`SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS n, SUM(CASE WHEN deposit_status='paid' THEN 1 ELSE 0 END) AS paid FROM orders GROUP BY week ORDER BY week`)
  const arrivals = await many(`SELECT arrival_date AS date, COUNT(*) AS n FROM orders WHERE status <> 'cancelled' GROUP BY arrival_date ORDER BY arrival_date`)
  const upcoming = await many(`SELECT d.scheduled_date AS date, d.kind, COUNT(*) AS n FROM deliveries d WHERE d.status IN ('planned','packed') GROUP BY d.scheduled_date, d.kind ORDER BY d.scheduled_date LIMIT 30`)
  const notifications = await one(`SELECT SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END) AS skipped FROM notification_log`)
  const n = k => Number(totals[k] || 0)
  return {
    orders: n('orders'), live: n('live'), cancelled: n('cancelled'),
    depositsPaid: n('deposits_paid'), depositsValue: n('deposits_value'), bookedValue: n('booked_value'), balanceCollected: n('balance_collected'),
    storageInterest: n('storage_interest'), referred: n('referred'),
    goNoGo: { target, targetDate, paid: n('deposits_paid'), pct: Math.min(100, Math.round(n('deposits_paid') / target * 100)), daysLeft: daysUntil(targetDate) },
    byStatus, byKit, byHalls, byWeek, arrivals, upcoming,
    notifications: { sent: Number(notifications.sent || 0), failed: Number(notifications.failed || 0), skipped: Number(notifications.skipped || 0) },
  }
}
