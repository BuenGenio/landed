/** GET/PUT /api/settings?key=general|mail|app.settings  admin (from shima.shop). Secrets are masked on read. */
import { getDb, getSetting, setSetting } from '../lib/db.js'
import { json, options, readJson } from '../lib/http.js'

const ALLOWED = new Set(['general', 'mail', 'app.settings', 'billing'])
const SECRET = /pass|key|secret|token/i

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('key')
  if (!ALLOWED.has(key)) return json({ error: 'Unknown settings key' }, 400)
  const v = await getSetting(getDb(env), key, {})
  const masked = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SECRET.test(k) && x ? '••••••' : x]))
  if (key === 'general') masked._env = { whatsapp_number: env.WHATSAPP_NUMBER || '', order_email: env.ORDER_EMAIL || '', site_url: env.SITE_URL || '', stripe: !!env.STRIPE_SECRET_KEY, resend: !!env.RESEND_API_KEY }
  return json(masked)
}

export async function onRequestPut({ request, env }) {
  const key = new URL(request.url).searchParams.get('key')
  if (!ALLOWED.has(key)) return json({ error: 'Unknown settings key' }, 400)
  const body = await readJson(request)
  if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON' }, 400)
  const db = getDb(env)
  const current = await getSetting(db, key, {})
  const next = { ...current }
  for (const [k, v] of Object.entries(body)) { if (k.startsWith('_')) continue; if (v === '••••••') continue; next[k] = v }
  await setSetting(db, key, next)
  return json({ ok: true })
}
export const onRequestOptions = options
