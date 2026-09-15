/**
 * Seed sample orders through the HTTP API, so it works against the local dev server, wrangler's local D1
 * and the deployed site alike (no direct database access needed).
 *
 *   npm run seed                                         # http://localhost:8788 with ADMIN_API_KEY from .dev.vars
 *   npm run seed -- --url https://landed.pages.dev --key <ADMIN_API_KEY>
 *   npm run seed -- --admin you@example.com:password     # also create the first admin user (if none exists)
 *   npm run seed -- --login you@example.com:password     # sign in as an existing user instead of using a key
 *
 * Creates 8 reservations across the halls with a mix of paid / pending deposits, one delivered and paid
 * order, one cancellation, an invoice and the reminder emails for the first drop. Safe to re-run: it adds more.
 */
import { loadEnv } from '../db/migrate.js'
import { signPayload } from '../functions/lib/stripe.js'

loadEnv('.dev.vars'); loadEnv('.env')
const args = process.argv.slice(2)
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt }
const URL_ = (opt('url', process.env.SEED_URL || 'http://localhost:8788')).replace(/\/$/, '')
const KEY = opt('key', process.env.ADMIN_API_KEY || '')
const ADMIN = opt('admin', process.env.SEED_ADMIN || '')
const LOGIN = opt('login', process.env.SEED_LOGIN || '')
const WHSEC = opt('whsec', process.env.STRIPE_WEBHOOK_SECRET || '')
let cookie = ''   // session cookie from --admin / --login; used alongside (or instead of) the key

const api = async (path, { method = 'GET', body, admin = true, headers = {} } = {}) => {
  const r = await fetch(URL_ + path, { method, headers: { 'Content-Type': 'application/json', ...(admin && KEY ? { 'X-Admin-Key': KEY } : {}), ...(admin && cookie ? { Cookie: cookie } : {}), ...headers }, body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${data.error || ''}`)
  const set = r.headers.get('set-cookie'); if (set && set.startsWith('landed_admin=')) cookie = set.split(';')[0]
  return data
}
const plus = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)

const health = await api('/api/health', { admin: false })
if (!health.ok) throw new Error('API not healthy: ' + health.db)
console.log(`Seeding ${URL_} · stripe ${health.stripe ? 'on' : 'off'} · email ${health.email ? 'on' : 'log only'}`)

if (ADMIN) {
  const [email, ...rest] = ADMIN.split(':'); const password = rest.join(':')
  const me = await api('/api/auth/me', { admin: false })
  if (me.setup) { await api('/api/auth/setup', { method: 'POST', body: { email, name: email.split('@')[0], password } }); console.log(`Admin user created: ${email}`) }
  else { console.log('Admin user exists already; signing in with --admin credentials'); await api('/api/auth/login', { method: 'POST', admin: false, body: { email, password } }) }
}
if (LOGIN) {
  const [email, ...rest] = LOGIN.split(':')
  await api('/api/auth/login', { method: 'POST', admin: false, body: { email, password: rest.join(':') } }); console.log(`Signed in as ${email}`)
}
const who = await api('/api/auth/me')
if (!who.admin) throw new Error('Not admin: pass --key <ADMIN_API_KEY>, --login email:password, or --admin email:password on a fresh site')

const people = [
  ['Ana Popescu', 'Hillhead', 'Crombie Hall, flat 12', 'both', 'ro', 3], ['Wei Zhang', 'Garthdee', 'Woolmanhill 4B', 'arrival', 'zh', 3],
  ['Fatima Al-Sayed', 'Hillhead', 'Fyfe House 2', 'winter', 'en', 12], ['Tomás Silva', 'City centre halls', 'Spring Gardens 7', 'mix', 'pt', 20],
  ['Aoife Byrne', 'Private flat', 'Rosemount Place 3', 'arrival', 'en', 3], ['Kenji Sato', 'Hillhead', 'Adam Smith 9', 'both', 'ja', 30],
  ['Lena Müller', 'Garthdee', 'Woolmanhill 1A', 'arrival', 'de', 3], ['Sam Okafor', 'Hillhead', 'Crombie Hall 3', 'both', 'en', -2],
]
const refs = []
for (const [name, halls, building, kit, lang, days] of people) {
  const r = await api('/api/orders', { method: 'POST', admin: false, body: {
    kit, items: kit === 'mix' ? ['duvet', 'pillow', 'kettle', 'bottle'] : [], addons: kit === 'both' ? [{ id: 'lamp', n: 1 }] : [],
    uni: halls === 'Garthdee' ? 'RGU' : 'UoA', halls, building, arrival: plus(days), name,
    email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '+' + Date.now().toString(36) + '@example.com',
    phone: '+44 7700 900' + String(refs.length).padStart(3, '0'), from: 'Somewhere', lang, storageInterest: refs.length % 2 === 0, referral: refs[0] || '',
  } })
  refs.push(r.order.ref)
}
console.log('Orders:', refs.join(' '))

if (WHSEC) {   // card deposits through a signed Stripe webhook (needs the same STRIPE_WEBHOOK_SECRET as the server)
  for (const ref of refs.slice(0, 2)) {
    const raw = JSON.stringify({ id: 'evt_seed_' + ref, type: 'checkout.session.completed', data: { object: { id: 'cs_' + ref, payment_status: 'paid', payment_intent: 'pi_' + ref, client_reference_id: ref, metadata: { ref, kind: 'deposit' } } } })
    await api('/api/webhooks/stripe', { method: 'POST', admin: false, body: raw, headers: { 'Stripe-Signature': await signPayload(WHSEC, raw) } })
  }
} else {
  for (const ref of refs.slice(0, 2)) await api(`/api/orders/${ref}`, { method: 'PATCH', body: { deposit_status: 'paid', deposit_method: 'card', deposit_payment_id: 'pi_seed_' + ref } })
}
await api(`/api/orders/${refs[2]}`, { method: 'PATCH', body: { deposit_status: 'paid', deposit_method: 'cash' } })
await api(`/api/orders/${refs[4]}`, { method: 'PATCH', body: { deposit_status: 'paid', deposit_method: 'bank', admin_notes: 'Wants a double duvet' } })
await api(`/api/orders/${refs[7]}`, { method: 'PATCH', body: { deposit_status: 'paid', deposit_method: 'cash' } })
for (const d of await api(`/api/deliveries?date=${plus(-2)}`)) if (d.ref === refs[7]) await api(`/api/deliveries/${d.id}`, { method: 'PATCH', body: { status: 'delivered' } })
await api(`/api/orders/${refs[7]}`, { method: 'PATCH', body: { balance_status: 'paid', balance_method: 'card' } })
await api(`/api/orders/${refs[7]}/invoice`, { method: 'POST' })
await api(`/api/orders/${refs[5]}/cancel`, { method: 'POST', body: { reason: 'Deferred a year', force: true } })
const rem = await api('/api/deliveries', { method: 'POST', body: { action: 'reminders', date: plus(3) } })
console.log(`Done. ${refs.length} orders, ${rem.count} reminder emails. Open ${URL_}/admin/`)
