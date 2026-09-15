/** GET /api/invoices/:number            admin: the document as JSON
 *  GET /api/invoices/:number?format=html admin: printable HTML (open it in an iframe or a new window) */
import { getDb } from '../../lib/db.js'
import { json, options, text } from '../../lib/http.js'
import { getInvoice, renderInvoiceHtml } from '../../lib/billing.js'

export async function onRequestGet({ request, env, params }) {
  const inv = await getInvoice(getDb(env), decodeURIComponent(params.number))
  if (!inv) return json({ error: 'Document not found' }, 404)
  if (new URL(request.url).searchParams.get('format') === 'html') return text(renderInvoiceHtml(inv), 200, { 'Content-Type': 'text/html; charset=utf-8' })
  return json(inv)
}
export const onRequestOptions = options
