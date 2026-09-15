/** GET /api/notifications?status=&event=&ref=&limit=  admin: the email log (with body text for skipped sends) */
import { getDb } from '../lib/db.js'
import { json, options } from '../lib/http.js'

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), p = k => u.searchParams.get(k)
  let sql = 'SELECT id, event, recipient, subject, order_ref, status, error_message, body_text, sent_at, created_at FROM notification_log WHERE 1=1'
  const args = []
  if (p('status')) { sql += ' AND status = ?'; args.push(p('status')) }
  if (p('event')) { sql += ' AND event = ?'; args.push(p('event')) }
  if (p('ref')) { sql += ' AND order_ref = ?'; args.push(p('ref').toUpperCase()) }
  sql += ' ORDER BY id DESC LIMIT ?'; args.push(Math.min(Number(p('limit')) || 100, 500))
  const r = await getDb(env).execute({ sql, args })
  return json(r.rows.map(x => ({ ...x })))
}
export const onRequestOptions = options
