/**
 * GET  /api/deliveries?date=&from=&to=&halls=&status=&kind=   admin: the run sheet (deliveries joined with orders + packing list)
 * POST /api/deliveries { action: 'reminders', date, halls? }    admin: email the week-before reminder to everyone on that day's run
 * POST /api/deliveries { action: 'bulk', ids, status, note? }    admin: set one status on many drops (packed, failed, cancelled...)
 */
import { getDb } from '../lib/db.js'
import { json, options, readJson, siteUrl, text, csv } from '../lib/http.js'
import { getOrder, listDeliveries, updateDelivery, OrderError } from '../lib/orders.js'
import { notify } from '../lib/notifications.js'

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), p = k => u.searchParams.get(k) || undefined
  const rows = await listDeliveries(getDb(env), { date: p('date'), from: p('from'), to: p('to'), halls: p('halls'), status: p('status'), kind: p('kind'), limit: p('limit') })
  if (p('format') === 'csv') {
    const flat = rows.map(r => ({ date: r.date, kind: r.kind, status: r.status, ref: r.ref, name: r.name, phone: r.phone, halls: r.halls, building: r.building, contents: r.contents.join(' | '), balance: r.balance, balance_status: r.balanceStatus, deposit_status: r.depositStatus, notes: r.notes, note: r.note }))
    return text(csv(flat, Object.keys(flat[0] || { date: 1 })), 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="landed-run-${p('date') || 'all'}.csv"` })
  }
  return json(rows)
}

export async function onRequestPost({ request, env }) {
  const body = (await readJson(request)) || {}
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env) }
  if (body.action === 'bulk') {
    const ids = [...new Set((body.ids || []).map(Number).filter(Boolean))].slice(0, 500)
    if (!ids.length || !body.status) return json({ error: 'ids and status required' }, 400)
    const results = []
    for (const id of ids) {
      try {
        const r = await updateDelivery(ctx, id, { status: body.status, note: body.note, scheduled_date: body.scheduled_date })
        let sent = null
        if (r.transitions.includes('delivered') && body.notify !== false) {
          const order = await getOrder(ctx, r.ref, { audit: false })
          sent = await notify(ctx, 'delivered', order, { note: body.status === 'reception' ? `It is waiting for you at ${order.halls} reception under your name.` : (body.note || 'It is in your room.') })
        }
        results.push({ id, ref: r.ref, ok: true, sent: sent ? { ok: sent.ok, skipped: !!sent.skipped } : null })
      } catch (err) { results.push({ id, ok: false, error: err instanceof OrderError ? err.message : 'failed' }) }
    }
    return json({ count: results.length, results })
  }
  if (body.action !== 'reminders' || !body.date) return json({ error: 'action=reminders and date required' }, 400)
  const rows = await listDeliveries(db, { date: body.date, halls: body.halls, status: 'planned' })
  const results = []
  for (const d of rows) {
    if (d.reminderSentAt && !body.resend) { results.push({ ref: d.ref, skipped: 'already sent' }); continue }
    const order = await getOrder(ctx, d.ref, { audit: false })
    const r = await notify(ctx, 'delivery_reminder', order, { arrival: new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) })
    if (r.ok || r.skipped) await db.execute({ sql: `UPDATE deliveries SET reminder_sent_at = datetime('now') WHERE id = ?`, args: [d.id] })
    results.push({ ref: d.ref, ok: r.ok, skipped: !!r.skipped, error: r.error || null })
  }
  return json({ date: body.date, count: results.length, results })
}
export const onRequestOptions = options
