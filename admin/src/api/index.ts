/** Typed calls per feature (from duties-api's per-feature api.ts files, collapsed into one module). */
import { api } from './client'
import type { AdminUser } from '@/stores/session'
import type { BillingSummary, Invoice, LogRow, Notification, Order, OrderDetail, Payment, Preview, RunRow, Stats, Template } from './types'

export interface OrderFilters { q: string; status: string; deposit_status: string; balance_status: string; halls: string; kit: string; storage: boolean; arrival_from: string; arrival_to: string; from: string; to: string }
export const defaultOrderFilters = (): OrderFilters => ({ q: '', status: '', deposit_status: '', balance_status: '', halls: '', kit: '', storage: false, arrival_from: '', arrival_to: '', from: '', to: '' })

export const ordersApi = {
  list: (f: Partial<OrderFilters>, limit = 1000) => api.get<Order[]>('/orders', { ...f, limit }),
  get: (ref: string) => api.get<OrderDetail>(`/orders/${encodeURIComponent(ref)}`),
  update: (ref: string, body: Record<string, unknown>) => api.patch<OrderDetail & { transitions: string[]; sent: { event: string; ok: boolean; skipped: boolean }[] }>(`/orders/${ref}`, body),
  remove: (ref: string) => api.delete<{ ok: boolean }>(`/orders/${ref}`),
  notify: (ref: string, event: string) => api.post<{ ok: boolean; skipped?: boolean; error?: string }>(`/orders/${ref}/notify`, { event }),
  cancel: (ref: string, reason: string, force: boolean) => api.post<{ depositOutcome: string; refunded: boolean; refundError: string | null; order: Order }>(`/orders/${ref}/cancel`, { reason, force }),
  refund: (ref: string, body: { kind: 'deposit' | 'balance'; amount?: number | null; reason?: string }) => api.post<{ kind: string; amount: number; provider: string; creditNote: Invoice; order: Order }>(`/orders/${ref}/refund`, body),
  invoice: (ref: string) => api.post<Invoice>(`/orders/${ref}/invoice`),
}

export const deliveriesApi = {
  list: (p: { date?: string; from?: string; to?: string; halls?: string; status?: string; kind?: string }) => api.get<RunRow[]>('/deliveries', { ...p, limit: 2000 }),
  patch: (id: number, body: { status?: string; note?: string | null; scheduled_date?: string; notify?: boolean }) => api.patch<{ ref: string; transitions: string[]; order: Order; sent: { ok: boolean; skipped: boolean } | null }>(`/deliveries/${id}`, body),
  reminders: (date: string, halls?: string, resend = false) => api.post<{ count: number; results: { ref: string; ok?: boolean; skipped?: boolean | string; error?: string | null }[] }>('/deliveries', { action: 'reminders', date, halls: halls || undefined, resend }),
  bulk: (ids: number[], status: string, note?: string) => api.post<{ count: number; results: { id: number; ref?: string; ok: boolean; error?: string }[] }>('/deliveries', { action: 'bulk', ids, status, note }),
}

export const billingApi = {
  summary: () => api.get<BillingSummary>('/billing'),
  payments: (p: Record<string, unknown>) => api.get<Payment[]>('/payments', { ...p, limit: 1000 }),
  invoices: (p: Record<string, unknown>) => api.get<Invoice[]>('/invoices', { ...p, limit: 1000 }),
  invoice: (number: string) => api.get<Invoice>(`/invoices/${encodeURIComponent(number)}`),
  invoiceHtml: (number: string) => api.text(`/invoices/${encodeURIComponent(number)}`, { format: 'html' }),
}

export const statsApi = { get: () => api.get<Stats>('/stats') }

export const emailsApi = {
  log: (p: { status?: string; event?: string; ref?: string; limit?: number }) => api.get<Notification[]>('/notifications', { limit: 200, ...p }),
  templates: () => api.get<Template[]>('/notification-templates'),
  save: (t: Template) => api.put<{ ok: boolean }>('/notification-templates', t),
  test: (event: string, to?: string) => api.post<{ ok: boolean; skipped: boolean; error: string | null }>('/notification-templates/test', { event, to: to || undefined }),
  preview: (body: { event: string; subject?: string; body_html?: string; body_text?: string; ref?: string }) => api.post<Preview>('/notification-templates/preview', body),
}

export const usersApi = {
  list: () => api.get<AdminUser[]>('/users'),
  create: (body: { email: string; name: string; password: string }) => api.post<AdminUser>('/users', body),
  setPassword: (id: string, password: string) => api.patch<{ ok: boolean }>(`/users/${id}`, { password }),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/users/${id}`),
}

export const settingsApi = {
  get: <T = Record<string, unknown>>(key: string) => api.get<T>('/settings', { key }),
  put: (key: string, body: Record<string, unknown>) => api.put<{ ok: boolean }>(`/settings?key=${key}`, body),
  logs: (p: { severity?: string; type?: string; q?: string; limit?: number }) => api.get<LogRow[]>('/logs', { limit: 200, ...p }),
  clearLogs: (days: number) => api.delete<{ ok: boolean; deleted: number }>(`/logs?days=${days}`),
}
