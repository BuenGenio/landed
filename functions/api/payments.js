/** GET /api/payments?kind=&method=&provider=&ref=&q=&from=&to=&limit=&format=csv   admin: the money ledger */
import { getDb } from '../lib/db.js'
import { csv, json, options, text } from '../lib/http.js'
import { listPayments } from '../lib/billing.js'

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), p = k => u.searchParams.get(k) || undefined
  const rows = await listPayments(getDb(env), { kind: p('kind'), method: p('method'), provider: p('provider'), ref: p('ref'), q: p('q'), from: p('from'), to: p('to'), limit: p('limit'), offset: p('offset') })
  if (p('format') === 'csv') {
    const flat = rows.map(r => ({ id: r.id, date: r.createdAt, ref: r.ref, name: r.name, email: r.email, kind: r.kind, refund_of: r.refundOf, amount: r.kind === 'refund' ? -r.amount : r.amount, currency: r.currency, method: r.method, provider: r.provider, provider_ref: r.providerRef, note: r.note, by: r.userId }))
    return text(csv(flat, Object.keys(flat[0] || { id: 1 })), 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="landed-payments-${new Date().toISOString().slice(0, 10)}.csv"` })
  }
  return json(rows)
}
export const onRequestOptions = options
