/**
 * Database access. One interface everywhere: `db.execute(sql | { sql, args })` → `{ rows, rowsAffected, lastInsertRowid }`
 * (the libSQL shape the code was written against, from shima.shop).
 *
 *   Production   Cloudflare D1 (SQLite) through the `DB` binding in wrangler.toml, wrapped by d1Client below.
 *   Local / CI   a SQLite file (`DATABASE_URL=file:.data/landed.db`) through @libsql/client's Node build.
 *
 * Turso is no longer used; a `libsql://` DATABASE_URL still works if you ever want it.
 */
import { createClient } from '@libsql/client'

const cache = new WeakMap()

/** Wrap a D1 binding so it looks like a libSQL client. */
export function d1Client(d1) {
  const clean = v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v)
  return {
    kind: 'd1',
    async execute(q) {
      const sql = typeof q === 'string' ? q : q.sql
      const args = (typeof q === 'string' ? [] : q.args || []).map(clean)
      const r = await d1.prepare(sql).bind(...args).all()
      return { rows: r.results || [], rowsAffected: r.meta?.changes ?? 0, lastInsertRowid: r.meta?.last_row_id ?? null }
    },
    async batch(list) { const out = []; for (const q of list) out.push(await this.execute(q)); return out },
    close() {},
  }
}

export function getDb(env) {
  if (env && env.__db) return env.__db          // injected by the dev server / tests
  if (env && env.DB) {                           // D1 binding (Cloudflare Pages)
    const hit = cache.get(env); if (hit) return hit
    const client = d1Client(env.DB); cache.set(env, client); return client
  }
  const url = env?.DATABASE_URL || env?.TURSO_DATABASE_URL
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error('No database: bind a D1 database as DB in wrangler.toml, or set DATABASE_URL=file:.data/landed.db in .dev.vars for local development.')
  }
  if (env && typeof env === 'object') { const hit = cache.get(env); if (hit) return hit }
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
