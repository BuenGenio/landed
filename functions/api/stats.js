/** GET /api/stats  admin: dashboard numbers, including the go/no-go (50 paid deposits by 31 July 2027) */
import { getDb } from '../lib/db.js'
import { getSetting } from '../lib/db.js'
import { json, options } from '../lib/http.js'
import { stats } from '../lib/orders.js'

export async function onRequestGet({ env }) {
  const db = getDb(env)
  const g = await getSetting(db, 'general', {})
  return json(await stats(db, { target: Number(g.go_target) || 50, targetDate: g.go_date || '2027-07-31' }))
}
export const onRequestOptions = options
