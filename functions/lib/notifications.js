/**
 * Email notifications (from shima.shop functions/lib/notifications.js).
 * Transport: Resend (env RESEND_API_KEY) → SMTP (settings.mail, worker-mailer) → none, in which case the
 * message is logged as `skipped` with its text so the admin console can copy it into WhatsApp or mail.
 * Templates live in notification_templates ({{placeholders}}), seeded in db/migrations/003_notifications.sql.
 */
import '../../web/catalogue.js'
import { getDb, getSetting } from './db.js'
import { money } from './http.js'

const CAT = globalThis.LANDED_CATALOGUE

/** Languages the public site is built in (scripts/build-site.js); English lives at the root, the rest at /<code>/. */
export const LANG_CODES = ['en', 'es', 'zh-CN', 'zh-HK', 'zh-TW', 'pl', 'uk', 'ar', 'ro']
export const langPath = lang => (lang && lang !== 'en' && LANG_CODES.includes(lang) ? `/${lang}` : '')

export function interpolate(template, vars) {
  return String(template || '').replace(/{{\s*(\w+)\s*}}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])))
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export async function getTemplate(db, event, { includeDisabled = false } = {}) {
  const r = await db.execute({ sql: 'SELECT id, event, subject, body_html, body_text, enabled FROM notification_templates WHERE event = ?', args: [event] })
  if (!r.rows.length) return null
  const t = { ...r.rows[0], enabled: !!r.rows[0].enabled }
  return t.enabled || includeDisabled ? t : null
}

