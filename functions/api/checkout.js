/**
 * POST /api/checkout { ref, kind: 'deposit' | 'balance' }  public: hosted Stripe Checkout for an order.
 * Pattern from shima.shop functions/api/checkout.js, reduced to Landed's two payments.
 */
import { getDb } from '../lib/db.js'
import { json, options, readJson, siteUrl } from '../lib/http.js'
import { getOrder, normalizeRef } from '../lib/orders.js'
import { createCheckoutSession, stripeConfigured } from '../lib/stripe.js'
import { logOrderEvent } from '../lib/order-events.js'
import { log } from '../lib/logger.js'
import { langPath } from '../lib/notifications.js'

export async function onRequestPost({ request, env }) {
  const body = (await readJson(request)) || {}
  const db = getDb(env)
  const ctx = { db, env, request }
  const ref = normalizeRef(body.ref)
  const kind = body.kind === 'balance' ? 'balance' : 'deposit'
  const order = await getOrder(ctx, ref, { audit: false })
  if (!order) return json({ error: 'Order not found' }, 404)
  if (order.status === 'cancelled') return json({ error: 'This order was cancelled' }, 409)
  if (kind === 'deposit' && order.depositStatus === 'paid') return json({ error: 'Deposit already paid', paid: true }, 409)
  if (kind === 'balance' && order.balanceStatus !== 'due') return json({ error: 'Nothing to pay', paid: true }, 409)
  const amount = kind === 'deposit' ? order.deposit : order.balance
  if (!(amount > 0)) return json({ error: 'Nothing to pay', paid: true }, 409)
  if (!stripeConfigured(env)) return json({ error: 'Card payments are not set up yet; we will email a payment link.', unavailable: true }, 503)
  const site = siteUrl(request, env) + langPath(body.lang || order.lang)   // come back to the page in the customer's language
  try {
    const session = await createCheckoutSession(env, {
      ref, kind, amount, email: order.email, name: order.name,
      successUrl: `${site}/?ref=${ref}&kind=${kind}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${site}/?ref=${ref}&cancelled=1`,
    })
    await logOrderEvent(ctx, ref, 'checkout_started', { kind, amount, session: session.id })
    return json({ url: session.url, sessionId: session.id, amount, kind })
  } catch (err) {
    await log(ctx, 'error', 'checkout', `Checkout failed for ${ref}`, err)
    return json({ error: err.message }, 502)
  }
}
export const onRequestOptions = options
