/**
 * POST /api/orders/:ref/invoice              admin: issue the order's invoice (idempotent: one per order)
 * GET  /api/orders/:ref/invoice?format=html  admin: the invoice, issuing it first if needed
 */
import { getDb } from '../../../lib/db.js'
import { json, options, text } from '../../../lib/http.js'
import { getOrder, normalizeRef } from '../../../lib/orders.js'
import { issueDocument, renderInvoiceHtml, BillingError } from '../../../lib/billing.js'

async function issue({ request, env, params }) {
  const db = getDb(env)
  const ctx = { db, env, request, userId: 'admin' }
  const order = await getOrder(ctx, normalizeRef(params.ref), { audit: false })
  if (!order) return json({ error: 'Order not found' }, 404)
  try { return await issueDocument(ctx, order, { type: 'invoice' }) }
  catch (err) { if (err instanceof BillingError) return json({ error: err.message }, err.status); throw err }
}

export async function onRequestPost(c) {
  const r = await issue(c)
  return r instanceof Response ? r : json(r, 201)
}

export async function onRequestGet(c) {
  const r = await issue(c)
  if (r instanceof Response) return r
  if (new URL(c.request.url).searchParams.get('format') === 'html') return text(renderInvoiceHtml(r), 200, { 'Content-Type': 'text/html; charset=utf-8' })
  return json(r)
}
export const onRequestOptions = options