export async function logNotification(db, { event, recipient, subject, templateId, orderRef, status, errorMessage, bodyText, sentAt }) {
  await db.execute({
    sql: `INSERT INTO notification_log (event, recipient, subject, template_id, order_ref, status, error_message, body_text, sent_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [event, recipient, subject || '', templateId || null, orderRef || null, status, errorMessage || null, bodyText || null, sentAt || null],
  })
}

/** Send one email. Never throws: returns { ok, id?, skipped?, error? } and logs the attempt. */
export async function sendEmail(ctx, { to, subject, html, text, event = 'email', orderRef = null, templateId = null }) {
  const { env } = ctx
  const db = ctx.db || getDb(env)
  const plain = text || (html ? html.replace(/<[^>]+>/g, '') : '')
  const done = async (status, extra = {}) => {
    await logNotification(db, { event, recipient: to, subject, templateId, orderRef, status, bodyText: plain, sentAt: status === 'sent' ? new Date().toISOString() : null, errorMessage: extra.error })
    return { ok: status === 'sent', skipped: status === 'skipped', ...extra }
  }
  if (env.EMAIL_FAKE) return done('sent', { id: 'fake' })   // tests

  const mail = await getSetting(db, 'mail', {})
  const resendKey = env.RESEND_API_KEY || (mail.transport === 'resend' ? mail.resend_api_key : null)
  const from = env.RESEND_FROM || mail.from || 'Landed <hello@landed.scot>'
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from, to: [to], subject, html: html || `<pre>${escapeHtml(plain)}</pre>`, text: plain }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || `Resend ${res.status}`)
      return done('sent', { id: data.id })
    } catch (err) { return done('failed', { error: err.message }) }
  }
  if (mail.smtp_host) {
    try {
      const { WorkerMailer } = await import('worker-mailer')   // workerd only; the Node dev server lands in catch
      const port = Number(mail.smtp_port) || 587
      const enc = (mail.smtp_encryption || 'tls').toLowerCase()
      const opts = { host: mail.smtp_host, port, secure: enc === 'ssl' || (enc === 'tls' && port === 465), startTls: enc === 'tls' && port !== 465 }
      if (mail.smtp_user && mail.smtp_pass) { opts.credentials = { username: mail.smtp_user, password: mail.smtp_pass }; opts.authType = 'login' }
      await WorkerMailer.send(opts, { from, to, subject, html: html || undefined, text: plain })
      return done('sent')
    } catch (err) { return done('failed', { error: err.message }) }
  }
  return done('skipped', { error: 'No mail transport configured (RESEND_API_KEY or Admin > Settings > Mail)' })
}

const longDate = (iso, lang = 'en') => {
  if (!iso) return ''
  try { return new Date(iso + 'T12:00:00Z').toLocaleDateString(lang.startsWith('en') ? 'en-GB' : lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) }
  catch { return iso }
}

/** English description of what was ordered, one line per thing. */
export function orderLines(order) {
  const names = CAT.names, lines = []
  if (order.kit === 'mix') lines.push(`Mix and match: ${order.items.map(i => names.item[i] || i).join(', ')}`)
  else lines.push(names.kit[order.kit] || order.kit)
  for (const a of order.addons || []) lines.push(`${a.n} × ${names.addon[a.id] || a.id}`)
  if (order.discount) lines.push(`Referral discount −${money(order.discount)}`)
  return lines
}

export async function templateVars(ctx, order, extra = {}) {
  const db = ctx.db || getDb(ctx.env)
  const general = await getSetting(db, 'general', {})
  const site = (ctx.env.SITE_URL || general.site_url || ctx.origin || '').replace(/\/$/, '')
  const page = site + langPath(order.lang)   // the order page in the customer's language
  const whatsapp = ctx.env.WHATSAPP_NUMBER || general.whatsapp_number || ''
  const depositLine = { pending: 'No deposit had been paid.', void: 'No deposit had been paid.', refunded: `Your ${money(order.deposit)} deposit is on its way back to you.`, kept: `As this is inside ${CAT.freeCancelDays} days of check-in the stock was already bought, so the deposit is kept.`, paid: `We will refund your ${money(order.deposit)} deposit by hand shortly.` }[order.depositStatus] || ''
  const balanceLine = order.balanceStatus === 'paid' ? 'Paid, thank you.' : order.balanceStatus === 'waived' ? 'Nothing more to pay.' : `Pay at the door by card or cash, or online: ${page}/?pay=${order.ref}&kind=balance`
  return {
    ref: order.ref, name: order.name, email: order.email, phone: order.phone || '',
    total: money(order.total), deposit: money(order.deposit), balance: money(order.balance),
    deposit_status: order.depositStatus, balance_status: order.balanceStatus,
    arrival: longDate(order.arrival, order.lang), arrival_iso: order.arrival,
    halls: order.halls || '', building: order.building || '', uni: order.uni || '',
    items: orderLines(order).join('; '), notes: order.notes || '',
    pay_url: `${page}/?pay=${order.ref}`, site_url: site, whatsapp: whatsapp ? `+${String(whatsapp).replace(/\D/g, '')}` : (ctx.env.ORDER_EMAIL || ''),
    deposit_line: depositLine, balance_line: balanceLine, note: '',
    ...extra,
  }
}

/** Send a lifecycle email to the customer (or to the admin for admin_* events). */
export async function notify(ctx, event, order, extra = {}) {
  const db = ctx.db || getDb(ctx.env)
  const template = await getTemplate(db, event)
  if (!template) return { ok: false, skipped: true, error: `No enabled template for ${event}` }
  const vars = await templateVars(ctx, order, extra)
  let to = order.email
  if (event.startsWith('admin_')) {
    const general = await getSetting(db, 'general', {})
    to = general.admin_email || ctx.env.ORDER_EMAIL
    if (!to) { await logNotification(db, { event, recipient: '(no admin email)', subject: interpolate(template.subject, vars), templateId: template.id, orderRef: order.ref, status: 'skipped', errorMessage: 'Set admin email in Settings or ORDER_EMAIL' }); return { ok: false, skipped: true } }
  }
  const { subject, html, text } = renderTemplate(template, vars)
  return sendEmail(ctx, { to, subject, html, text, event, orderRef: order.ref, templateId: template.id })
}

/** Fill a template's subject, HTML and plain text with the given vars. Pure: used by notify, the test send and the editor preview. */
export function renderTemplate(template, vars) {
  const subject = interpolate(template.subject || '', vars)
  const safe = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, k.endsWith('_url') ? v : escapeHtml(v)]))
  const html = wrapHtml(interpolate(template.body_html || '', safe), vars)
  const text = interpolate(template.body_text || String(template.body_html || '').replace(/<[^>]+>/g, ''), vars).replace(/\\n/g, '\n')
  return { subject, html, text }
}

/** A made-up order for previews and test sends. */
export function sampleOrder(email = 'student@example.com') {
  return { ref: 'LND-TEST', name: 'Test Student', email, phone: '+44 7700 900000', kit: 'both', items: [], addons: [{ id: 'lamp', n: 1, price: 12 }],
    discount: 0, total: 137, deposit: 20, balance: 117, depositStatus: 'paid', balanceStatus: 'due', arrival: '2027-09-11', halls: 'Hillhead', building: 'Crombie Hall, flat 12, room C', uni: 'UoA', notes: 'Landing late', lang: 'en' }
}

function wrapHtml(body, vars) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#EEF1F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1B2430">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden">
  <div style="background:#1B2430;padding:18px 28px;color:#fff;font-weight:800;font-size:20px;letter-spacing:-.02em">Landed <span style="color:#F0A030;font-weight:500;font-size:14px">Aberdeen</span></div>
  <div style="padding:24px 28px;font-size:16px;line-height:1.5">${body}</div>
  <div style="padding:14px 28px;background:#EEF1F4;color:#5F6D79;font-size:13px">Reference ${vars.ref}. Landed is a small Aberdeen business run by students, for students.${vars.whatsapp ? ' WhatsApp ' + vars.whatsapp + '.' : ''}</div>
</div></body></html>`
}

/** Test send of a template to the admin email, with sample data (from shima.shop sendTestNotification). */
export async function sendTestNotification(ctx, { event, to }) {
  const db = ctx.db || getDb(ctx.env)
  const general = await getSetting(db, 'general', {})
  const recipient = to || general.admin_email || ctx.env.ORDER_EMAIL
  if (!recipient) return { ok: false, error: 'No recipient: set the admin email in Settings' }
  const template = await getTemplate(db, event, { includeDisabled: true })
  if (!template) return { ok: false, error: 'Template not found' }
  return notify({ ...ctx, db }, event, sampleOrder(recipient), { note: 'Left with reception under your name.' })
}
