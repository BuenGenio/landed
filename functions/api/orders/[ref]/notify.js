/** POST /api/orders/:ref/notify { event }  admin: (re)send a lifecycle email for an order */
import { getDb } from '../../../lib/db.js'
import { json, options, readJson, siteUrl } from '../../../lib/http.js'
import { getOrder, normalizeRef } from '../../../lib/orders.js'
import { notify } from '../../../lib/notifications.js'

export async function onRequestPost({ request, env, params }) {
  const body = (await readJson(request)) || {}
  if (!body.event) return json({ error: 'event required' }, 400)
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env) }
  const order = await getOrder(ctx, normalizeRef(params.ref), { audit: false })
  if (!order) return json({ error: 'Order not found' }, 404)
  const r = await notify(ctx, body.event, order, body.vars || {})
  return json({ ok: r.ok, skipped: !!r.skipped, error: r.error || null })
}
export const onRequestOptions = options
