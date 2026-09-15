/**
 * End-to-end tests against the dev server on a throwaway SQLite file.
 * Covers: reservation + pricing + deliveries, referral, admin auth, deposit via signed Stripe webhook
 * (idempotent), delivery run sheet, cancellation rules, CSV, stats, templates and settings.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startServer } from '../scripts/dev.js'
import { signPayload } from '../functions/lib/stripe.js'

const ADMIN = 'test-admin-key'
const WHSEC = 'whsec_test_secret'
let srv, dir
const api = async (path, { method = 'GET', body, admin = false, headers = {} } = {}) => {
  const res = await fetch(srv.url + path, {
    method, headers: { 'Content-Type': 'application/json', ...(admin ? { 'X-Admin-Key': ADMIN } : {}), ...headers },
    body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data, headers: res.headers }
}
const plus = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

const basket = (over = {}) => ({
  kit: 'both', items: [], addons: [{ id: 'lamp', n: 1 }, { id: 'pillow', n: 2 }], referral: '', storageInterest: true,
  uni: 'UoA', halls: 'Hillhead', building: 'Crombie Hall, flat 12', arrival: plus(20), name: 'Ana Popescu', email: 'ana@example.com',
  phone: '+40 712 345 678', from: 'Romania', notes: 'Landing late', lang: 'ro', ...over,
})

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'landed-test-'))
  srv = await startServer({ port: 0, quiet: true, env: { DATABASE_URL: `file:${join(dir, 't.db')}`, ADMIN_API_KEY: ADMIN, STRIPE_WEBHOOK_SECRET: WHSEC, EMAIL_FAKE: '1', LOG_SILENT: '1', ORDER_EMAIL: 'ops@example.com', SITE_URL: 'https://landed.test' } })
})
after(async () => { await srv.close(); rmSync(dir, { recursive: true, force: true }) })

let ana
test('health', async () => {
  const r = await api('/api/health')
  assert.equal(r.status, 200); assert.equal(r.data.ok, true); assert.equal(r.data.stripe, false)
})

test('reserve: server prices the basket, plans two deliveries, emails both sides', async () => {
  const r = await api('/api/orders', { method: 'POST', body: basket({ total: 1, deposit: 0 }) })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  ana = r.data.order
  assert.match(ana.ref, /^LND-[A-Z0-9]{4}$/)
  assert.equal(ana.total, 125 + 12 + 16)          // both kits + lamp + 2 pillows, client-sent total ignored
  assert.equal(ana.deposit, 20)
  assert.equal(ana.balance, 133)
  assert.equal(ana.depositStatus, 'pending')
  assert.equal(ana.status, 'reserved')
  assert.deepEqual(ana.deliveries.map(d => d.kind), ['arrival', 'winter'])
  assert.equal(ana.deliveries[0].date, basket().arrival)
  assert.equal(r.data.payment.payUrl, `https://landed.test/ro/?pay=${ana.ref}`)   // the order page in the customer's language
  assert.equal(r.data.email, 'sent')
  const log = await api('/api/notifications?ref=' + ana.ref, { admin: true })
  assert.deepEqual(log.data.map(n => n.event).sort(), ['admin_new_order', 'reservation_received'])
})

test('reserve: validation errors name the field', async () => {
  let r = await api('/api/orders', { method: 'POST', body: basket({ email: 'nope' }) })
  assert.equal(r.status, 400); assert.equal(r.data.field, 'email')
  r = await api('/api/orders', { method: 'POST', body: basket({ kit: 'mix', items: ['tea', 'rowie'] }) })
  assert.equal(r.status, 400); assert.equal(r.data.field, 'items')
  r = await api('/api/orders', { method: 'POST', body: basket({ kit: 'gold' }) })
  assert.equal(r.status, 400); assert.equal(r.data.field, 'kit')
})

test('mix and match: only the picked items, winter-only mix goes on the winter run', async () => {
  const r = await api('/api/orders', { method: 'POST', body: basket({ kit: 'mix', items: ['bottle', 'thermal', 'socks', 'beanie'], addons: [], email: 'mix@example.com', arrival: '2026-10-03' }) })
  assert.equal(r.status, 201)
  assert.equal(r.data.order.total, 12 + 14 + 7 + 7)
  assert.deepEqual(r.data.order.deliveries.map(d => d.kind), ['winter'])
  assert.equal(r.data.order.deliveries[0].date, '2026-10-17')
  // a student arriving after the October run gets the winter box on check-in day
  const late = await api('/api/orders', { method: 'POST', body: basket({ kit: 'winter', addons: [], email: 'late@example.com', arrival: '2026-11-02' }) })
  assert.equal(late.data.order.deliveries[0].date, '2026-11-02')
})

test('referral: unknown and own codes rejected, a friend gets £10 off and the referrer earns £10 credit', async () => {
  assert.equal((await api('/api/referrals/LND-ZZZZ')).data.valid, false)
  assert.equal((await api(`/api/referrals/${ana.ref}?email=ana@example.com`)).data.reason, 'own')
  assert.equal((await api(`/api/referrals/${ana.ref.toLowerCase()}`)).data.valid, true)
  const r = await api('/api/orders', { method: 'POST', body: basket({ kit: 'arrival', addons: [], referral: ana.ref.toLowerCase(), email: 'friend@example.com', name: 'Friend' }) })
  assert.equal(r.status, 201)
  assert.equal(r.data.order.total, 85); assert.equal(r.data.order.discount, 10); assert.equal(r.data.order.referral, ana.ref)
  const a = await api(`/api/orders/${ana.ref}`, { admin: true })
  assert.equal(a.data.referralCredit, 10); assert.equal(a.data.balance, 123)
  assert.ok(a.data.events.some(e => e.activity === 'referral_credit'))
})

test('admin gate: list needs the key; customer lookup needs the matching email', async () => {
  assert.equal((await api('/api/orders')).status, 401)
  assert.equal((await api('/api/orders', { admin: true })).status, 200)
  assert.equal((await api(`/api/orders/${ana.ref}`)).status, 404)
  assert.equal((await api(`/api/orders/${ana.ref}?email=other@example.com`)).status, 404)
  const r = await api(`/api/orders/${ana.ref}?email=ANA@example.com`)
  assert.equal(r.status, 200); assert.equal(r.data.adminNotes, undefined); assert.equal(r.data.depositPaymentId, undefined)
})

test('checkout without Stripe says so instead of failing', async () => {
  const r = await api('/api/checkout', { method: 'POST', body: { ref: ana.ref } })
  assert.equal(r.status, 503); assert.equal(r.data.unavailable, true)
})

test('stripe webhook: bad signature rejected; good one marks the deposit paid once', async () => {
  const event = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', client_reference_id: ana.ref, metadata: { ref: ana.ref, kind: 'deposit' } } } }
  const raw = JSON.stringify(event)
  let r = await api('/api/webhooks/stripe', { method: 'POST', body: raw, headers: { 'Stripe-Signature': 't=1,v1=deadbeef' } })
  assert.equal(r.status, 400)
  r = await api('/api/webhooks/stripe', { method: 'POST', body: raw, headers: { 'Stripe-Signature': await signPayload(WHSEC, raw) } })
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.changed, true)
  r = await api('/api/webhooks/stripe', { method: 'POST', body: raw, headers: { 'Stripe-Signature': await signPayload(WHSEC, raw) } })
  assert.equal(r.data.duplicate, true)
  const o = await api(`/api/orders/${ana.ref}`, { admin: true })
  assert.equal(o.data.depositStatus, 'paid'); assert.equal(o.data.depositPaymentId, 'pi_1'); assert.equal(o.data.depositMethod, 'card')
  assert.ok(o.data.notifications.some(n => n.event === 'deposit_received'))
  const again = await api('/api/checkout', { method: 'POST', body: { ref: ana.ref } })
  assert.equal(again.status, 409); assert.equal(again.data.paid, true)
})

test('run sheet: deliveries for the day with packing list, WhatsApp-ready phone; marking delivered moves the order on', async () => {
  const day = basket().arrival
  let r = await api(`/api/deliveries?date=${day}&halls=Hillhead`, { admin: true })
  assert.equal(r.status, 200)
  const mine = r.data.filter(d => d.ref === ana.ref)
  assert.equal(mine.length, 1); assert.equal(mine[0].kind, 'arrival')
  assert.ok(mine[0].contents.includes('Kettle')); assert.ok(mine[0].contents.includes('1 × Desk lamp')); assert.ok(mine[0].contents.includes('2 × Extra pillow'))
  assert.equal(mine[0].balance, 123)
  const rem = await api('/api/deliveries', { method: 'POST', admin: true, body: { action: 'reminders', date: day } })
  assert.ok(rem.data.results.find(x => x.ref === ana.ref).ok)
  const rem2 = await api('/api/deliveries', { method: 'POST', admin: true, body: { action: 'reminders', date: day } })
  assert.equal(rem2.data.results.find(x => x.ref === ana.ref).skipped, 'already sent')

  r = await api(`/api/deliveries/${mine[0].id}`, { method: 'PATCH', admin: true, body: { status: 'reception', note: 'Reception, box 3' } })
  assert.equal(r.status, 200); assert.deepEqual(r.data.transitions, ['delivered']); assert.equal(r.data.order.status, 'reserved') // winter still open
  const winter = r.data.order.deliveries.find(d => d.kind === 'winter')
  r = await api(`/api/deliveries/${winter.id}`, { method: 'PATCH', admin: true, body: { status: 'delivered' } })
  assert.equal(r.data.order.status, 'delivered')
  r = await api(`/api/orders/${ana.ref}`, { method: 'PATCH', admin: true, body: { balance_status: 'paid', balance_method: 'cash' } })
  assert.equal(r.data.status, 'closed'); assert.deepEqual(r.data.transitions, ['balance_paid'])
  assert.ok(r.data.sent.find(s => s.event === 'balance_received').ok)
  const csv = await api(`/api/deliveries?date=${day}&format=csv`, { admin: true })
  assert.match(csv.headers.get('content-type'), /text\/csv/); assert.ok(csv.data.includes(ana.ref))
})

test('cancel: free outside 14 days (deposit void/refunded), kept inside; customers need their email', async () => {
  const far = await api('/api/orders', { method: 'POST', body: basket({ kit: 'winter', addons: [], email: 'far@example.com', arrival: plus(30) }) })
  let r = await api(`/api/orders/${far.data.order.ref}/cancel`, { method: 'POST', body: { email: 'wrong@example.com' } })
  assert.equal(r.status, 404)
  r = await api(`/api/orders/${far.data.order.ref}/cancel`, { method: 'POST', body: { email: 'far@example.com', reason: 'changed plans' } })
  assert.equal(r.status, 200); assert.equal(r.data.depositOutcome, 'void'); assert.equal(r.data.order.status, 'cancelled')
  assert.ok(r.data.order.deliveries.every(d => d.status === 'cancelled'))
  assert.equal((await api(`/api/referrals/${far.data.order.ref}`)).data.reason, 'cancelled')

  const near = await api('/api/orders', { method: 'POST', body: basket({ kit: 'arrival', addons: [], email: 'near@example.com', arrival: plus(5) }) })
  await api(`/api/orders/${near.data.order.ref}`, { method: 'PATCH', admin: true, body: { deposit_status: 'paid', deposit_method: 'cash' } })
  r = await api(`/api/orders/${near.data.order.ref}/cancel`, { method: 'POST', body: { email: 'near@example.com' } })
  assert.equal(r.data.depositOutcome, 'kept'); assert.equal(r.data.refundable, false)
  // admin can override and refund a cash deposit by hand
  const near2 = await api('/api/orders', { method: 'POST', body: basket({ kit: 'arrival', addons: [], email: 'near2@example.com', arrival: plus(5) }) })
  await api(`/api/orders/${near2.data.order.ref}`, { method: 'PATCH', admin: true, body: { deposit_status: 'paid', deposit_method: 'bank' } })
  r = await api(`/api/orders/${near2.data.order.ref}/cancel`, { method: 'POST', admin: true, body: { force: true, reason: 'goodwill' } })
  assert.equal(r.data.depositOutcome, 'refunded')
})

test('admin list, filters and CSV; stats and go/no-go', async () => {
  let r = await api('/api/orders?storage=1', { admin: true })
  assert.ok(r.data.length >= 1); assert.ok(r.data.every(o => o.storageInterest))
  r = await api('/api/orders?status=cancelled', { admin: true })
  assert.ok(r.data.length >= 3)
  r = await api('/api/orders?format=csv', { admin: true })
  assert.match(r.headers.get('content-type'), /text\/csv/); assert.ok(r.data.startsWith('ref,status,'))
  r = await api('/api/stats', { admin: true })
  assert.equal(r.status, 200)
  assert.equal(r.data.depositsPaid, 1); assert.equal(r.data.goNoGo.paid, 1) // cancelled deposits (kept/refunded) do not count; assert.equal(r.data.goNoGo.target, 50)
  assert.ok(r.data.byHalls.find(h => h.halls === 'Hillhead'))
  assert.ok(r.data.notifications.sent > 5)
})

test('admin edits: arrival date moves the planned arrival drop; bad status rejected', async () => {
  const o = await api('/api/orders', { method: 'POST', body: basket({ kit: 'arrival', addons: [], email: 'move@example.com', arrival: plus(50) }) })
  let r = await api(`/api/orders/${o.data.order.ref}`, { method: 'PATCH', admin: true, body: { arrival_date: plus(52), building: 'Fyfe House 4B', admin_notes: 'double bed' } })
  assert.equal(r.status, 200); assert.equal(r.data.deliveries[0].scheduled_date, plus(52)); assert.equal(r.data.adminNotes, 'double bed')
  r = await api(`/api/orders/${o.data.order.ref}`, { method: 'PATCH', admin: true, body: { status: 'lost' } })
  assert.equal(r.status, 400)
  r = await api(`/api/orders/${o.data.order.ref}`, { method: 'DELETE', admin: true })
  assert.equal(r.data.ok, true)
})

test('templates and settings round-trip; test send uses sample data', async () => {
  let r = await api('/api/notification-templates', { admin: true })
  assert.equal(r.data.length, 7)
  const tpl = r.data.find(t => t.event === 'deposit_received')
  r = await api('/api/notification-templates', { method: 'PUT', admin: true, body: { ...tpl, subject: 'Got it: {{ref}}' } })
  assert.equal(r.data.ok, true)
  r = await api('/api/settings?key=general', { method: 'PUT', admin: true, body: { admin_email: 'ops@example.com', whatsapp_number: '447700900000' } })
  assert.equal(r.data.ok, true)
  r = await api('/api/settings?key=general', { admin: true })
  assert.equal(r.data.admin_email, 'ops@example.com'); assert.equal(r.data.winter_delivery_date, '2026-10-17')
  r = await api('/api/notification-templates/test', { method: 'POST', admin: true, body: { event: 'deposit_received' } })
  assert.equal(r.status, 200)
  const log = await api('/api/notifications?event=deposit_received&limit=1', { admin: true })
  assert.equal(log.data[0].subject, 'Got it: LND-TEST'); assert.equal(log.data[0].recipient, 'ops@example.com')
  r = await api('/api/logs?type=api&limit=5', { admin: true })
  assert.equal(r.status, 200); assert.ok(Array.isArray(r.data))
})

// ---------------------------------------------------------------- billing, shipping, previews (admin app)

test('billing: the ledger follows card deposits, cash balances and cancel refunds; summary; CSV; admin only', async () => {
  let r = await api('/api/payments?ref=' + ana.ref, { admin: true })
  assert.equal(r.status, 200)
  assert.deepEqual(r.data.map(p => p.kind).sort(), ['balance', 'deposit'])
  const dep = r.data.find(p => p.kind === 'deposit')
  assert.equal(dep.provider, 'stripe'); assert.equal(dep.providerRef, 'pi_1'); assert.equal(dep.amount, 20); assert.equal(dep.method, 'card')
  const bal = r.data.find(p => p.kind === 'balance')
  assert.equal(bal.method, 'cash'); assert.equal(bal.provider, 'manual'); assert.equal(bal.amount, 123)
  r = await api('/api/payments?kind=refund', { admin: true })
  assert.ok(r.data.some(p => p.refundOf === 'deposit' && p.provider === 'manual' && p.note.startsWith('Cancelled (admin)')))
  r = await api('/api/billing', { admin: true })
  assert.equal(r.status, 200); assert.ok(r.data.deposits.n >= 3); assert.ok(r.data.refunds.n >= 1); assert.ok(r.data.outstanding.balanceN >= 1)
  assert.equal(r.data.net, r.data.taken - r.data.refunds.value)
  r = await api('/api/payments?format=csv', { admin: true })
  assert.match(r.headers.get('content-type'), /text\/csv/); assert.ok(r.data.startsWith('id,date,ref,'))
  assert.equal((await api('/api/payments')).status, 401)
  assert.equal((await api('/api/billing')).status, 401)
})

test('billing: refund a cash balance by hand, credit note issued; card refund needs Stripe; one invoice per order', async () => {
  await api('/api/settings?key=billing', { method: 'PUT', admin: true, body: { business_name: 'Landed Ltd', invoice_prefix: 'LND-' } })
  let r = await api(`/api/orders/${ana.ref}/refund`, { method: 'POST', admin: true, body: { kind: 'balance', reason: 'kettle missing' } })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.provider, 'manual'); assert.equal(r.data.amount, 123); assert.equal(r.data.order.balanceStatus, 'refunded')
  assert.match(r.data.creditNote.number, /^LND-CN-\d{4}$/); assert.equal(r.data.creditNote.amount, 123)
  r = await api(`/api/orders/${ana.ref}/refund`, { method: 'POST', admin: true, body: { kind: 'balance' } })
  assert.equal(r.status, 409)
  r = await api(`/api/orders/${ana.ref}/refund`, { method: 'POST', admin: true, body: { kind: 'deposit' } })
  assert.equal(r.status, 503) // card deposit, Stripe not configured in tests
  r = await api(`/api/orders/${ana.ref}/refund`, { method: 'POST', admin: true, body: { kind: 'balance', amount: 5000 } })
  assert.equal(r.status, 409)

  r = await api(`/api/orders/${ana.ref}/invoice`, { method: 'POST', admin: true })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  const number = r.data.number
  assert.match(number, /^LND-\d{4}$/)
  assert.equal(r.data.data.total, 143)        // 153 booked minus the £10 referral credit earned
  assert.equal(r.data.data.paid, 20)          // deposit 20 + balance 123 − refund 123
  assert.equal(r.data.data.outstanding, 123)
  assert.equal(r.data.data.business.name, 'Landed Ltd')
  const again = await api(`/api/orders/${ana.ref}/invoice`, { method: 'POST', admin: true })
  assert.equal(again.data.number, number)
  const html = await api(`/api/invoices/${number}?format=html`, { admin: true })
  assert.match(html.headers.get('content-type'), /text\/html/); assert.ok(html.data.includes(number)); assert.ok(html.data.includes('Desk lamp')); assert.ok(html.data.includes('Landed Ltd'))
  const viaOrder = await api(`/api/orders/${ana.ref}/invoice?format=html`, { admin: true })
  assert.ok(viaOrder.data.includes(number))
  const list = await api('/api/invoices', { admin: true })
  assert.ok(list.data.some(i => i.number === number && i.type === 'invoice' && i.outstanding === 123))
  assert.ok(list.data.some(i => i.type === 'credit_note' && i.ref === ana.ref))
  assert.equal((await api('/api/invoices/NOPE', { admin: true })).status, 404)
  const detail = await api(`/api/orders/${ana.ref}`, { admin: true })
  assert.equal(detail.data.payments.length, 3); assert.equal(detail.data.invoices.length, 2)
  assert.ok(detail.data.events.some(e => e.activity === 'refund')); assert.ok(detail.data.events.some(e => e.activity === 'invoice_issued'))
})

test('shipping: bulk status on many drops, reschedule one, unknown ids reported', async () => {
  const day = plus(40)
  const a = await api('/api/orders', { method: 'POST', body: basket({ kit: 'arrival', addons: [], email: 'bulk1@example.com', arrival: day }) })
  const b = await api('/api/orders', { method: 'POST', body: basket({ kit: 'arrival', addons: [], email: 'bulk2@example.com', arrival: day }) })
  let r = await api(`/api/deliveries?date=${day}`, { admin: true })
  const ids = r.data.filter(d => [a.data.order.ref, b.data.order.ref].includes(d.ref)).map(d => d.id)
  assert.equal(ids.length, 2)
  r = await api('/api/deliveries', { method: 'POST', admin: true, body: { action: 'bulk', ids: [...ids, 999999], status: 'packed' } })
  assert.equal(r.status, 200); assert.equal(r.data.results.filter(x => x.ok).length, 2); assert.equal(r.data.results.find(x => x.id === 999999).ok, false)
  r = await api(`/api/deliveries?date=${day}&status=packed`, { admin: true })
  assert.equal(r.data.filter(d => ids.includes(d.id)).length, 2)
  r = await api(`/api/deliveries/${ids[0]}`, { method: 'PATCH', admin: true, body: { scheduled_date: plus(41) } })
  assert.equal(r.status, 200); assert.equal(r.data.order.deliveries[0].scheduled_date, plus(41))
  r = await api('/api/deliveries', { method: 'POST', admin: true, body: { action: 'bulk', ids: [], status: 'packed' } })
  assert.equal(r.status, 400)
})

test('templates: preview renders a draft with sample data, or the saved template with a real order', async () => {
  let r = await api('/api/notification-templates/preview', { method: 'POST', admin: true, body: { event: 'deposit_received', subject: 'Hi {{name}} {{ref}}', body_html: '<p>{{items}} {{balance}}</p>', body_text: '' } })
  assert.equal(r.status, 200); assert.equal(r.data.subject, 'Hi Test Student LND-TEST'); assert.ok(r.data.html.includes('Desk lamp')); assert.equal(r.data.sample, true)
  r = await api('/api/notification-templates/preview', { method: 'POST', admin: true, body: { event: 'deposit_received', ref: ana.ref } })
  assert.equal(r.data.sample, false); assert.ok(r.data.subject.includes(ana.ref)); assert.equal(r.data.to, 'ana@example.com')
  assert.equal((await api('/api/notification-templates/preview', { method: 'POST', body: { event: 'x' } })).status, 401)
})

// ---------------------------------------------------------------- admin login (cookie sessions)

const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0]
test('auth: with a key set, the first user needs the key; then cookie sessions work without it', async () => {
  let r = await api('/api/auth/me')
  assert.equal(r.data.admin, false); assert.equal(r.data.setup, true)
  r = await api('/api/auth/setup', { method: 'POST', body: { email: 'eugene@example.com', name: 'Eugene', password: 'correct horse' } })
  assert.equal(r.status, 401)   // key required while ADMIN_API_KEY is set
  r = await api('/api/auth/setup', { method: 'POST', admin: true, body: { email: 'Eugene@Example.com', name: 'Eugene', password: 'short' } })
  assert.equal(r.status, 400)
  r = await api('/api/auth/setup', { method: 'POST', admin: true, body: { email: 'Eugene@Example.com', name: 'Eugene', password: 'correct horse' } })
  assert.equal(r.status, 201, JSON.stringify(r.data)); assert.equal(r.data.user.email, 'eugene@example.com')
  const cookie = cookieOf(r); assert.match(cookie, /^landed_admin=[a-f0-9]{64}$/)
  assert.match(r.headers.get('set-cookie'), /HttpOnly/); assert.match(r.headers.get('set-cookie'), /SameSite=Lax/)
  r = await api('/api/auth/setup', { method: 'POST', admin: true, body: { email: 'x@example.com', password: 'correct horse' } })
  assert.equal(r.status, 409)

  // the cookie is enough for admin routes
  r = await api('/api/orders', { headers: { Cookie: cookie } }); assert.equal(r.status, 200)
  r = await api('/api/auth/me', { headers: { Cookie: cookie } }); assert.equal(r.data.via, 'session'); assert.equal(r.data.user.name, 'Eugene')
  r = await api('/api/auth/me', { admin: true }); assert.equal(r.data.via, 'key')
  r = await api('/api/orders', { headers: { Cookie: 'landed_admin=' + 'f'.repeat(64) } }); assert.equal(r.status, 401)

  // login: wrong password, then right one
  r = await api('/api/auth/login', { method: 'POST', body: { email: 'eugene@example.com', password: 'nope' } }); assert.equal(r.status, 401)
  r = await api('/api/auth/login', { method: 'POST', body: { email: 'EUGENE@example.com', password: 'correct horse' } })
  assert.equal(r.status, 200); const c2 = cookieOf(r); assert.notEqual(c2, cookie)
  // logout kills that session only
  r = await api('/api/auth/logout', { method: 'POST', headers: { Cookie: c2 } }); assert.match(r.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal((await api('/api/orders', { headers: { Cookie: c2 } })).status, 401)
  assert.equal((await api('/api/orders', { headers: { Cookie: cookie } })).status, 200)

  // users: add, cannot delete self or the last one, reset password revokes sessions
  r = await api('/api/users', { method: 'POST', headers: { Cookie: cookie }, body: { email: 'helper@example.com', name: 'Helper', password: 'van driver 2026' } })
  assert.equal(r.status, 201); const helper = r.data
  r = await api('/api/users', { method: 'POST', headers: { Cookie: cookie }, body: { email: 'helper@example.com', password: 'van driver 2026' } }); assert.equal(r.status, 409)
  r = await api('/api/users', { headers: { Cookie: cookie } }); assert.equal(r.data.length, 2); assert.equal(r.data[0].password_hash, undefined)
  const me = r.data.find(u => u.email === 'eugene@example.com')
  assert.equal((await api('/api/users/' + me.id, { method: 'DELETE', headers: { Cookie: cookie } })).status, 400)
  const h = await api('/api/auth/login', { method: 'POST', body: { email: 'helper@example.com', password: 'van driver 2026' } }); const hc = cookieOf(h)
  assert.equal((await api('/api/orders', { headers: { Cookie: hc } })).status, 200)
  r = await api('/api/users/' + helper.id, { method: 'PATCH', headers: { Cookie: cookie }, body: { password: 'new password 1' } }); assert.equal(r.status, 200)
  assert.equal((await api('/api/orders', { headers: { Cookie: hc } })).status, 401)
  assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: 'helper@example.com', password: 'new password 1' } })).status, 200)
  assert.equal((await api('/api/users/' + helper.id, { method: 'DELETE', headers: { Cookie: cookie } })).status, 200)
  assert.equal((await api('/api/users/' + helper.id, { method: 'DELETE', headers: { Cookie: cookie } })).status, 400) // last one
  assert.equal((await api('/api/users')).status, 401)
})

test('auth: with no key, everything is open until the first user exists, then a session is required', async () => {
  const d2 = mkdtempSync(join(tmpdir(), 'landed-test2-'))
  const s2 = await startServer({ port: 0, quiet: true, env: { DATABASE_URL: `file:${join(d2, 't.db')}`, EMAIL_FAKE: '1', LOG_SILENT: '1' } })
  const call = async (path, opts = {}) => { const r = await fetch(s2.url + path, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})), headers: r.headers } }
  try {
    let r = await call('/api/auth/me'); assert.equal(r.data.admin, true); assert.equal(r.data.via, 'open'); assert.equal(r.data.setup, true)
    assert.equal((await call('/api/orders')).status, 200)
    r = await call('/api/auth/setup', { method: 'POST', body: { email: 'owner@example.com', password: 'first admin!' } }); assert.equal(r.status, 201)
    const cookie = cookieOf(r)
    assert.equal((await call('/api/orders')).status, 401)
    assert.equal((await call('/api/orders', { headers: { Cookie: cookie } })).status, 200)
    r = await call('/api/auth/me'); assert.equal(r.data.admin, false); assert.equal(r.data.setup, false)
  } finally { await s2.close(); rmSync(d2, { recursive: true, force: true }) }
})
