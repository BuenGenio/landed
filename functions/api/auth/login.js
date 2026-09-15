/** POST /api/auth/login { email, password }  → sets the session cookie, returns the user */
import { getDb } from '../../lib/db.js'
import { json, options, readJson } from '../../lib/http.js'
import { login, sessionCookie, AuthError } from '../../lib/auth.js'
import { log } from '../../lib/logger.js'

export async function onRequestPost({ request, env }) {
  const b = (await readJson(request)) || {}
  const db = getDb(env)
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null
  try {
    const { user, token, expires } = await login(db, { email: b.email, password: b.password, userAgent: request.headers.get('User-Agent'), ip })
    await log({ db, env }, 'info', 'auth', `Signed in: ${user.email}`, { ip })
    return json({ ok: true, user }, 200, { 'Set-Cookie': sessionCookie(token, { expires, request }) })
  } catch (err) {
    if (err instanceof AuthError) { await log({ db, env }, 'warn', 'auth', `Failed sign-in for ${String(b.email || '').slice(0, 100)}`, { ip }); return json({ error: err.message }, err.status) }
    throw err
  }
}
export const onRequestOptions = options
