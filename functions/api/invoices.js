/** GET /api/invoices?type=&ref=&q=&from=&to=&limit=   admin: issued invoices and credit notes */
import { getDb } from '../lib/db.js'
import { json, options } from '../lib/http.js'
import { listInvoices } from '../lib/billing.js'

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), p = k => u.searchParams.get(k) || undefined
  const rows = await listInvoices(getDb(env), { type: p('type'), ref: p('ref'), q: p('q'), from: p('from'), to: p('to'), limit: p('limit') })
  return json(rows.map(({ data, ...r }) => ({ ...r, outstanding: data.outstanding, total: data.total })))
}
export const onRequestOptions = options
