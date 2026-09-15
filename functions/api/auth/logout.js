/** POST /api/auth/logout  → deletes the session, clears the cookie */
import { getDb } from '../../lib/db.js'
import { json, options } from '../../lib/http.js'
import { logout, sessionCookie } from '../../lib/auth.js'

export async function onRequestPost({ request, env }) {
  await logout(getDb(env), request)
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(null, { request }) })
}
export const onRequestOptions = options
