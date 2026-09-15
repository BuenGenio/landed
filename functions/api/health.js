import { getDb } from '../lib/db.js'
import { json, options } from '../lib/http.js'
import { stripeConfigured } from '../lib/stripe.js'
import { countUsers } from '../lib/auth.js'

export async function onRequestGet({ env }) {
  let db = 'ok'
  try { await getDb(env).execute('SELECT 1') } catch (err) { db = err.message }
  const users = db === 'ok' ? await countUsers(getDb(env)) : 0
  return json({ ok: db === 'ok', db, database: env.DB ? 'd1' : 'sqlite', stripe: stripeConfigured(env), email: !!env.RESEND_API_KEY, admin: !!env.ADMIN_API_KEY || users > 0, users, time: new Date().toISOString() })
}
export const onRequestOptions = options
