/**
 * Order audit events (from shima.shop functions/lib/order-events.js).
 * Every create/read/update is logged with user, activity, origin, technology, method and payload.
 */
import { getDb } from './db.js'

export function extractRequestOrigin(request) {
  const headers = request?.headers || {}
  const get = h => {
    if (typeof headers.get === 'function') return headers.get(h) || headers.get(h.toLowerCase()) || ''
    return headers[h] || headers[h.toLowerCase()] || ''
  }
  return {
    origin_ip: get('CF-Connecting-IP') || get('X-Forwarded-For')?.split(',')[0]?.trim() || get('X-Real-IP') || null,
    user_agent: get('User-Agent') || null,
    origin_country: get('CF-IPCountry') || null,
    technology: get('Sec-CH-UA') || null,
    method: request?.method || null,
  }
}

export async function logOrderEvent(ctx, orderRef, activity, payload = {}) {
  const { request, userId } = ctx
  const db = ctx.db || getDb(ctx.env)
  const origin = request ? extractRequestOrigin(request) : {}
  await db.execute({
    sql: `INSERT INTO order_events (order_ref, activity, user_id, origin_ip, origin_country, user_agent, technology, method, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [orderRef, activity, userId || null, origin.origin_ip || null, origin.origin_country || null,
      origin.user_agent || null, origin.technology || null, origin.method || null,
      JSON.stringify(typeof payload === 'object' ? payload : { raw: payload })],
  })
}

export async function listOrderEvents(db, orderRef, limit = 100) {
  const r = await db.execute({
    sql: 'SELECT id, activity, user_id, origin_ip, origin_country, method, payload, created_at FROM order_events WHERE order_ref = ? ORDER BY id DESC LIMIT ?',
    args: [orderRef, limit],
  })
  return r.rows.map(row => ({ ...row, payload: JSON.parse(row.payload || '{}') }))
}
