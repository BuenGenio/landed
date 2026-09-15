/**
 * Admin authentication: email + password users, HttpOnly cookie sessions, and the shared admin check.
 * Pattern from shima.shop (users + admin_sessions with a hashed token, resolved in _middleware.js); the
 * password hash is PBKDF2-SHA256 through WebCrypto so it runs in workerd and in the Node dev server alike.
 *
 * A request is admin when it carries a valid session cookie, or the ADMIN_API_KEY (scripts, tests, webhooks
 * from your own tools). With no key set and no users created yet, everything is admin (first run, local dev).
 */
import { getDb } from './db.js'

export const COOKIE = 'landed_admin'
const SESSION_DAYS = 30
const PBKDF2_ITERATIONS = 100_000

const enc = new TextEncoder()
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const hex = bytes => Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('')
const randomHex = n => { const b = new Uint8Array(n); crypto.getRandomValues(b); return hex(b) }

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(bits)}`
}

export async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored || '').split('$')
  if (scheme !== 'pbkdf2' || !salt || !hash) return false
  const bits = new Uint8Array(await pbkdf2(password, unb64(salt), Number(iter) || PBKDF2_ITERATIONS))
  const want = unb64(hash)
  if (bits.length !== want.length) return false
  let diff = 0; for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ want[i]
  return diff === 0
}

export const sha256hex = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)))

export function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Password must be at least 8 characters'
  return null
}
export const normalizeEmail = e => String(e || '').trim().toLowerCase()
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

// ---------------------------------------------------------------- users

const publicUser = r => r ? ({ id: r.id, email: r.email, name: r.name, lastLoginAt: r.last_login_at, createdAt: r.created_at }) : null

export async function countUsers(db) {
  try { return Number((await db.execute('SELECT COUNT(*) AS n FROM admin_users')).rows[0].n || 0) } catch { return 0 }
}

export async function listUsers(db) {
  const r = await db.execute('SELECT id, email, name, last_login_at, created_at FROM admin_users ORDER BY created_at')
  return r.rows.map(publicUser)
}

export async function createUser(db, { email, name, password }) {
  email = normalizeEmail(email)
  if (!validEmail(email)) throw new AuthError('Enter a valid email address', 400)
  const bad = validatePassword(password); if (bad) throw new AuthError(bad, 400)
  const dup = await db.execute({ sql: 'SELECT 1 FROM admin_users WHERE email = ?', args: [email] })
  if (dup.rows.length) throw new AuthError('There is already a user with that email', 409)
  const id = 'usr_' + randomHex(8)
  await db.execute({ sql: 'INSERT INTO admin_users (id, email, name, password_hash) VALUES (?, ?, ?, ?)', args: [id, email, String(name || '').trim().slice(0, 100) || null, await hashPassword(password)] })
  return publicUser({ id, email, name, created_at: new Date().toISOString() })
}

export async function setPassword(db, id, password) {
  const bad = validatePassword(password); if (bad) throw new AuthError(bad, 400)
  const r = await db.execute({ sql: `UPDATE admin_users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, args: [await hashPassword(password), id] })
  if (!r.rowsAffected) throw new AuthError('User not found', 404)
  await db.execute({ sql: 'DELETE FROM admin_sessions WHERE user_id = ?', args: [id] })   // every other browser has to sign in again
}

export async function deleteUser(db, id) {
  const r = await db.execute({ sql: 'DELETE FROM admin_users WHERE id = ?', args: [id] })
  await db.execute({ sql: 'DELETE FROM admin_sessions WHERE user_id = ?', args: [id] })
  if (!r.rowsAffected) throw new AuthError('User not found', 404)
}

export class AuthError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

// ---------------------------------------------------------------- sessions

export async function login(db, { email, password, userAgent, ip }) {
  email = normalizeEmail(email)
  const r = await db.execute({ sql: 'SELECT * FROM admin_users WHERE email = ?', args: [email] })
  const user = r.rows[0]
  // always run the hash so a missing user takes as long as a wrong password
  const ok = await verifyPassword(String(password || ''), user ? user.password_hash : 'pbkdf2$1000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')
  if (!user || !ok) throw new AuthError('Wrong email or password', 401)
  const token = randomHex(32)
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000)
  await db.execute({
    sql: 'INSERT INTO admin_sessions (id, user_id, token_hash, user_agent, ip, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: ['ses_' + randomHex(8), user.id, await sha256hex(token), String(userAgent || '').slice(0, 300) || null, ip || null, expires.toISOString()],
  })
  await db.execute({ sql: `UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`, args: [user.id] })
  return { user: publicUser(user), token, expires }
}

export function readCookie(request, name = COOKIE) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;\\s]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

export function sessionCookie(token, { expires, request }) {
  const secure = new URL(request.url).protocol === 'https:'
  const parts = [`${COOKIE}=${token ? encodeURIComponent(token) : ''}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (secure) parts.push('Secure')
  parts.push(token ? `Expires=${expires.toUTCString()}` : 'Max-Age=0')
  return parts.join('; ')
}

/** The user behind the request's session cookie, or null. */
export async function resolveSession(db, request) {
  const token = readCookie(request)
  if (!token) return null
  try {
    const r = await db.execute({
      sql: `SELECT u.id, u.email, u.name, u.last_login_at, u.created_at, s.id AS session_id FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
      args: [await sha256hex(token)],
    })
    return r.rows.length ? { ...publicUser(r.rows[0]), sessionId: r.rows[0].session_id } : null
  } catch { return null }
}

export async function logout(db, request) {
  const token = readCookie(request)
  if (token) await db.execute({ sql: 'DELETE FROM admin_sessions WHERE token_hash = ?', args: [await sha256hex(token)] })
}

export const hasKey = (request, env) => {
  const key = env.ADMIN_API_KEY
  if (!key) return false
  const auth = request.headers.get('Authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  return bearer === key || request.headers.get('X-Admin-Key') === key
}

/**
 * Who is asking: { admin: boolean, user, via: 'session' | 'key' | 'open' | null }.
 * Cached on the request via a WeakMap so the middleware and the route share one lookup.
 */
const who = new WeakMap()
export async function identify(request, env) {
  if (who.has(request)) return who.get(request)
  const db = getDb(env)
  let out = { admin: false, user: null, via: null }
  if (hasKey(request, env)) out = { admin: true, user: null, via: 'key' }
  else {
    const user = await resolveSession(db, request)
    if (user) out = { admin: true, user, via: 'session' }
    else if (!env.ADMIN_API_KEY && (await countUsers(db)) === 0) out = { admin: true, user: null, via: 'open' }
  }
  who.set(request, out)
  return out
}

export const isAdmin = async (request, env) => (await identify(request, env)).admin
