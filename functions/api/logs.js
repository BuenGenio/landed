/** GET /api/logs?severity=&type=&q=&limit=  admin (from shima.shop functions/api/logs.js) */
import { getDb } from '../lib/db.js'
import { json, options } from '../lib/http.js'

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), p = k => u.searchParams.get(k)
  let sql = 'SELECT id, severity, type, message, metadata, source, created_at FROM logs WHERE 1=1'
  const args = []
  if (p('severity')) { sql += ' AND severity = ?'; args.push(p('severity')) }
  if (p('type')) { sql += ' AND type = ?'; args.push(p('type')) }
  if (p('q')) { sql += ' AND message LIKE ?'; args.push(`%${p('q')}%`) }
  sql += ' ORDER BY id DESC LIMIT ?'; args.push(Math.min(Number(p('limit')) || 100, 500))
  const r = await getDb(env).execute({ sql, args })
  return json(r.rows.map(x => ({ ...x, metadata: JSON.parse(x.metadata || '{}') })))
}

export async function onRequestDelete({ request, env }) {
  const days = Number(new URL(request.url).searchParams.get('days')) || 30
  const r = await getDb(env).execute({ sql: `DELETE FROM logs WHERE created_at < datetime('now', ?)`, args: [`-${days} days`] })
  return json({ ok: true, deleted: r.rowsAffected })
}
export const onRequestOptions = options
