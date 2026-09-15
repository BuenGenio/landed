/**
 * Local dev server: serves web/ as static files and runs functions/ the way Cloudflare Pages does
 * (file-based routes, [param] segments, _middleware.js with context.next()), on a SQLite file.
 * No wrangler, no docker: `npm run dev` then open http://localhost:8788 (admin at /admin/).
 *
 * Also exported for tests: `const { url, close } = await startServer({ env, port: 0 })`.
 */
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@libsql/client'
import { migrate, loadEnv } from '../db/migrate.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(ROOT, 'web')
const FUNCTIONS = join(ROOT, 'functions')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.map': 'application/json' }

/** Build the route table from functions/: api/orders/[ref]/cancel.js → /api/orders/:ref/cancel */
async function loadRoutes() {
  const routes = [], middlewares = []
  async function walk(dir, segs) {
    for (const name of (await readdir(dir)).sort()) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) { await walk(full, [...segs, name]); continue }
      if (!name.endsWith('.js')) continue
      const mod = await import(pathToFileURL(full).href + `?t=${Date.now()}`)
      if (name === '_middleware.js') { middlewares.push({ segs, handlers: [].concat(mod.onRequest || []) }); continue }
      const base = name.replace(/\.js$/, '')
      const parts = base === 'index' ? segs : [...segs, base]
      const pattern = parts.map(p => p.startsWith('[[') ? { rest: p.slice(2, -2) } : p.startsWith('[') ? { param: p.slice(1, -1) } : p)
      routes.push({ pattern, mod, file: full })
    }
  }
  await walk(FUNCTIONS, [])
  // static segments before params before catch-alls
  routes.sort((a, b) => score(b.pattern) - score(a.pattern))
  return { routes, middlewares }
}
const score = pat => pat.reduce((s, p) => s + (typeof p === 'string' ? 3 : p.param ? 2 : 1), 0) * 10 + pat.length

function match(pattern, segs) {
  const params = {}
  let i = 0
  for (const p of pattern) {
    if (typeof p === 'string') { if (segs[i++] !== p) return null }
    else if (p.param) { if (segs[i] == null) return null; params[p.param] = decodeURIComponent(segs[i++]) }
    else { params[p.rest] = segs.slice(i).join('/'); i = segs.length }
  }
  return i === segs.length ? params : null
}

function toRequest(req, origin) {
  const url = new URL(req.url, origin)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  return new Request(url, { method: req.method, headers, body: hasBody ? req : undefined, duplex: 'half' })
}

async function send(res, response) {
  const headers = {}
  response.headers.forEach((v, k) => { headers[k] = v })
  res.writeHead(response.status, headers)
  if (response.body) {
    const reader = response.body.getReader()
    for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(value) }
  }
  res.end()
}

function serveStatic(req, res, pathname) {
  let file = join(WEB, decodeURIComponent(pathname))
  if (!file.startsWith(WEB)) { res.writeHead(403); return res.end() }
  if (pathname === '/admin') { res.writeHead(302, { Location: '/admin/' }); return res.end() }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  // the admin is a single-page app: /admin/orders/LND-XXXX is served by web/admin/index.html (web/_redirects does this on Pages)
  if (!existsSync(file) && pathname.startsWith('/admin/') && !extname(pathname)) file = join(WEB, 'admin', 'index.html')
  if (!existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found') }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
  createReadStream(file).pipe(res)
}

export async function startServer({ env = {}, port = 8788, quiet = false } = {}) {
  const dbUrl = env.DATABASE_URL || env.TURSO_DATABASE_URL || 'file:.data/landed.db'
  const db = createClient({ url: dbUrl, authToken: env.TURSO_AUTH_TOKEN || undefined })
  await migrate(db, { log: quiet ? () => {} : console.log })
  const runtimeEnv = { ...env, __db: db }
  const { routes, middlewares } = await loadRoutes()

  const server = http.createServer(async (req, res) => {
    const origin = `http://${req.headers.host || 'localhost:' + port}`
    const url = new URL(req.url, origin)
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname)
    const segs = url.pathname.split('/').filter(Boolean)
    let route = null, params = {}
    for (const r of routes) { const m = match(r.pattern, segs); if (m) { route = r; params = m; break } }
    const request = toRequest(req, origin)
    const handler = async () => {
      if (!route) return Response.json({ error: 'Not found' }, { status: 404 })
      const name = 'onRequest' + req.method[0] + req.method.slice(1).toLowerCase()
      const fn = route.mod[name] || route.mod.onRequest
      if (!fn) return Response.json({ error: 'Method not allowed' }, { status: 405 })
      return fn(context)
    }
    // middleware chain, outermost first, like Pages
    const chain = middlewares.filter(m => m.segs.every((s, i) => segs[i] === s)).flatMap(m => m.handlers)
    const context = { request, env: runtimeEnv, params, data: {}, waitUntil: () => {}, next: null }
    let i = 0
    context.next = async () => (i < chain.length ? chain[i++](context) : handler())
    try { await send(res, await context.next()) }
    catch (err) { console.error(err); await send(res, Response.json({ error: err.message }, { status: 500 })) }
  })
  await new Promise(r => server.listen(port, '127.0.0.1', r))
  const actual = server.address().port
  return { url: `http://127.0.0.1:${actual}`, port: actual, db, server, close: () => new Promise(r => server.close(() => { db.close(); r() })) }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isCli) {
  loadEnv(join(ROOT, '.dev.vars')); loadEnv(join(ROOT, '.env'))
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(DATABASE_URL|TURSO_|ADMIN_|STRIPE_|RESEND_|ORDER_EMAIL|WHATSAPP_|SITE_URL|EMAIL_FAKE|LOG_)/.test(k)))
  const port = Number(process.env.PORT) || 8788
  startServer({ env, port }).then(({ url }) => {
    console.log(`Landed dev server  ${url}   (admin: ${url}/admin/  api: ${url}/api/health)`)
    console.log(`DB ${env.DATABASE_URL || env.TURSO_DATABASE_URL || 'file:.data/landed.db'} · admin key ${env.ADMIN_API_KEY ? 'set' : 'not set (sign in at /admin/, or everything is admin until the first user exists)'} · stripe ${env.STRIPE_SECRET_KEY ? 'on' : 'off'} · email ${env.RESEND_API_KEY ? 'resend' : 'logged only'}`)
  }).catch(err => { console.error(err); process.exit(1) })
}
