/**
 * POST /api/orders/:ref/cancel  { email, reason }        public: free up to 14 days before check-in, deposit kept inside that
 * POST /api/orders/:ref/cancel  { reason, force: true }  admin: always refundable when force is set
 */
import { getDb } from '../../../lib/db.js'
import { isAdmin, json, options, readJson, siteUrl } from '../../../lib/http.js'
import { cancelOrder, getOrder, OrderError, publicOrder, normalizeRef } from '../../../lib/orders.js'
import { notify } from '../../../lib/notifications.js'
import { refundPaymentIntent, stripeConfigured } from '../../../lib/stripe.js'
import { log } from '../../../lib/logger.js'

export async function onRequestPost({ request, env, params }) {
  const body = (await readJson(request)) || {}
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env) }
  const ref = normalizeRef(params.ref)
  const admin = await isAdmin(request, env)
  const existing = await getOrder(ctx, ref, { audit: false })
  if (!existing) return json({ error: 'Order not found' }, 404)
  if (!admin) {
    const email = String(body.email || '').trim().toLowerCase()
    if (!email || email !== existing.email.toLowerCase()) return json({ error: 'Order not found' }, 404)
  }
  try {
    const refund = stripeConfigured(env) ? (pi, amount) => refundPaymentIntent(env, pi, amount) : null
    const result = await cancelOrder(ctx, ref, { reason: body.reason || '', by: admin ? 'admin' : 'customer', force: admin && !!body.force, refund, userId: admin ? 'admin' : null })
    if (!result.alreadyCancelled) await notify(ctx, 'cancelled', result.order)
    if (result.refundError) await log(ctx, 'error', 'refunds', `Refund failed for ${ref}: ${result.refundError}`, { ref })
    const { order, ...rest } = result
    return json({ ...rest, order: admin ? order : publicOrder(order) })
  } catch (err) {
    if (err instanceof OrderError) return json({ error: err.message }, err.status)
    throw err
  }
}

export const onRequestOptions = options
