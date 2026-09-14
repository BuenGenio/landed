/**
 * Application logger with configurable level and drivers (from shima.shop functions/lib/logger.js).
 * settings['app.settings'] = { "log-level": debug|info|warn|error, "log-drivers": ["console","db"] }
 */
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const DEFAULT = { level: 'info', drivers: ['console'] }

async function getLogSettings(db) {
  try {
    const r = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: ['app.settings'] })
    if (r.rows.length) {
      const s = JSON.parse(r.rows[0].value)
      const drivers = Array.isArray(s['log-drivers']) ? s['log-drivers'] : s['log-driver'] ? [s['log-driver']] : ['console']
      return { level: String(s['log-level'] || 'info').toLowerCase(), drivers: drivers.map(d => String(d).toLowerCase()) }
    }
  } catch {}
  return DEFAULT
}

export async function log(ctx, severity, type, message, metadata = {}, source) {
  const { db } = ctx || {}
  const settings = db ? await getLogSettings(db) : DEFAULT
  if ((LEVELS[severity] ?? 1) < (LEVELS[settings.level] ?? 1)) return
  let meta = {}
  if (metadata instanceof Error) meta = { error: metadata.message, stack: metadata.stack }
  else if (metadata && typeof metadata === 'object') meta = { ...metadata }
  else if (metadata != null) meta = { raw: metadata }
  const t = type || 'application'
  if (settings.drivers.includes('console') && !ctx?.env?.LOG_SILENT) {
    const fn = console[severity] || console.log
    fn(`[${t}]`, message, Object.keys(meta).length ? JSON.stringify(meta) : '')
  }
  if (settings.drivers.includes('db') && db) {
    try {
      await db.execute({
        sql: `INSERT INTO logs (severity, type, message, metadata, source, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        args: [severity, t, String(message), JSON.stringify(meta), source || null],
      })
    } catch (err) { console.error('[logger] db write failed:', err.message) }
  }
}

export function createLogger(ctx) {
  return {
    debug: (type, m, meta, src) => log(ctx, 'debug', type, m, meta, src),
    info: (type, m, meta, src) => log(ctx, 'info', type, m, meta, src),
    warn: (type, m, meta, src) => log(ctx, 'warn', type, m, meta, src),
    error: (type, m, meta, src) => log(ctx, 'error', type, m, meta, src),
  }
}
