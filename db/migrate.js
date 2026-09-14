/**
 * Migration runner with tracking (from shima.shop db/migrate.js).
 * - Tracks applied migrations in _schema_migrations
 * - Skips migrations already run; warns when an applied file changed
 * - Ignores idempotent errors (duplicate column, already exists) when re-running
 *
 * CLI:   npm run db:migrate            # pending migrations against TURSO_DATABASE_URL (.dev.vars / .env)
 *        npm run db:migrate -- --rerun 002
 * Code:  import { migrate } from './db/migrate.js'; await migrate(db)
 */
import { createClient } from '@libsql/client'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

export function loadEnv(file) {
  const out = {}
  try {
    for (const line of readFileSync(file, 'utf-8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq > 0) {
        const key = t.slice(0, eq).trim()
        const val = t.slice(eq + 1).trim()
        out[key] = val
        if (key && process.env[key] == null) process.env[key] = val
      }
    }
  } catch {}
  return out
}

const IGNORABLE_ERRORS = [
  'duplicate column name',
  'table .* already exists',
  'index .* already exists',
  'UNIQUE constraint failed',
  'column .* already exists',
]

function isIgnorableError(err) {
  const msg = (err?.message || err?.cause?.message || String(err)).toLowerCase()
  return IGNORABLE_ERRORS.some(pattern => new RegExp(pattern.replace(/\s+/g, '\\s+'), 'i').test(msg))
}

const sha256 = content => createHash('sha256').update(content).digest('hex').slice(0, 16)

// Split on ';' at end of statement, but not inside quoted strings (templates contain ';' in HTML entities).
function splitStatements(sql) {
  const out = []
  let cur = '', quote = null
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (quote) {
      cur += c
      if (c === quote) { if (sql[i + 1] === quote) { cur += quote; i++ } else quote = null }
      continue
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue }
    if (c === '-' && sql[i + 1] === '-') { const nl = sql.indexOf('\n', i); i = nl === -1 ? sql.length : nl; continue }
    if (c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export async function migrate(db, { rerun = null, log = () => {} } = {}) {
  await db.execute(`CREATE TABLE IF NOT EXISTS _schema_migrations (
    filename TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT DEFAULT (datetime('now')))`)
  const r = await db.execute('SELECT filename, checksum FROM _schema_migrations')
  const applied = Object.fromEntries(r.rows.map(row => [row.filename, row.checksum]))

  const dir = join(HERE, 'migrations')
  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()
  let ran = 0
  for (const file of files) {
    const content = await readFile(join(dir, file), 'utf-8')
    const checksum = sha256(content)
    const alreadyApplied = file in applied
    const checksumChanged = alreadyApplied && applied[file] !== checksum
    const isRerunTarget = rerun && (file.startsWith(rerun) || file === rerun || file === `${rerun}.sql`)
    if (!(isRerunTarget || !alreadyApplied || checksumChanged)) continue
    if (checksumChanged && !isRerunTarget) {
      log(`⚠ ${file}: checksum changed. Run: npm run db:migrate -- --rerun ${file.replace(/\.sql$/, '')}`)
      continue
    }
    const ignoreErrors = Object.keys(applied).length === 0 || alreadyApplied || !!rerun || checksumChanged
    for (const stmt of splitStatements(content)) {
      try { await db.execute(stmt) }
      catch (err) { if (ignoreErrors && isIgnorableError(err)) log(`  (skipped: ${err.message.slice(0, 60)})`); else throw err }
    }
    await db.execute({
      sql: `INSERT INTO _schema_migrations (filename, checksum) VALUES (?, ?)
            ON CONFLICT(filename) DO UPDATE SET checksum = excluded.checksum, applied_at = datetime('now')`,
      args: [file, checksum],
    })
    log(`Applied: ${file}`)
    ran++
  }
  return ran
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isCli) {
  loadEnv('.dev.vars'); loadEnv('.env')
  const args = process.argv.slice(2)
  const rerun = args.includes('--rerun') ? args[args.indexOf('--rerun') + 1] : null
  const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:.data/landed.db', authToken: process.env.TURSO_AUTH_TOKEN || undefined })
  migrate(db, { rerun, log: console.log })
    .then(n => { console.log(n === 0 && !rerun ? 'No pending migrations.' : `Done. ${n} migration(s) applied.`); db.close() })
    .catch(err => { console.error(err); process.exit(1) })
}
