<script setup lang="ts">
/**
 * Shipping: the run sheet for a day (boxes grouped by halls with the packing list, WhatsApp link and balance to
 * collect), a week view of upcoming drops, bulk status changes and the one-click reminder email.
 * Pattern from the old admin's run sheet and duties-api's DeliveriesTable, with selection added.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Printer, Download, Mail, ChevronLeft, ChevronRight, MessageCircle, CheckSquare, Square } from 'lucide-vue-next'
import { deliveriesApi } from '@/api'
import { download } from '@/api/client'
import type { RunRow } from '@/api/types'
import { fmtDate, fmtDateLong, fmtDateTime, fmtMoney, firstName, plusDays, today, waLink, DELIVERY_STATUSES } from '@/lib/format'
import { CAT } from '@/lib/catalogue'
import { toast, toastError } from '@/components/ui/toast'
import Btn from '@/components/ui/Btn.vue'
import Card from '@/components/ui/Card.vue'
import Dialog from '@/components/ui/Dialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TextInput from '@/components/ui/TextInput.vue'
import Tile from '@/components/ui/Tile.vue'

const route = useRoute()
const router = useRouter()
const date = ref(String(route.query.date || today()))
const halls = ref(String(route.query.halls || ''))
const status = ref('')
const rows = ref<RunRow[]>([])
const week = ref<RunRow[]>([])
const loading = ref(false)
const busy = ref(false)
const selected = ref(new Set<number>())

async function load() {
  loading.value = true
  try {
    const [day, upcoming] = await Promise.all([
      deliveriesApi.list({ date: date.value, halls: halls.value || undefined, status: status.value || undefined }),
      deliveriesApi.list({ from: today(), to: plusDays(60) }),
    ])
    rows.value = day.filter((d) => d.status !== 'cancelled')
    week.value = upcoming.filter((d) => ['planned', 'packed'].includes(d.status))
    selected.value = new Set([...selected.value].filter((id) => rows.value.some((r) => r.id === id)))
    router.replace({ query: { date: date.value, ...(halls.value ? { halls: halls.value } : {}) } })
  } catch (e) { toastError(e, 'Could not load the run sheet') } finally { loading.value = false }
}
watch([date, halls, status], load)
onMounted(load)

const groups = computed(() => { const g: Record<string, RunRow[]> = {}; for (const r of rows.value) (g[r.halls] ||= []).push(r); return Object.entries(g) })
const done = (d: RunRow) => ['delivered', 'reception'].includes(d.status)
const summary = computed(() => ({ boxes: rows.value.length, done: rows.value.filter(done).length, collect: rows.value.filter((d) => d.balanceStatus === 'due').reduce((s, d) => s + d.balance, 0), depositsPending: rows.value.filter((d) => d.depositStatus === 'pending').length }))
const upcomingDays = computed(() => { const m = new Map<string, { date: string; n: number; halls: Set<string> }>(); for (const d of week.value) { const e = m.get(d.date) ?? { date: d.date, n: 0, halls: new Set() }; e.n++; e.halls.add(d.halls); m.set(d.date, e) } return [...m.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 14) })
const message = (d: RunRow) => `Hi ${firstName(d.name)}, Landed here. Your box (${d.ref}) is on its way to ${d.halls}${d.building ? ', ' + d.building : ''} today. ${d.balanceStatus === 'due' ? `The balance is ${fmtMoney(d.balance)}, card or cash at the door. ` : ''}Reply here if anything has changed.`

// --- single actions
const noteFor = ref<{ ids: number[]; status: string } | null>(null)
const noteText = ref('')
async function setStatus(ids: number[], st: string) {
  if (['reception', 'failed'].includes(st)) { noteFor.value = { ids, status: st }; noteText.value = st === 'reception' ? 'Reception desk, name on the box' : ''; return }
  await apply(ids, st)
}
async function apply(ids: number[], st: string, note?: string) {
  busy.value = true
  try {
    if (ids.length === 1) { const r = await deliveriesApi.patch(ids[0], { status: st, note }); toast(`Marked ${st}` + (r.sent ? (r.sent.ok ? ', customer emailed' : ', email logged') : '')) }
    else { const r = await deliveriesApi.bulk(ids, st, note); toast(`${r.results.filter((x) => x.ok).length} of ${r.count} marked ${st}`) }
    selected.value.clear(); await load()
  } catch (e) { toastError(e) } finally { busy.value = false }
}
async function saveNote() { const n = noteFor.value!; noteFor.value = null; await apply(n.ids, n.status, noteText.value) }

// --- selection + bulk
const toggle = (id: number) => { selected.value.has(id) ? selected.value.delete(id) : selected.value.add(id); selected.value = new Set(selected.value) }
const allSelected = computed(() => rows.value.length > 0 && rows.value.every((r) => selected.value.has(r.id)))
const toggleAll = () => { selected.value = allSelected.value ? new Set() : new Set(rows.value.map((r) => r.id)) }
const bulkStatus = ref('packed')
const moveOpen = ref(false)
const moveDate = ref(date.value)
async function moveSelected() {
  busy.value = true
  try { for (const id of selected.value) await deliveriesApi.patch(id, { scheduled_date: moveDate.value }); toast(`Moved ${selected.value.size} to ${fmtDate(moveDate.value)}`); moveOpen.value = false; selected.value.clear(); await load() }
  catch (e) { toastError(e) } finally { busy.value = false }
}

async function reminders() {
  busy.value = true
  try { const r = await deliveriesApi.reminders(date.value, halls.value || undefined); toast(`${r.results.filter((x) => x.ok).length} sent, ${r.results.filter((x) => x.skipped).length} skipped of ${r.count}`); await load() }
  catch (e) { toastError(e) } finally { busy.value = false }
}
const remindOpen = ref(false)
const print = () => window.print()
const shift = (n: number) => { date.value = plusDays(n, new Date(date.value + 'T12:00:00Z')) }
</script>

<template>
  <div class="space-y-4">
    <div class="no-print flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight">Shipping</h1>
        <p class="text-sm text-ink-2">Run sheet for {{ fmtDateLong(date) }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button class="rounded-full border border-rule p-2 hover:bg-ground" aria-label="Previous day" @click="shift(-1)"><ChevronLeft class="h-4 w-4" /></button>
        <input v-model="date" type="date" class="input" />
        <button class="rounded-full border border-rule p-2 hover:bg-ground" aria-label="Next day" @click="shift(1)"><ChevronRight class="h-4 w-4" /></button>
        <Btn size="sm" variant="ghost" @click="date = today()">Today</Btn>
        <SelectInput v-model="halls" class="!w-40" placeholder="All halls" :options="CAT.halls" />
        <SelectInput v-model="status" class="!w-36" placeholder="Open and done" :options="DELIVERY_STATUSES.filter((s) => s !== 'cancelled')" />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Boxes on this run" :value="summary.boxes" :note="`${summary.done} done`" />
      <Tile label="Balance to collect" :value="fmtMoney(summary.collect)" note="card or cash at the door" tone="warn" />
      <Tile label="Deposits unpaid" :value="summary.depositsPending" :note="summary.depositsPending ? 'check before loading the van' : 'all paid'" :tone="summary.depositsPending ? 'bad' : 'ok'" />
      <Card class="!p-3">
        <p class="kicker mb-1">Next drops</p>
        <div class="flex flex-wrap gap-1">
          <button v-for="u in upcomingDays" :key="u.date" class="rounded-full border px-2 py-0.5 text-xs" :class="u.date === date ? 'border-brand bg-brand-wash text-brand-ink' : 'border-rule text-ink-2 hover:bg-ground'" :title="[...u.halls].join(', ')" @click="date = u.date">{{ fmtDate(u.date).replace(/ \d{4}$/, '') }} <b class="tnum">{{ u.n }}</b></button>
          <span v-if="!upcomingDays.length" class="text-xs text-ink-3">Nothing in the next 60 days</span>
        </div>
      </Card>
    </div>

    <div class="no-print flex flex-wrap items-center gap-2 rounded-card border border-rule bg-surface p-2">
      <button class="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-ink-2 hover:bg-ground" @click="toggleAll"><component :is="allSelected ? CheckSquare : Square" class="h-4 w-4" /> {{ selected.size ? `${selected.size} selected` : 'Select all' }}</button>
      <template v-if="selected.size">
        <SelectInput v-model="bulkStatus" class="!w-36" :options="DELIVERY_STATUSES" />
        <Btn size="sm" variant="primary" :loading="busy" @click="setStatus([...selected], bulkStatus)">Apply to {{ selected.size }}</Btn>
        <Btn size="sm" :disabled="busy" @click="moveOpen = true; moveDate = date">Move to another day</Btn>
      </template>
      <span class="flex-1" />
      <Btn size="sm" :disabled="busy || !rows.length" @click="remindOpen = true"><Mail class="h-3.5 w-3.5" /> Email reminders</Btn>
      <Btn size="sm" @click="download('/deliveries', `landed-run-${date}.csv`, { date, halls: halls || undefined, format: 'csv' })"><Download class="h-3.5 w-3.5" /> CSV</Btn>
      <Btn size="sm" @click="print"><Printer class="h-3.5 w-3.5" /> Print</Btn>
    </div>

    <EmptyState v-if="!loading && !rows.length" title="No drops on this day" text="Pick another date or one of the upcoming days above." />

    <section v-for="[h, list] in groups" :key="h" class="space-y-2" :class="loading ? 'opacity-60' : ''">
      <h2 class="kicker pt-2">{{ h }} · {{ list.length }}</h2>
      <div v-for="d in list" :key="d.id" class="grid gap-3 rounded-card border-2 bg-surface px-4 py-3 print:break-inside-avoid md:grid-cols-[auto_1fr_auto]" :class="[done(d) ? 'opacity-60' : '', selected.has(d.id) ? 'border-brand' : 'border-rule-soft']">
        <button class="no-print self-start pt-0.5 text-ink-3" :aria-label="selected.has(d.id) ? 'Deselect' : 'Select'" @click="toggle(d.id)"><component :is="selected.has(d.id) ? CheckSquare : Square" class="h-5 w-5" /></button>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <RouterLink :to="{ name: 'order', params: { ref: d.ref } }" class="text-base font-bold hover:underline">{{ d.name }}</RouterLink>
            <span class="font-mono text-xs text-ink-3">{{ d.ref }}</span>
            <StatusBadge :status="d.status" /><StatusBadge :status="d.kind" />
          </div>
          <p class="text-sm">
            <b>{{ d.building || 'room not given' }}</b> ·
            <a :href="waLink(d.phone, message(d))" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-mono text-xs text-brand-ink hover:underline"><MessageCircle class="h-3 w-3" />{{ d.phone }}</a> ·
            <span :class="d.depositStatus === 'paid' ? 'text-ink-2' : 'font-bold text-bad'">deposit {{ d.depositStatus }}</span> ·
            <span v-if="d.balanceStatus === 'due'" class="font-bold text-warn">collect {{ fmtMoney(d.balance) }}</span><span v-else class="text-ink-2">balance {{ d.balanceStatus }}</span>
          </p>
          <p v-if="d.notes" class="text-sm italic text-ink-2">{{ d.notes }}</p>
          <p v-if="d.note" class="text-xs text-ink-3">{{ d.note }}</p>
          <p v-if="d.reminderSentAt" class="text-xs text-ink-3">reminder sent {{ fmtDateTime(d.reminderSentAt) }}</p>
          <ul class="mt-1.5 columns-2 text-xs text-ink-2 md:columns-3">
            <li v-for="c in d.contents" :key="c">{{ c }}</li>
          </ul>
        </div>
        <div class="no-print flex flex-row flex-wrap gap-1 md:flex-col md:items-stretch">
          <Btn v-if="!done(d)" size="sm" variant="primary" :disabled="busy" @click="setStatus([d.id], 'delivered')">In the room</Btn>
          <Btn v-if="!done(d)" size="sm" :disabled="busy" @click="setStatus([d.id], 'reception')">Reception</Btn>
          <Btn v-if="d.status === 'planned'" size="sm" :disabled="busy" @click="setStatus([d.id], 'packed')">Packed</Btn>
          <Btn v-if="!done(d) && d.status !== 'failed'" size="sm" variant="ghost" :disabled="busy" @click="setStatus([d.id], 'failed')">Failed</Btn>
          <Btn v-if="d.balanceStatus === 'due'" size="sm" variant="ghost" :disabled="busy" @click="router.push({ name: 'order', params: { ref: d.ref } })">Take balance</Btn>
        </div>
      </div>
    </section>

    <Dialog :open="!!noteFor" :title="noteFor?.status === 'reception' ? 'Left at reception' : 'What happened?'" :description="noteFor?.status === 'reception' ? 'Goes into the email to the customer.' : undefined" @update:open="noteFor = null">
      <TextInput v-model="noteText" />
      <template #footer><Btn @click="noteFor = null">Back</Btn><Btn variant="primary" :loading="busy" @click="saveNote">Confirm</Btn></template>
    </Dialog>
    <Dialog v-model:open="moveOpen" title="Move the selected drops" description="Only the delivery date changes; the order's check-in date stays.">
      <FormField label="New date"><TextInput v-model="moveDate" type="date" /></FormField>
      <template #footer><Btn @click="moveOpen = false">Back</Btn><Btn variant="primary" :loading="busy" @click="moveSelected">Move {{ selected.size }}</Btn></template>
    </Dialog>
    <Dialog v-model:open="remindOpen" title="Email the delivery reminder?" :description="`Everyone with a planned drop on ${fmtDateLong(date)}${halls ? ' at ' + halls : ''} gets the week-before email. People who already had it are skipped.`">
      <template #footer><Btn @click="remindOpen = false">Back</Btn><Btn variant="primary" :loading="busy" @click="reminders().then(() => (remindOpen = false))">Send</Btn></template>
    </Dialog>
  </div>
</template>
