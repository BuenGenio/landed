<script setup lang="ts">
/**
 * Emails: the send log (with the text of skipped sends to copy by hand) and the template editor with a
 * debounced live preview, placeholder panel, test send and unsaved-changes guard. From duties-api TemplatesSettings.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Save, Send, Check, Search } from 'lucide-vue-next'
import { emailsApi } from '@/api'
import type { Notification, Preview, Template } from '@/api/types'
import { fmtDateTime, humanize } from '@/lib/format'
import { toast, toastError } from '@/components/ui/toast'
import Btn from '@/components/ui/Btn.vue'
import Card from '@/components/ui/Card.vue'
import Dialog from '@/components/ui/Dialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TextArea from '@/components/ui/TextArea.vue'
import TextInput from '@/components/ui/TextInput.vue'
import Toggle from '@/components/ui/Toggle.vue'

const route = useRoute()
const router = useRouter()
const tab = ref<'log' | 'templates'>((route.query.tab as 'log') || 'log')
watch(tab, (t) => router.replace({ query: { ...route.query, tab: t } }))

// --- log
const log = ref<Notification[]>([])
const logStatus = ref('')
const logQ = ref('')
async function loadLog() { try { log.value = await emailsApi.log({ status: logStatus.value || undefined }) } catch (e) { toastError(e) } }
watch(logStatus, loadLog)
const shownLog = computed(() => { const q = logQ.value.toLowerCase(); return q ? log.value.filter((n) => [n.recipient, n.subject, n.order_ref, n.event].join(' ').toLowerCase().includes(q)) : log.value })
const openText = ref<Notification | null>(null)
const copyLog = () => navigator.clipboard.writeText(openText.value?.body_text ?? '').then(() => toast('Copied'))

// --- templates
const templates = ref<Template[]>([])
const event = ref(String(route.query.event || 'reservation_received'))
const template = computed(() => templates.value.find((t) => t.event === event.value) ?? null)
type Draft = { subject: string; body_html: string; body_text: string; enabled: boolean }
const draftOf = (t: Template | null): Draft => ({ subject: t?.subject ?? '', body_html: t?.body_html ?? '', body_text: t?.body_text ?? '', enabled: t?.enabled ?? true })
const draft = ref<Draft>(draftOf(null))
const original = ref<Draft>(draftOf(null))
const dirty = computed(() => (Object.keys(draft.value) as (keyof Draft)[]).some((k) => draft.value[k] !== original.value[k]))
const saving = ref(false)
function resetDraft() { draft.value = draftOf(template.value); original.value = draftOf(template.value) }
async function loadTemplates() { try { templates.value = await emailsApi.templates(); resetDraft(); schedulePreview() } catch (e) { toastError(e) } }

const pendingSwitch = ref<string | null>(null)
function select(e: string) { if (dirty.value) { pendingSwitch.value = e; return } event.value = e; resetDraft(); schedulePreview() }
onBeforeRouteLeave(() => (dirty.value ? window.confirm('Discard unsaved changes to this template?') : true))
const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty.value) e.preventDefault() }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
watch(event, (e) => router.replace({ query: { ...route.query, event: e } }))

async function save() {
  if (!template.value) return
  saving.value = true
  try { await emailsApi.save({ ...template.value, ...draft.value }); Object.assign(template.value, draft.value); resetDraft(); toast('Template saved') } catch (e) { toastError(e) } finally { saving.value = false }
}

const PLACEHOLDERS = [
  ['ref', 'Order reference, also the referral code'], ['name', 'Customer name'], ['email', 'Customer email'], ['phone', 'Customer phone'], ['total', 'Order total'], ['deposit', 'Deposit amount'], ['balance', 'Balance at the door'],
  ['deposit_status', 'pending, paid, …'], ['balance_status', 'due, paid, …'], ['arrival', 'Check-in date, long form'], ['halls', 'Halls'], ['building', 'Building and room'], ['uni', 'University'], ['items', 'What was ordered, one line'],
  ['notes', 'Customer note'], ['pay_url', 'Deposit pay link'], ['site_url', 'Site URL'], ['whatsapp', 'Your WhatsApp number'], ['note', 'Delivery note (delivered email)'], ['balance_line', 'How to pay the balance'], ['deposit_line', 'What happens to the deposit (cancel email)'],
]
const phSearch = ref('')
const token = (n: string) => '{' + '{' + n + '}' + '}'
const visiblePh = computed(() => PLACEHOLDERS.filter(([n, d]) => (n + d).toLowerCase().includes(phSearch.value.toLowerCase())))
let lastField: 'subject' | 'body_html' | 'body_text' = 'body_html'
const fieldIds = { subject: 'tpl-subject', body_html: 'tpl-html', body_text: 'tpl-text' }
function onFocusIn(e: FocusEvent) { const id = (e.target as HTMLElement | null)?.id; const f = (Object.keys(fieldIds) as (keyof typeof fieldIds)[]).find((k) => fieldIds[k] === id); if (f) lastField = f }
function insert(name: string) {
  const token = `{{${name}}}`, el = document.getElementById(fieldIds[lastField]) as HTMLInputElement | HTMLTextAreaElement | null
  const cur = draft.value[lastField], start = el?.selectionStart ?? cur.length, end = el?.selectionEnd ?? start
  draft.value[lastField] = cur.slice(0, start) + token + cur.slice(end)
  nextTick(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length) })
}

// --- preview
const preview = ref<Preview | null>(null)
const previewRef = ref('')
const previewStale = ref(false)
let timer: number | undefined, seq = 0
async function loadPreview() {
  const s = ++seq
  try { const r = await emailsApi.preview({ event: event.value, ...draft.value, ref: previewRef.value || undefined }); if (s === seq) preview.value = r }
  catch (e) { if (s === seq) toastError(e, 'Preview failed') } finally { if (s === seq) previewStale.value = false }
}
function schedulePreview() { window.clearTimeout(timer); previewStale.value = true; timer = window.setTimeout(loadPreview, 400) }
watch(draft, schedulePreview, { deep: true })
watch(previewRef, schedulePreview)

// --- test send
const testOpen = ref(false)
const testTo = ref('')
const sending = ref(false)
async function sendTest() {
  sending.value = true
  try { const r = await emailsApi.test(event.value, testTo.value); toast(r.ok ? `Test sent to ${testTo.value || 'the admin email'}` : 'Logged only: ' + r.error, r.ok ? 'ok' : 'info'); testOpen.value = false }
  catch (e) { toastError(e) } finally { sending.value = false }
}

onMounted(async () => { await Promise.all([loadLog(), loadTemplates()]) })
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight">Emails</h1>
        <p class="text-sm text-ink-2">What went out, and the templates it came from.</p>
      </div>
      <nav class="flex gap-1 rounded-full border border-rule bg-surface p-1">
        <button v-for="t in (['log', 'templates'] as const)" :key="t" class="rounded-full px-3 py-1 text-sm font-semibold capitalize" :class="tab === t ? 'bg-ink text-surface dark:bg-brand dark:text-[#1B2430]' : 'text-ink-2 hover:bg-ground'" @click="tab = t">{{ t }}</button>
      </nav>
    </div>

    <template v-if="tab === 'log'">
      <div class="flex flex-wrap items-center gap-2 rounded-card border border-rule bg-surface p-2">
        <label class="relative min-w-48 flex-1"><Search class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-3" /><input v-model="logQ" type="search" placeholder="Recipient, subject, ref" class="input w-full pl-8" /></label>
        <SelectInput v-model="logStatus" class="!w-36" placeholder="All statuses" :options="['sent', 'skipped', 'failed']" />
        <span class="text-xs text-ink-3">Skipped = no mail transport; open the row and copy the text into WhatsApp or your mail app.</span>
      </div>
      <Card flush>
        <table v-if="shownLog.length" class="w-full text-sm">
          <thead class="bg-ground"><tr><th class="th">When</th><th class="th">Event</th><th class="th">To</th><th class="th">Subject</th><th class="th">Status</th></tr></thead>
          <tbody class="divide-y divide-rule-soft">
            <tr v-for="n in shownLog" :key="n.id" class="row-link" @click="openText = n">
              <td class="td whitespace-nowrap text-xs text-ink-2">{{ fmtDateTime(n.created_at) }}</td>
              <td class="td">{{ humanize(n.event) }}<div v-if="n.order_ref"><RouterLink :to="{ name: 'order', params: { ref: n.order_ref } }" class="font-mono text-xs text-brand-ink hover:underline" @click.stop>{{ n.order_ref }}</RouterLink></div></td>
              <td class="td font-mono text-xs">{{ n.recipient }}</td>
              <td class="td">{{ n.subject }}<div v-if="n.error_message" class="text-xs text-bad">{{ n.error_message }}</div></td>
              <td class="td"><StatusBadge :status="n.status" /></td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-else title="Nothing in the log" />
      </Card>
    </template>

    <div v-else class="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)]">
      <Card flush>
        <button v-for="t in templates" :key="t.id" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ground" :class="t.event === event ? 'bg-brand-wash font-semibold text-brand-ink' : ''" @click="select(t.event)">
          <span class="h-2 w-2 shrink-0 rounded-full" :class="t.enabled ? 'bg-ok' : 'bg-rule'" :title="t.enabled ? 'Enabled' : 'Off'" />
          <span class="min-w-0 flex-1 truncate">{{ humanize(t.event) }}</span>
        </button>
      </Card>

      <Card :title="humanize(event)">
        <template #header><span class="text-xs text-ink-3" v-if="template?.updated_at">Saved {{ fmtDateTime(template.updated_at) }}</span></template>
        <form v-if="template" class="space-y-3" @focusin="onFocusIn" @submit.prevent="save">
          <FormField label="Subject" for="tpl-subject"><TextInput id="tpl-subject" v-model="draft.subject" /></FormField>
          <FormField label="HTML body" for="tpl-html" hint="Simple HTML: <p>, <b>, <a>. Placeholders in double braces."><TextArea id="tpl-html" v-model="draft.body_html" :rows="10" mono /></FormField>
          <FormField label="Plain text" for="tpl-text" hint="Optional; derived from the HTML when empty."><TextArea id="tpl-text" v-model="draft.body_text" :rows="5" mono /></FormField>
          <Toggle v-model="draft.enabled" label="Enabled (sent automatically at this step)" />
          <div>
            <div class="mb-1 flex items-center justify-between"><span class="text-xs font-medium text-ink-2">Placeholders · click to insert</span><input v-model="phSearch" placeholder="Filter" class="input !h-7 w-32 text-xs" /></div>
            <ul class="max-h-40 divide-y divide-rule-soft overflow-y-auto rounded-lg border border-rule">
              <li v-for="[n, d] in visiblePh" :key="n"><button type="button" class="flex w-full items-center gap-3 px-2.5 py-1 text-left hover:bg-ground" @click="insert(n)"><code class="rounded bg-brand-wash px-1 font-mono text-[11px] text-brand-ink" v-text="token(n)"></code><span class="text-xs text-ink-2">{{ d }}</span></button></li>
            </ul>
          </div>
          <div class="flex flex-wrap items-center gap-2 border-t border-rule-soft pt-3">
            <Btn type="submit" variant="primary" :loading="saving" :disabled="!dirty"><Save class="h-4 w-4" /> Save</Btn>
            <Btn variant="ghost" :disabled="!dirty" @click="resetDraft">Reset</Btn>
            <span v-if="!dirty" class="inline-flex items-center gap-1 text-xs text-ok"><Check class="h-3 w-3" /> Up to date</span>
            <span class="flex-1" />
            <Btn :disabled="dirty" :title="dirty ? 'Save first' : ''" @click="testOpen = true"><Send class="h-4 w-4" /> Send test</Btn>
          </div>
        </form>
        <EmptyState v-else title="Loading…" />
      </Card>

      <Card title="Preview" class="lg:col-span-2 xl:col-span-1">
        <template #header><input v-model="previewRef" placeholder="Real order ref, or sample" class="input !h-7 w-44 font-mono text-xs" /></template>
        <p v-if="preview" class="mb-2 rounded-lg bg-ground px-3 py-2 text-sm"><span class="text-ink-3">To {{ preview.to }} · subject:</span> <b>{{ preview.subject }}</b><span v-if="previewStale" class="ml-2 text-xs text-ink-3">updating…</span></p>
        <iframe v-if="preview" :srcdoc="preview.html" title="Email preview" class="h-[36rem] w-full rounded-lg border border-rule bg-white" sandbox=""></iframe>
        <EmptyState v-else title="No preview yet" />
      </Card>
    </div>

    <Dialog :open="!!openText" :title="openText?.subject ?? ''" :description="openText ? `${humanize(openText.event)} · ${openText.recipient} · ${fmtDateTime(openText.created_at)}` : ''" wide @update:open="openText = null">
      <pre class="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-ground p-3 font-mono text-xs">{{ openText?.body_text || '(no text stored)' }}</pre>
      <template #footer><Btn @click="openText = null">Close</Btn><Btn variant="primary" @click="copyLog">Copy text</Btn></template>
    </Dialog>
    <Dialog v-model:open="testOpen" title="Send a test" :description="`Sends the saved ${humanize(event)} email with sample order data.`">
      <FormField label="To" hint="Empty sends to the admin email from Settings."><TextInput v-model="testTo" type="email" placeholder="you@example.com" /></FormField>
      <template #footer><Btn variant="ghost" @click="testOpen = false">Cancel</Btn><Btn variant="primary" :loading="sending" @click="sendTest">Send now</Btn></template>
    </Dialog>
    <Dialog :open="!!pendingSwitch" title="Discard unsaved changes?" description="The template you are editing has changes that were not saved." @update:open="pendingSwitch = null">
      <template #footer><Btn variant="ghost" @click="pendingSwitch = null">Keep editing</Btn><Btn variant="danger" @click="event = pendingSwitch!; pendingSwitch = null; resetDraft(); schedulePreview()">Discard</Btn></template>
    </Dialog>
  </div>
</template>
