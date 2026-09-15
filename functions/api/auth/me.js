/**
 * GET /api/auth/me  → { admin, via: 'session'|'key'|'open'|null, user, setup }
 * `setup` is true when no admin user exists yet, so the login page offers to create the first one.
 */
import { getDb } from '../../lib/db.js'
import { json, options } from '../../lib/http.js'
import { identify, countUsers } from '../../lib/auth.js'

export async function onRequestGet({ request, env }) {
  const me = await identify(request, env)
  return json({ admin: me.admin, via: me.via, user: me.user, setup: (await countUsers(getDb(env))) === 0, keyConfigured: !!env.ADMIN_API_KEY })
}
export const onRequestOptions = options
