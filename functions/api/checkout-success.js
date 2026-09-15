/**
 * GET /api/checkout-success?session_id=  public: verify a Checkout Session with Stripe and record the payment.
 * The webhook does the same; whichever arrives first wins, the other is a no-op. (shima.shop checkout-success.js)
 */
import { getDb } from '../lib/db.js'
import { json, options, siteUrl } from '../lib/http.js'
import { getOrder, markBalancePaid, markDepositPaid, publicOrder } from '../lib/orders.js'
import { retrieveSession, stripeConfigured } from '../lib/stripe.js'
import { notify } from '../lib/notifications.js'
import { log } from '../lib/logger.js'

export async function onRequestGet({ request, env }) {
  const sessionId = new URL(request.url).searchParams.get('session_id')
  if (!sessionId) return json({ error: 'session_id required' }, 400)
  if (!stripeConfigured(env)) return json({ error: 'Stripe not configured' }, 503)
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env) }
  try {
    const session = await retrieveSession(env, sessionId)
    const ref = session.metadata?.ref || session.client_reference_id
    const kind = session.metadata?.kind || 'deposit'
    if (!ref) return json({ error: 'Session has no order reference' }, 400)
    if (session.payment_status !== 'paid') return json({ status: session.payment_status, ref, kind, order: publicOrder(await getOrder(ctx, ref, { audit: false })) })
    const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || session.id
    const changed = kind === 'balance'
      ? await markBalancePaid(ctx, ref, { method: 'card', paymentId })
      : await markDepositPaid(ctx, ref, { method: 'card', paymentId })
    const order = await getOrder(ctx, ref, { audit: false })
    if (changed) await notify(ctx, kind === 'balance' ? 'balance_received' : 'deposit_received', order)
    return json({ status: 'paid', ref, kind, order: publicOrder(order) })
  } catch (err) {
    await log(ctx, 'error', 'checkout-success', 'Verify failed', err)
    return json({ error: err.message }, 502)
  }
}
export const onRequestOptions = options
