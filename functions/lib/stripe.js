/**
 * Stripe over plain fetch: Checkout Sessions, refunds and webhook signature checks.
 * shima.shop uses the `stripe` npm package; this is the same three calls without the
 * dependency so it runs unchanged in workerd and in the Node dev server.
 */

function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (Array.isArray(v)) v.forEach((item, i) => typeof item === 'object' ? form(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item)))
    else if (typeof v === 'object') form(v, key, out)
    else out.append(key, String(v))
  }
  return out
}

async function call(env, method, path, body) {
  const key = env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY)')
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body: body ? form(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message || `Stripe ${res.status}`)
  return data
}

export const stripeConfigured = env => !!env.STRIPE_SECRET_KEY

/**
 * Hosted checkout for the £20 deposit or the balance.
 * kind: 'deposit' | 'balance'. Amount in GBP major units.
 */
export async function createCheckoutSession(env, { ref, kind, amount, email, name, successUrl, cancelUrl }) {
  return call(env, 'POST', '/checkout/sessions', {
    mode: 'payment',
    client_reference_id: ref,
    customer_email: email || undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { ref, kind },
    payment_intent_data: { description: `Landed ${kind} ${ref}${name ? ' · ' + name : ''}`, metadata: { ref, kind } },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: Math.round(amount * 100),
        product_data: { name: kind === 'deposit' ? `Landed kit deposit · ${ref}` : `Landed kit balance · ${ref}` },
      },
    }],
  })
}

export const retrieveSession = (env, id) => call(env, 'GET', `/checkout/sessions/${encodeURIComponent(id)}`)

export const refundPaymentIntent = (env, paymentIntent, amount) =>
  call(env, 'POST', '/refunds', { payment_intent: paymentIntent, amount: amount != null ? Math.round(amount * 100) : undefined })

async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Build a Stripe-Signature header (used by the tests and by `stripe trigger`-less local checks). */
export async function signPayload(secret, payload, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${payload}`)}`
}

/** Verify the Stripe-Signature header against the raw body. Returns the parsed event or throws. */
export async function constructEvent(rawBody, header, secret, toleranceSec = 300) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  if (!header) throw new Error('Missing Stripe-Signature header')
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=').map(s => s.trim())))
  const t = Number(parts.t)
  const sigs = header.split(',').filter(p => p.trim().startsWith('v1=')).map(p => p.trim().slice(3))
  if (!t || sigs.length === 0) throw new Error('Malformed Stripe-Signature header')
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) throw new Error('Stripe signature timestamp outside tolerance')
  const expected = await hmacHex(secret, `${t}.${rawBody}`)
  const ok = sigs.some(s => s.length === expected.length && s.split('').every((c, i) => c === expected[i]))
  if (!ok) throw new Error('Stripe signature mismatch')
  return JSON.parse(rawBody)
}
