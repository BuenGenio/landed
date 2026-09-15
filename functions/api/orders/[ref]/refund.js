/**
 * POST /api/orders/:ref/refund { kind: 'deposit' | 'balance', amount?, reason }   admin
 * Card payments are refunded through Stripe; cash/bank refunds are recorded as handed back.
 * Writes the ledger row, flips the order's deposit/balance status to refunded and issues a credit note.
 */
import { getDb } from '../../../lib/db.js'
import { json, options, readJson, siteUrl } from '../../../lib/http.js'
import { getOrder, normalizeRef } from '../../../lib/orders.js'
import { refundOrder, BillingError } from '../../../lib/billing.js'
import { refundPaymentIntent, stripeConfigured } from '../../../lib/stripe.js'
import { log } from '../../../lib/logger.js'

export async function onRequestPost({ request, env, params }) {
  const body = (await readJson(request)) || {}
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env), userId: 'admin' }
  const ref = normalizeRef(params.ref)
  const order = await getOrder(ctx, ref, { audit: false })
  if (!order) return json({ error: 'Order not found' }, 404)
  try {
    const refund = stripeConfigured(env) ? (pi, amount) => refundPaymentIntent(env, pi, amount) : null
    const r = await refundOrder(ctx, order, { kind: body.kind || 'deposit', amount: body.amount ?? null, reason: body.reason || '', refund })
    await log(ctx, 'info', 'refunds', `Refunded ${r.kind} £${r.amount} on ${ref} via ${r.provider}`, { ref })
    return json({ ...r, order: await getOrder(ctx, ref, { audit: false }) })
  } catch (err) {
    if (err instanceof BillingError) return json({ error: err.message }, err.status)
    await log(ctx, 'error', 'refunds', `Refund failed for ${ref}: ${err.message}`, { ref })
    return json({ error: err.message }, 502)
  }
}
export const onRequestOptions = options
