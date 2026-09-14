/**
 * libSQL client (from shima.shop functions/lib/db.js).
 * The bare '@libsql/client' import resolves to the web build under wrangler/workerd
 * (package "workerd"/"browser" export conditions) and to the Node build in the dev
 * server, where `file:` URLs work. Production uses a Turso `libsql://` URL.
 */
import { createClient } from '@libsql/client'

const cache = new WeakMap()

export function getDb(env) {
  if (env && env.__db) return env.__db          // injected by the dev server / tests
  const url = env?.TURSO_DATABASE_URL
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error('TURSO_DATABASE_URL is not configured. Add it in Cloudflare Pages > Settings > Environment variables, or in .dev.vars for local development.')
  }
  if (env && typeof env === 'object') {
    const hit = cache.get(env)
    if (hit) return hit
  }
  const client = createClient({ url, authToken: env.TURSO_AUTH_TOKEN || undefined })
  if (env && typeof env === 'object') cache.set(env, client)
  return client
}

export async function getSetting(db, key, fallback = {}) {
  try {
    const r = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] })
    return r.rows.length ? { ...fallback, ...JSON.parse(r.rows[0].value || '{}') } : fallback
  } catch { return fallback }
}

export async function setSetting(db, key, value) {
  await db.execute({
    sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: [key, JSON.stringify(value)],
  })
}
