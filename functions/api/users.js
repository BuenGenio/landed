/** GET /api/users  admin: list admin users.  POST /api/users { email, name, password }  admin: add one. */
import { getDb } from '../lib/db.js'
import { json, options, readJson } from '../lib/http.js'
import { createUser, listUsers, AuthError } from '../lib/auth.js'

export async function onRequestGet({ env }) { return json(await listUsers(getDb(env))) }

export async function onRequestPost({ request, env }) {
  const b = (await readJson(request)) || {}
  try { return json(await createUser(getDb(env), b), 201) }
  catch (err) { if (err instanceof AuthError) return json({ error: err.message }, err.status); throw err }
}
export const onRequestOptions = options
