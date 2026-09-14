/** Small helpers shared by every API route. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

/** True when the request carries the admin key. With no ADMIN_API_KEY set, everything is admin (local dev). */
export function isAdmin(request, env) {
  const key = env.ADMIN_API_KEY
  if (!key) return true
  const auth = request.headers.get('Authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  return bearer === key || request.headers.get('X-Admin-Key') === key
}

export function requireAdmin(request, env) {
  return isAdmin(request, env) ? null : json({ error: 'Unauthorized' }, 401)
}

export function siteUrl(request, env) {
  return (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
}

export const money = n => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function csv(rows, columns) {
  const esc = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [columns.join(','), ...rows.map(r => columns.map(c => esc(r[c])).join(','))].join('\n') + '\n'
}
