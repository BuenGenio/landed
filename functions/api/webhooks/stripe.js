/**
 * POST /api/webhooks/stripe  Stripe → us. Handles checkout.session.completed (deposit / balance paid),
 * charge.refunded (deposit refunded outside our cancel flow). Idempotent via webhook_events.
 * Configure the endpoint in Stripe with STRIPE_WEBHOOK_SECRET.
 */
import { getDb } from '../../lib/db.js'
import { json, siteUrl } from '../../lib/http.js'
import { getOrder, markBalancePaid, markDepositPaid, normalizeRef } from '../../lib/orders.js'
import { constructEvent } from '../../lib/stripe.js'
import { notify } from '../../lib/notifications.js'
import { logOrderEvent } from '../../lib/order-events.js'
import { recordPayment } from '../../lib/billing.js'
import { log } from '../../lib/logger.js'

export async function onRequestPost({ request, env }) {
  const raw = await request.text()
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env) }
  let event
  try { event = await constructEvent(raw, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET) }
  catch (err) { await log(ctx, 'warn', 'webhooks', `Rejected Stripe webhook: ${err.message}`); return json({ error: err.message }, 400) }

  const seen = await db.execute({ sql: 'INSERT OR IGNORE INTO webhook_events (id, provider, type) VALUES (?, ?, ?)', args: [event.id, 'stripe', event.type] })
  if (seen.rowsAffected === 0) return json({ received: true, duplicate: true })

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const s = event.data.object
      if (s.payment_status !== 'paid') return json({ received: true, ignored: 'unpaid' })
      const ref = normalizeRef(s.metadata?.ref || s.client_reference_id)
      const kind = s.metadata?.kind || 'deposit'
      const paymentId = typeof s.payment_intent === 'string' ? s.payment_intent : s.id
      const changed = kind === 'balance' ? await markBalancePaid(ctx, ref, { method: 'card', paymentId }) : await markDepositPaid(ctx, ref, { method: 'card', paymentId })
      if (changed) {
        const order = await getOrder(ctx, ref, { audit: false })
        if (order) await notify(ctx, kind === 'balance' ? 'balance_received' : 'deposit_received', order)
      }
      return json({ received: true, ref, kind, changed })
    }
    if (event.type === 'charge.refunded') {
      const c = event.data.object
      const ref = normalizeRef(c.metadata?.ref)
      if (ref && c.metadata?.kind !== 'balance') {
        const r = await db.execute({ sql: `UPDATE orders SET deposit_status = 'refunded', updated_at = datetime('now') WHERE ref = ? AND deposit_status IN ('paid','kept')`, args: [ref] })
        if (r.rowsAffected > 0) await recordPayment(ctx, { ref, kind: 'refund', refundOf: 'deposit', amount: (c.amount_refunded || 0) / 100, currency: String(c.currency || 'gbp').toUpperCase(), method: 'card', provider: 'stripe', providerRef: c.id, note: 'Refunded in Stripe', userId: 'stripe' })
        await logOrderEvent(ctx, ref, 'deposit_refunded', { charge: c.id, amount: c.amount_refunded })
      }
      return json({ received: true, ref })
    }
    return json({ received: true, ignored: event.type })
  } catch (err) {
    await log(ctx, 'error', 'webhooks', `Stripe webhook ${event.type} failed`, err)
    return json({ error: err.message }, 500)
  }
}
