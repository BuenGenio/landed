import { reactive } from 'vue'

export interface Toast { id: number; tone: 'ok' | 'bad' | 'info'; text: string }
const state = reactive({ items: [] as Toast[] })
let seq = 0

export function toast(text: string, tone: Toast['tone'] = 'ok', ms = 4000) {
  const id = ++seq
  state.items.push({ id, tone, text })
  window.setTimeout(() => dismiss(id), ms)
}
export function dismiss(id: number) {
  const i = state.items.findIndex((t) => t.id === id)
  if (i >= 0) state.items.splice(i, 1)
}
export const useToasts = () => state
/** Show an ApiError (or anything) as a red toast. */
export const toastError = (e: unknown, fallback = 'Something went wrong') => toast(e instanceof Error && e.message ? e.message : fallback, 'bad')
