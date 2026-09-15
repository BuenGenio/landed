/**
 * POST /api/orders          public: create a reservation from the order page
 * GET  /api/orders          admin: list (filters: status, deposit_status, balance_status, halls, kit, q, from, to,
 *                           arrival_from, arrival_to, storage=1, limit, offset; format=csv for a spreadsheet)
 */
import { getDb } from '../lib/db.js'
import { csv, json, options, readJson, siteUrl, text } from '../lib/http.js'
import { createOrder, listOrders, OrderError, publicOrder, CATALOGUE } from '../lib/orders.js'
import { notify, orderLines, langPath } from '../lib/notifications.js'
import { log } from '../lib/logger.js'
import { stripeConfigured } from '../lib/stripe.js'

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), p = k => u.searchParams.get(k) || undefined
  const db = getDb(env)
  const orders = await listOrders(db, {
    status: p('status'), depositStatus: p('deposit_status'), balanceStatus: p('balance_status'), halls: p('halls'), kit: p('kit'), q: p('q'),
    from: p('from'), to: p('to'), arrivalFrom: p('arrival_from'), arrivalTo: p('arrival_to'), storage: p('storage') === '1',
    limit: p('limit'), offset: p('offset'),
  })
  if (p('format') === 'csv') {
    const rows = orders.map(o => ({
      ref: o.ref, status: o.status, created: o.createdAt, name: o.name, email: o.email, phone: o.phone, uni: o.uni, halls: o.halls, building: o.building,
      arrival: o.arrival, kit: CATALOGUE.names.kit[o.kit], contents: orderLines(o).join(' | '), total: o.total, deposit: o.deposit, deposit_status: o.depositStatus,
      deposit_method: o.depositMethod, balance: o.balance, balance_status: o.balanceStatus, referral_used: o.referral, referral_credit: o.referralCredit,
      storage_interest: o.storageInterest ? 'yes' : '', from: o.from, lang: o.lang, notes: o.notes, admin_notes: o.adminNotes,
    }))
    const cols = rows.length ? Object.keys(rows[0]) : ['ref']
    return text(csv(rows, cols), 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="landed-orders-${new Date().toISOString().slice(0, 10)}.csv"` })
  }
  return json(orders)
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request)
  if (!body) return json({ error: 'Invalid JSON' }, 400)
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env) }
  try {
    const order = await createOrder(ctx, body)
    // Emails: customer confirmation with the pay link, and a heads-up to whoever runs the van
    const mail = await notify(ctx, 'reservation_received', order)
    await notify(ctx, 'admin_new_order', order)
    await log(ctx, 'info', 'orders', `Reservation ${order.ref} ${order.kit} ${order.halls} £${order.total}`, { ref: order.ref, email_status: mail.ok ? 'sent' : mail.skipped ? 'skipped' : 'failed' })
    return json({
      ok: true,
      order: publicOrder(order),
      payment: { stripe: stripeConfigured(env), payUrl: `${ctx.origin}${langPath(order.lang)}/?pay=${order.ref}` },
      email: mail.ok ? 'sent' : mail.skipped ? 'skipped' : 'failed',
    }, 201)
  } catch (err) {
    if (err instanceof OrderError) return json({ error: err.message, field: err.field }, err.status)
    await log(ctx, 'error', 'orders', 'Create failed', err)
    return json({ error: 'Could not save the reservation' }, 500)
  }
}

export const onRequestOptions = options
