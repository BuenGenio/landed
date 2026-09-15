/**
 * GET   /api/orders/:ref?email=   public with a matching email (or admin): the order and its deliveries
 * PATCH /api/orders/:ref          admin: status, deposit/balance, contact and delivery details, admin notes
 * DELETE /api/orders/:ref         admin: hard delete (tests and mistakes; cancel is the normal path)
 */
import { getDb } from '../../lib/db.js'
import { isAdmin, json, options, readJson, siteUrl } from '../../lib/http.js'
import { getOrder, updateOrder, OrderError, publicOrder, normalizeRef } from '../../lib/orders.js'
import { listOrderEvents } from '../../lib/order-events.js'
import { notify } from '../../lib/notifications.js'
import { paymentsForOrder, listInvoices } from '../../lib/billing.js'

export async function onRequestGet({ request, env, params }) {
  const db = getDb(env)
  const ctx = { db, env, request }
  const ref = normalizeRef(params.ref)
  const admin = await isAdmin(request, env)
  const order = await getOrder(ctx, ref)
  if (!order) return json({ error: 'Order not found' }, 404)
  if (admin) {
    const events = await listOrderEvents(db, ref)
    const notes = await db.execute({ sql: 'SELECT id, event, recipient, subject, status, error_message, sent_at, created_at FROM notification_log WHERE order_ref = ? ORDER BY id DESC LIMIT 50', args: [ref] })
    const payments = await paymentsForOrder(db, ref)
    const invoices = (await listInvoices(db, { ref })).map(({ data, ...i }) => ({ ...i, outstanding: data.outstanding, total: data.total }))
    return json({ ...order, events, notifications: notes.rows.map(r => ({ ...r })), payments, invoices })
  }
  const email = (new URL(request.url).searchParams.get('email') || '').trim().toLowerCase()
  if (!email || email !== order.email.toLowerCase()) return json({ error: 'Order not found' }, 404)
  return json(publicOrder(order))
}

export async function onRequestPatch({ request, env, params }) {
  const body = await readJson(request)
  if (!body) return json({ error: 'Invalid JSON' }, 400)
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env) }
  try {
    const { order, transitions } = await updateOrder(ctx, params.ref, body)
    const sent = []
    if (body.notify !== false) {
      if (transitions.includes('deposit_paid')) sent.push(['deposit_received', await notify(ctx, 'deposit_received', order)])
      if (transitions.includes('balance_paid')) sent.push(['balance_received', await notify(ctx, 'balance_received', order)])
      if (transitions.includes('cancelled')) sent.push(['cancelled', await notify(ctx, 'cancelled', order)])
    }
    return json({ ...order, transitions, sent: sent.map(([e, r]) => ({ event: e, ok: r.ok, skipped: !!r.skipped })) })
  } catch (err) {
    if (err instanceof OrderError) return json({ error: err.message }, err.status)
    throw err
  }
}

export async function onRequestDelete({ env, params }) {
  const db = getDb(env)
  const ref = normalizeRef(params.ref)
  await db.execute({ sql: 'DELETE FROM deliveries WHERE order_ref = ?', args: [ref] })
  await db.execute({ sql: 'DELETE FROM order_events WHERE order_ref = ?', args: [ref] })
  const r = await db.execute({ sql: 'DELETE FROM orders WHERE ref = ?', args: [ref] })
  return json({ ok: r.rowsAffected > 0 })
}

export const onRequestOptions = options
