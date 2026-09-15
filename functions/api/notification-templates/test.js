/** POST /api/notification-templates/test { event, to? }  admin: send a template with sample data */
import { getDb } from '../../lib/db.js'
import { json, options, readJson, siteUrl } from '../../lib/http.js'
import { sendTestNotification } from '../../lib/notifications.js'

export async function onRequestPost({ request, env }) {
  const b = (await readJson(request)) || {}
  if (!b.event) return json({ error: 'event required' }, 400)
  const r = await sendTestNotification({ db: getDb(env), env, request, origin: siteUrl(request, env) }, { event: b.event, to: b.to })
  return json({ ok: !!r.ok, skipped: !!r.skipped, error: r.error || null }, r.ok ? 200 : r.skipped ? 503 : 500)
}
export const onRequestOptions = options
