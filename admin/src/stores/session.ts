/**
 * Session: who is signed in, server environment flags and the day/night mode.
 * A reactive singleton instead of duties-api's pinia store; there is one team and no roles.
 */
import { reactive } from 'vue'
import { api, setUnauthorizedHandler } from '@/api/client'

export interface Health { ok: boolean; db: string; stripe: boolean; email: boolean; admin: boolean; time: string }
export interface AdminUser { id: string; email: string; name: string | null; lastLoginAt?: string | null; createdAt?: string }
export interface Me { admin: boolean; via: 'session' | 'key' | 'open' | null; user: AdminUser | null; setup: boolean; keyConfigured: boolean }

const readMode = () => { try { return localStorage.getItem('landed.adminMode') } catch { return null } }

export const session = reactive({
  ready: false,
  me: null as Me | null,
  health: null as Health | null,
  dark: readMode() ? readMode() === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches,

  get needsLogin() { return !this.me?.admin },
  get user() { return this.me?.user ?? null },

  async load() {
    this.applyTheme()
    const [health, me] = await Promise.all([api.get<Health>('/health').catch(() => null), api.get<Me>('/auth/me').catch(() => null)])
    this.health = health
    this.me = me ?? { admin: false, via: null, user: null, setup: false, keyConfigured: false }
    this.ready = true
  },
  async login(email: string, password: string) {
    await api.post('/auth/login', { email, password })
    await this.load()
  },
  async setup(email: string, name: string, password: string) {
    await api.post('/auth/setup', { email, name, password })
    await this.load()
  },
  async logout() {
    await api.post('/auth/logout').catch(() => null)
    await this.load()
  },
  toggleDark() { this.dark = !this.dark; try { localStorage.setItem('landed.adminMode', this.dark ? 'dark' : 'light') } catch { /* ignore */ } this.applyTheme() },
  applyTheme() { document.documentElement.classList.toggle('dark', this.dark) },
})

setUnauthorizedHandler(() => { if (session.me) session.me = { ...session.me, admin: false, via: null, user: null } })
