/** API request/response logger (from shima.shop functions/lib/api-logger.js). Severity follows status. */
import { log } from './logger.js'

const SENSITIVE = ['password', 'secret', 'apikey', 'token', 'smtp_pass', 'privatekey', 'card']

export function sanitize(obj) {
  if (obj == null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitize)
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase()
    out[k] = SENSITIVE.some(s => lower.includes(s)) ? '[REDACTED]' : sanitize(v)
  }
  return out
}

export async function logApiRequest(ctx, { url, method, requestData, dateStart, executionTimeMs, responseStatus, responseData, handlerError }) {
  const pathname = new URL(url, 'http://x').pathname
  const domain = (pathname.replace(/^\/api\/?/, '').match(/^([^/]+)/) || [])[1] || 'api'
  const status = responseStatus ?? 0
  const severity = handlerError || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'debug'
  const metadata = { url, method: method || 'GET', domain, date_start: dateStart, execution_time_ms: executionTimeMs, response_status: status }
  if (requestData != null) metadata.request_data = sanitize(requestData)
  if (responseData != null && status >= 400) metadata.response_data = sanitize(responseData)
  if (handlerError) metadata.handler_error = handlerError
  const msg = handlerError ? `API ${method} ${pathname} failed: ${handlerError.message}` : `API ${method} ${pathname}${status ? ' ' + status : ''}`
  await log(ctx, severity, 'api', msg, metadata, domain)
}
