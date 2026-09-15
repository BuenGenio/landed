/** GET /api/site  public: contact details for the pages (email, WhatsApp) and the language list the API knows */
import { getDb, getSetting } from '../lib/db.js'
import { json, options } from '../lib/http.js'
import { LANG_CODES } from '../lib/notifications.js'

export async function onRequestGet({ env }) {
  let g = {}
  try { g = await getSetting(getDb(env), 'general', {}) } catch { g = {} }
  return json({
    email: g.contact_email || env.CONTACT_EMAIL || 'hello@landed.school',
    whatsapp: String(g.whatsapp_number || env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
    languages: LANG_CODES,
  }, 200, { 'Cache-Control': 'public, max-age=300' })
}
export const onRequestOptions = options
