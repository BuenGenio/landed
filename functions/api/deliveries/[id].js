/** PATCH /api/deliveries/:id { status, note, scheduled_date }  admin: mark a drop delivered / left at reception / failed */
import { getDb } from '../../lib/db.js'
import { json, options, readJson, siteUrl } from '../../lib/http.js'
import { getOrder, updateDelivery, OrderError } from '../../lib/orders.js'
import { notify } from '../../lib/notifications.js'

export async function onRequestPatch({ request, env, params }) {
  const body = (await readJson(request)) || {}
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env) }
  try {
    const r = await updateDelivery(ctx, Number(params.id), body)
    let sent = null
    if (r.transitions.includes('delivered') && body.notify !== false) {
      const order = await getOrder(ctx, r.ref, { audit: false })
      const note = body.status === 'reception' ? `It is waiting for you at ${order.halls} reception under your name.` : (body.note || 'It is in your room.')
      sent = await notify(ctx, 'delivered', order, { note })
    }
    const order = await getOrder(ctx, r.ref, { audit: false })
    return json({ ...r, order, sent: sent ? { ok: sent.ok, skipped: !!sent.skipped } : null })
  } catch (err) {
    if (err instanceof OrderError) return json({ error: err.message }, err.status)
    throw err
  }
}
export const onRequestOptions = options
