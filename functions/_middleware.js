/**
 * Application-wide middleware (from shima.shop functions/_middleware.js):
 * admin-key gate for admin routes, then request/response logging at the configured level.
 */
import { getDb } from './lib/db.js'
import { logApiRequest } from './lib/api-logger.js'
import { isAdmin, json } from './lib/http.js'

// Everything here needs admin (session cookie or key). Public: POST /api/orders, GET /api/orders/:ref (email-matched),
// POST /api/orders/:ref/cancel (email-matched), /api/checkout*, /api/referrals, /api/webhooks, /api/health, /api/auth/*.
function needsAdmin(path, method) {
  if (path === '/api/orders' && method === 'GET') return true
  if (path === '/api/orders' && method === 'DELETE') return true
  if (path.startsWith('/api/orders/') && (method === 'PATCH' || method === 'DELETE')) return true
  if (path.startsWith('/api/orders/') && path.endsWith('/notify')) return true
  if (path.startsWith('/api/orders/') && path.endsWith('/refund')) return true
  if (path.startsWith('/api/orders/') && path.endsWith('/invoice')) return true
  return ['/api/deliveries', '/api/stats', '/api/notification-templates', '/api/notifications', '/api/settings', '/api/logs', '/api/export', '/api/payments', '/api/invoices', '/api/billing', '/api/users']
    .some(p => path === p || path.startsWith(p + '/'))
}

async function safeReadJson(res) {
  try {
    const t = await res.clone().text()
    if (!t || t.length > 10000) return t ? `[${t.length} chars]` : null
    return JSON.parse(t)
  } catch { return null }
}

async function gateAndLog(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname, method = request.method
  if (!path.startsWith('/api/')) return context.next()
  if (method === 'OPTIONS') return context.next()
  if (needsAdmin(path, method) && !(await isAdmin(request, env))) return json({ error: 'Unauthorized' }, 401)

  const dateStart = new Date().toISOString()
  let requestData = null
  if (['POST', 'PUT', 'PATCH'].includes(method) && !path.startsWith('/api/webhooks/')) {
    try { requestData = await request.clone().json() } catch { requestData = null }
  }
  let response, handlerError = null
  try { response = await context.next() }
  catch (err) { handlerError = err; response = json({ error: err.message || 'Internal server error' }, 500) }

  const status = response.status
  const responseData = status >= 400 ? await safeReadJson(response) : null
  try {
    const db = getDb(env)
    await logApiRequest({ db, env }, {
      url: request.url, method, requestData, dateStart,
      executionTimeMs: Date.now() - new Date(dateStart).getTime(),
      responseStatus: status, responseData,
      handlerError: handlerError ? { message: handlerError.message, stack: handlerError.stack } : null,
    })
  } catch (err) { console.error('[api-logger]', err.message) }
  return response
}

export const onRequest = [gateAndLog]
