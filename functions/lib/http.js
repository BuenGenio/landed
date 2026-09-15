/** Small helpers shared by every API route. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',   // no credentials are sent cross-origin; the session cookie is same-site only
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
}

export function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { ...corsHeaders, ...extra } })
}

export function text(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...corsHeaders, ...extra } })
}

export const options = () => new Response(null, { headers: corsHeaders })

export async function readJson(request) {
  try { return await request.json() } catch { return null }
}

/** Admin = valid session cookie or the ADMIN_API_KEY; see lib/auth.js. Async. */
export { isAdmin } from './auth.js'

export function siteUrl(request, env) {
  return (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
}

export const money = n => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function csv(rows, columns) {
  const esc = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [columns.join(','), ...rows.map(r => columns.map(c => esc(r[c])).join(','))].join('\n') + '\n'
}
