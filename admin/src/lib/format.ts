/** Formatting helpers (from duties-api lib/format.ts, GBP and en-GB, plus Landed's order lines). */
import { addonName, itemName, kitName } from './catalogue'

export const ORDER_STATUSES = ['reserved', 'confirmed', 'delivered', 'closed', 'cancelled'] as const
export const DEPOSIT_STATUSES = ['pending', 'paid', 'refunded', 'kept', 'void'] as const
export const BALANCE_STATUSES = ['due', 'paid', 'waived', 'refunded'] as const
export const DELIVERY_STATUSES = ['planned', 'packed', 'delivered', 'reception', 'failed', 'cancelled'] as const
export const PAY_METHODS = ['card', 'cash', 'bank', 'link', 'monobank'] as const
export const EVENTS = ['reservation_received', 'deposit_received', 'delivery_reminder', 'delivered', 'balance_received', 'cancelled', 'admin_new_order'] as const

/** SQLite timestamps are 'YYYY-MM-DD HH:MM:SS' in UTC without a zone marker. */
export function parseTs(value?: string | null): Date | null {
  if (!value) return null
  const iso = value.length === 10 ? `${value}T12:00:00Z` : value.replace(' ', 'T') + (/Z$|[+-]\d\d:\d\d$/.test(value) ? '' : 'Z')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export const fmtMoney = (value?: number | string | null) => value === null || value === undefined || value === '' ? '—'
  : `£${Number(value).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
export const fmtDate = (value?: string | null) => { const d = parseTs(value); return d ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—' }
export const fmtDateLong = (value?: string | null) => { const d = parseTs(value); return d ? d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—' }
export const fmtDateTime = (value?: string | null) => { const d = parseTs(value); return d ? d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—' }
export function relative(value?: string | null): string {
  const d = parseTs(value); if (!d) return '—'
  const diff = (d.getTime() - Date.now()) / 1000, abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}
export const humanize = (value?: string | null) => (value ?? '').replace(/_/g, ' ')
export const today = () => new Date().toISOString().slice(0, 10)
export const plusDays = (n: number, from = new Date()) => new Date(from.getTime() + n * 86400000).toISOString().slice(0, 10)
export const daysUntil = (date: string) => Math.round((new Date(date + 'T12:00:00Z').getTime() - new Date(today() + 'T12:00:00Z').getTime()) / 86400000)
export const waLink = (phone: string | null | undefined, text: string) => `https://wa.me/${String(phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
export const firstName = (name: string) => name.split(' ')[0]

export interface OrderLike { kit: string; items: string[]; addons: { id: string; n: number; price?: number }[]; discount?: number }
export function orderLines(o: OrderLike): string[] {
  const l = o.kit === 'mix' ? [`Mix: ${o.items.map(itemName).join(', ')}`] : [kitName(o.kit)]
  for (const a of o.addons ?? []) l.push(`${a.n} × ${addonName(a.id)}`)
  return l
}
export const addonCount = (o: OrderLike) => (o.addons ?? []).reduce((s, a) => s + a.n, 0)

/** Customer pay link for the deposit or the balance, on the public order page. */
export const payLink = (ref: string, kind: 'deposit' | 'balance' = 'deposit') => `${location.origin}/?pay=${ref}${kind === 'balance' ? '&kind=balance' : ''}`
export const copyText = async (text: string) => { try { await navigator.clipboard.writeText(text); return true } catch { return false } }
