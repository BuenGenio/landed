/**
 * Fetch wrapper for the Landed API (from duties-api resources/js/admin/api/client.ts).
 * Auth is the HttpOnly session cookie set by /api/auth/login; a 401 sends you to the login page.
 */
export interface Problem { status: number; title: string; detail?: string; field?: string }

export class ApiError extends Error {
  constructor(public problem: Problem) { super(problem.detail || problem.title) }
}

export const API = '/api'
let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

async function request<T>(method: string, url: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string> | undefined) }
  let payload: BodyInit | undefined
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const response = await fetch(url, { ...init, method, headers, body: payload, credentials: 'same-origin' })
  if (response.status === 401 && !url.includes('/api/auth/')) { onUnauthorized?.(); throw new ApiError({ status: 401, title: 'Please sign in' }) }
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('Content-Type') ?? ''
  const data = contentType.includes('json') ? await response.json() : await response.text()
  if (!response.ok) {
    const problem: Problem = typeof data === 'object' && data
      ? { status: response.status, title: data.error ?? response.statusText, detail: data.error, field: data.field }
      : { status: response.status, title: response.statusText, detail: String(data).slice(0, 200) }
    throw new ApiError(problem)
  }
  return data as T
}

export function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    search.set(key, value === true ? '1' : String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) => request<T>('GET', API + url + (params ? query(params) : '')),
  post: <T>(url: string, body?: unknown) => request<T>('POST', API + url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', API + url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', API + url, body),
  delete: <T>(url: string) => request<T>('DELETE', API + url),
  /** GET that returns text (CSV, HTML) with the admin key attached. */
  text: (url: string, params?: Record<string, unknown>) => request<string>('GET', API + url + (params ? query(params) : ''), undefined, { headers: { Accept: 'text/plain, text/html, text/csv' } }),
}

/** Download a CSV or HTML through fetch so the same-origin cookie and error handling apply. */
export async function download(url: string, filename: string, params?: Record<string, unknown>) {
  const body = await api.text(url, params)
  const blob = new Blob([body], { type: filename.endsWith('.html') ? 'text/html' : 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
