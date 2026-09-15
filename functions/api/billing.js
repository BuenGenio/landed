/** GET /api/billing   admin: money taken, refunded and outstanding, by method and by week */
import { getDb } from '../lib/db.js'
import { json, options } from '../lib/http.js'
import { billingSummary } from '../lib/billing.js'

export async function onRequestGet({ env }) {
  return json(await billingSummary(getDb(env)))
}
export const onRequestOptions = options
