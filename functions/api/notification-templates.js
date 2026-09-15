/** GET/PUT /api/notification-templates  admin (from shima.shop) */
import { getDb } from '../lib/db.js'
import { json, options, readJson } from '../lib/http.js'

export async function onRequestGet({ env }) {
  const r = await getDb(env).execute('SELECT id, event, subject, body_html, body_text, enabled, updated_at FROM notification_templates ORDER BY event')
  return json(r.rows.map(t => ({ ...t, enabled: !!t.enabled })))
}

export async function onRequestPut({ request, env }) {
  const b = await readJson(request)
  if (!b?.id) return json({ error: 'Template id required' }, 400)
  await getDb(env).execute({
    sql: `UPDATE notification_templates SET subject = ?, body_html = ?, body_text = ?, enabled = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [b.subject ?? '', b.body_html ?? '', b.body_text ?? '', b.enabled === false ? 0 : 1, b.id],
  })
  return json({ ok: true })
}
export const onRequestOptions = options
