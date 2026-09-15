/** PATCH /api/users/:id { password }  admin: reset a password.  DELETE /api/users/:id  admin: remove (not yourself, not the last one). */
import { getDb } from '../../lib/db.js'
import { json, options, readJson } from '../../lib/http.js'
import { deleteUser, identify, listUsers, setPassword, AuthError } from '../../lib/auth.js'

export async function onRequestPatch({ request, env, params }) {
  const b = (await readJson(request)) || {}
  try { await setPassword(getDb(env), params.id, b.password); return json({ ok: true }) }
  catch (err) { if (err instanceof AuthError) return json({ error: err.message }, err.status); throw err }
}

export async function onRequestDelete({ request, env, params }) {
  const db = getDb(env)
  const me = await identify(request, env)
  if (me.user?.id === params.id) return json({ error: 'You cannot delete yourself' }, 400)
  if ((await listUsers(db)).length <= 1) return json({ error: 'Keep at least one admin user' }, 400)
  try { await deleteUser(db, params.id); return json({ ok: true }) }
  catch (err) { if (err instanceof AuthError) return json({ error: err.message }, err.status); throw err }
}
export const onRequestOptions = options
