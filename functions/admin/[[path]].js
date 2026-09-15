/**
 * Single-page-app fallback for the admin: /admin/orders/LND-XXXX is served by web/admin/index.html.
 * Pages' built-in fallback would serve the root order page instead, and a `_redirects` 200 rewrite
 * is not applied for this shape, so it is done here. Real files under /admin/ (the bundle) pass through.
 */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  if (/\.[a-z0-9]+$/i.test(url.pathname) || url.pathname === '/admin/') return env.ASSETS.fetch(request)
  if (url.pathname === '/admin') return Response.redirect(`${url.origin}/admin/${url.search}`, 302)
  const res = await env.ASSETS.fetch(new Request(`${url.origin}/admin/`, { headers: request.headers }))
  return new Response(res.body, { status: 200, headers: { ...Object.fromEntries(res.headers), 'Cache-Control': 'no-cache', 'X-Landed-SPA': '1' } })
}
