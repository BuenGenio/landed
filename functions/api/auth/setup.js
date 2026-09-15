/**
 * POST /api/auth/setup { email, name, password }  → creates the FIRST admin user and signs them in.
 * Only works while there are no users. If ADMIN_API_KEY is set on the server, the key is required too,
 * so a freshly deployed site with a key cannot be claimed by a stranger. After that, users are managed
 * under Settings (POST /api/users).
 */
import { getDb } from '../../lib/db.js'
import { json, options, readJson } from '../../lib/http.js'
import { countUsers, createUser, hasKey, login, sessionCookie, AuthError } from '../../lib/auth.js'
import { log } from '../../lib/logger.js'

export async function onRequestPost({ request, env }) {
  const b = (await readJson(request)) || {}
  const db = getDb(env)
  if ((await countUsers(db)) > 0) return json({ error: 'Setup is done; sign in instead' }, 409)
  if (env.ADMIN_API_KEY && !hasKey(request, env)) return json({ error: 'The admin key is required to create the first user' }, 401)
  try {
    const user = await createUser(db, b)
    const s = await login(db, { email: user.email, password: b.password, userAgent: request.headers.get('User-Agent') })
    await log({ db, env }, 'info', 'auth', `First admin created: ${user.email}`)
    return json({ ok: true, user }, 201, { 'Set-Cookie': sessionCookie(s.token, { expires: s.expires, request }) })
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, err.status)
    throw err
  }
}
export const onRequestOptions = options
