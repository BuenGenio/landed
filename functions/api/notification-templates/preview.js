/**
 * POST /api/notification-templates/preview { event, subject, body_html, body_text, ref? }   admin
 * Renders a draft (unsaved) template with sample data, or with a real order when `ref` is given.
 * Pattern from duties-api's template preview: the editor calls this while you type.
 */
import { getDb } from '../../lib/db.js'
import { json, options, readJson, siteUrl } from '../../lib/http.js'
import { getTemplate, renderTemplate, sampleOrder, templateVars } from '../../lib/notifications.js'
import { getOrder } from '../../lib/orders.js'

export async function onRequestPost({ request, env }) {
  const b = (await readJson(request)) || {}
  const db = getDb(env)
  const ctx = { db, env, request, origin: siteUrl(request, env) }
  let template = { subject: b.subject, body_html: b.body_html, body_text: b.body_text }
  if (b.event && b.subject == null && b.body_html == null) template = (await getTemplate(db, b.event, { includeDisabled: true })) || template
  const order = b.ref ? await getOrder(ctx, b.ref, { audit: false }) : null
  const sample = order || sampleOrder()
  const vars = await templateVars(ctx, sample, { note: 'Left with reception under your name.' })
  return json({ to: sample.email, sample: !order, ...renderTemplate(template, vars) })
}
export const onRequestOptions = options
