<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { ArrowLeft, Mail, MessageCircle, FileText, Ban, HandCoins, Undo2, Copy, Pencil, Trash2, Link as LinkIcon } from 'lucide-vue-next'
import { ordersApi, deliveriesApi, emailsApi, billingApi } from '@/api'
import type { OrderDetail, Preview } from '@/api/types'
import { fmtDate, fmtDateTime, fmtMoney, humanize, orderLines, payLink, copyText, waLink, firstName, daysUntil, ORDER_STATUSES, DEPOSIT_STATUSES, BALANCE_STATUSES, DELIVERY_STATUSES, PAY_METHODS, EVENTS } from '@/lib/format'
import { CAT, kitName } from '@/lib/catalogue'
import { session } from '@/stores/session'
import { toast, toastError } from '@/components/ui/toast'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import Card from '@/components/ui/Card.vue'
import Btn from '@/components/ui/Btn.vue'
import Dialog from '@/components/ui/Dialog.vue'
import FormField from '@/components/ui/FormField.vue'
import TextInput from '@/components/ui/TextInput.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import DescriptionList from '@/components/ui/DescriptionList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import HtmlFrame from '@/components/ui/HtmlFrame.vue'

const route = useRoute()
const router = useRouter()
const ref_ = computed(() => String(route.params.ref).toUpperCase())
const order = ref<OrderDetail | null>(null)
const loading = ref(true)
const busy = ref(false)
const tab = ref<'overview' | 'money' | 'emails' | 'history'>('overview')

async function load() {
  loading.value = true
  try { order.value = await ordersApi.get(ref_.value) } catch (e) { toastError(e, 'Could not load the order') } finally { loading.value = false }
}
async function run<T>(action: () => Promise<T>, success: string | ((r: T) => string)): Promise<T | undefined> {
  busy.value = true
  try { const r = await action(); toast(typeof success === 'function' ? success(r) : success); await load(); return r }
  catch (e) { toastError(e) } finally { busy.value = false }
}
const patch = (body: Record<string, unknown>, msg = 'Saved') => run(() => ordersApi.update(ref_.value, body), (r) => msg + (r.sent?.length ? ' · emailed ' + r.sent.map((s) => s.event.replace(/_/g, ' ')).join(', ') : ''))
const live = computed(() => order.value && order.value.status !== 'cancelled')
const balanceIsDue = computed(() => order.value?.balanceStatus === 'due' && order.value.balance > 0)

// --- edit
const editOpen = ref(false)
const form = ref<Record<string, string>>({})
function openEdit() {
  const o = order.value!; form.value = { status: o.status, arrival_date: o.arrival, deposit_status: o.depositStatus, deposit_method: o.depositMethod ?? '', balance_status: o.balanceStatus, balance_method: o.balanceMethod ?? '', halls: o.halls ?? '', building: o.building ?? '', uni: o.uni ?? '', name: o.name, email: o.email, phone: o.phone ?? '', referral_credit: String(o.referralCredit ?? 0), storage_interest: o.storageInterest ? 'yes' : 'no', admin_notes: o.adminNotes ?? '' }
  editOpen.value = true
}
async function saveEdit() {
  const body: Record<string, unknown> = { ...form.value, storage_interest: form.value.storage_interest === 'yes', referral_credit: Number(form.value.referral_credit) || 0 }
  for (const k of ['deposit_method', 'balance_method']) if (!body[k]) delete body[k]
  if (await patch(body)) editOpen.value = false
}

// --- deliveries
const deliveryNote = ref<{ id: number; status: string } | null>(null)
const noteText = ref('')
async function setDelivery(id: number, status: string) {
  if (['reception', 'failed'].includes(status)) { deliveryNote.value = { id, status }; noteText.value = status === 'reception' ? 'Reception desk, name on the box' : ''; return }
  await run(() => deliveriesApi.patch(id, { status }), (r) => `Delivery ${status}` + (r.sent ? (r.sent.ok ? ', customer emailed' : ', email logged') : ''))
}
async function saveDeliveryNote() {
  const d = deliveryNote.value!; deliveryNote.value = null
  await run(() => deliveriesApi.patch(d.id, { status: d.status, note: noteText.value }), (r) => `Delivery ${d.status}` + (r.sent ? (r.sent.ok ? ', customer emailed' : ', email logged') : ''))
}
const reschedule = ref<{ id: number; date: string } | null>(null)

// --- money
const cancelOpen = ref(false)
const cancelReason = ref('')
const cancelForce = ref(false)
const refundOpen = ref<'deposit' | 'balance' | null>(null)
const refundAmount = ref<number | null>(null)
const refundReason = ref('')
const canRefund = (kind: 'deposit' | 'balance') => order.value && (kind === 'deposit' ? ['paid', 'kept'].includes(order.value.depositStatus) : order.value.balanceStatus === 'paid')
const refundIsCard = computed(() => { const o = order.value; if (!o || !refundOpen.value) return false; const m = refundOpen.value === 'deposit' ? o.depositMethod : o.balanceMethod; return m === 'card' || m === 'link' })
function openRefund(kind: 'deposit' | 'balance') { refundOpen.value = kind; refundAmount.value = kind === 'deposit' ? order.value!.deposit : order.value!.balance; refundReason.value = '' }
async function doRefund() {
  const kind = refundOpen.value!
  const r = await run(() => ordersApi.refund(ref_.value, { kind, amount: refundAmount.value, reason: refundReason.value }), (r) => `Refunded ${fmtMoney(r.amount)} via ${r.provider} · credit note ${r.creditNote.number}`)
  if (r) refundOpen.value = null
}
const deleteOpen = ref(false)
const docOpen = ref<{ title: string; html: string; filename: string } | null>(null)
async function showInvoice() {
  busy.value = true
  try { const inv = await ordersApi.invoice(ref_.value); const html = await billingApi.invoiceHtml(inv.number); docOpen.value = { title: `${inv.number}`, html, filename: `${inv.number}.html` }; await load() }
  catch (e) { toastError(e) } finally { busy.value = false }
}
async function showDoc(number: string) {
  try { docOpen.value = { title: number, html: await billingApi.invoiceHtml(number), filename: `${number}.html` } } catch (e) { toastError(e) }
}
async function copy(text: string, what = 'Copied') { toast((await copyText(text)) ? `${what}: ${text}` : 'Copy failed', 'info', 2500) }

// --- emails
const notifyOpen = ref(false)
const notifyEvent = ref<string>('reservation_received')
const preview = ref<Preview | null>(null)
const previewLoading = ref(false)
async function loadPreview() {
  previewLoading.value = true; preview.value = null
  try { preview.value = await emailsApi.preview({ event: notifyEvent.value, ref: ref_.value }) } catch (e) { toastError(e, 'Preview failed') } finally { previewLoading.value = false }
}
function openNotify(event = 'reservation_received') { notifyEvent.value = event; notifyOpen.value = true; loadPreview() }
watch(notifyEvent, () => { if (notifyOpen.value) loadPreview() })
async function send() {
  const r = await run(() => ordersApi.notify(ref_.value, notifyEvent.value), (r) => r.ok ? 'Sent' : r.skipped ? 'Logged only (no mail transport)' : 'Failed: ' + r.error)
  if (r) notifyOpen.value = false
}
const waMsg = computed(() => order.value ? `Hi ${firstName(order.value.name)}, Landed here about your reservation ${order.value.ref}.` : '')

const timeline = computed(() => order.value ? [
  { label: 'Reserved', at: order.value.createdAt }, { label: 'Deposit paid', at: order.value.depositPaidAt }, { label: 'Balance paid', at: order.value.balancePaidAt }, { label: 'Cancelled', at: order.value.cancelledAt },
].filter((t) => t.at) : [])

onMounted(load)
watch(ref_, load)
</script>

<template>
  <p v-if="loading && !order" class="py-24 text-center text-ink-3">Loading…</p>

  <div v-else-if="order" class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <RouterLink :to="{ name: 'orders' }" class="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"><ArrowLeft class="h-3.5 w-3.5" /> Orders</RouterLink>
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="font-mono text-2xl font-extrabold tracking-tight">{{ order.ref }}</h1>
          <StatusBadge :status="order.status" />
          <span v-if="order.storageInterest" class="rounded bg-ground px-1.5 py-0.5 font-mono text-xs text-ink-2">storage</span>
          <span v-if="order.referral" class="rounded bg-ground px-1.5 py-0.5 font-mono text-xs text-ink-2" title="Referral code used">via {{ order.referral }}</span>
        </div>
        <p class="mt-1 text-sm text-ink-2">
          <b class="text-ink">{{ order.name }}</b> · {{ kitName(order.kit) }} · {{ order.halls }}<span v-if="order.building">, {{ order.building }}</span> · check-in {{ fmtDate(order.arrival) }} ({{ daysUntil(order.arrival) }} days)
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Btn size="sm" :disabled="busy" @click="openEdit"><Pencil class="h-3.5 w-3.5" /> Edit</Btn>
        <Btn size="sm" :disabled="busy" @click="openNotify()"><Mail class="h-3.5 w-3.5" /> Email</Btn>
        <a :href="waLink(order.phone, waMsg)" target="_blank" rel="noopener" class="inline-flex h-8 items-center gap-1.5 rounded-full border border-rule bg-surface px-3 text-xs font-semibold hover:bg-ground"><MessageCircle class="h-3.5 w-3.5" /> WhatsApp</a>
        <Btn size="sm" :disabled="busy" @click="showInvoice"><FileText class="h-3.5 w-3.5" /> Invoice</Btn>
        <Btn v-if="live" size="sm" variant="danger" :disabled="busy" @click="cancelOpen = true; cancelReason = ''; cancelForce = false"><Ban class="h-3.5 w-3.5" /> Cancel</Btn>
        <Btn v-else size="sm" variant="danger" :disabled="busy" @click="deleteOpen = true"><Trash2 class="h-3.5 w-3.5" /> Delete</Btn>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <p class="kicker">Total</p>
        <p class="tnum mt-1 text-2xl font-extrabold">{{ fmtMoney(order.total) }}</p>
        <p class="text-xs text-ink-2">kit {{ fmtMoney(order.kitTotal) }} + add-ons {{ fmtMoney(order.addonsTotal) }}<span v-if="order.discount"> − referral {{ fmtMoney(order.discount) }}</span></p>
      </Card>
      <Card>
        <p class="kicker">Deposit {{ fmtMoney(order.deposit) }}</p>
        <p class="mt-1 flex items-center gap-2"><StatusBadge :status="order.depositStatus" /><span class="text-xs text-ink-2">{{ order.depositMethod }} {{ order.depositPaidAt ? fmtDateTime(order.depositPaidAt) : '' }}</span></p>
        <div class="mt-2 flex flex-wrap gap-1">
          <template v-if="order.depositStatus === 'pending' && live">
            <Btn size="sm" variant="primary" :disabled="busy" @click="patch({ deposit_status: 'paid', deposit_method: 'cash' }, 'Deposit recorded')"><HandCoins class="h-3.5 w-3.5" /> Cash</Btn>
            <Btn size="sm" :disabled="busy" @click="patch({ deposit_status: 'paid', deposit_method: 'bank' }, 'Deposit recorded')">Bank</Btn>
            <Btn size="sm" variant="ghost" :disabled="busy" @click="copy(payLink(order.ref), 'Pay link')"><LinkIcon class="h-3.5 w-3.5" /> Link</Btn>
          </template>
          <Btn v-if="canRefund('deposit')" size="sm" :disabled="busy" @click="openRefund('deposit')"><Undo2 class="h-3.5 w-3.5" /> Refund</Btn>
        </div>
      </Card>
      <Card>
        <p class="kicker">Balance at the door</p>
        <p class="tnum mt-1 flex items-center gap-2 text-2xl font-extrabold">{{ fmtMoney(order.balance) }} <StatusBadge :status="order.balanceStatus" /></p>
        <p v-if="order.referralCredit" class="text-xs text-ink-2">after {{ fmtMoney(order.referralCredit) }} referral credit</p>
        <div class="mt-2 flex flex-wrap gap-1">
          <template v-if="balanceIsDue && live">
            <Btn size="sm" variant="primary" :disabled="busy" @click="patch({ balance_status: 'paid', balance_method: 'cash' }, 'Balance recorded')"><HandCoins class="h-3.5 w-3.5" /> Cash</Btn>
            <Btn size="sm" :disabled="busy" @click="patch({ balance_status: 'paid', balance_method: 'card' }, 'Balance recorded')">Card</Btn>
            <Btn size="sm" variant="ghost" :disabled="busy" @click="copy(payLink(order.ref, 'balance'), 'Pay link')"><LinkIcon class="h-3.5 w-3.5" /> Link</Btn>
          </template>
          <Btn v-if="canRefund('balance')" size="sm" :disabled="busy" @click="openRefund('balance')"><Undo2 class="h-3.5 w-3.5" /> Refund</Btn>
        </div>
      </Card>
      <Card>
        <p class="kicker">Contact</p>
        <p class="mt-1 truncate text-sm"><a :href="`mailto:${order.email}`" class="text-brand-ink hover:underline">{{ order.email }}</a></p>
        <p class="text-sm"><a :href="waLink(order.phone, waMsg)" target="_blank" rel="noopener" class="font-mono text-xs text-brand-ink hover:underline">{{ order.phone }}</a></p>
        <p class="mt-1 text-xs text-ink-2">{{ order.uni }} · from {{ order.from || '—' }} · {{ order.lang }} · placed {{ fmtDateTime(order.createdAt) }}</p>
      </Card>
    </div>

    <nav class="flex gap-1 border-b border-rule">
      <button v-for="t in (['overview', 'money', 'emails', 'history'] as const)" :key="t" class="-mb-px border-b-2 px-3 py-2 text-sm font-semibold capitalize" :class="tab === t ? 'border-brand text-brand-ink' : 'border-transparent text-ink-2 hover:text-ink'" @click="tab = t">
        {{ t }}
        <span v-if="t === 'money'" class="tnum ml-1 text-xs text-ink-3">{{ order.payments.length }}</span>
        <span v-if="t === 'emails'" class="tnum ml-1 text-xs text-ink-3">{{ order.notifications.length }}</span>
      </button>
    </nav>

    <div v-if="tab === 'overview'" class="grid gap-4 lg:grid-cols-3">
      <Card title="Deliveries" class="lg:col-span-2">
        <div v-if="order.deliveries.length" class="space-y-2">
          <div v-for="d in order.deliveries" :key="d.id" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule-soft px-3 py-2" :class="['delivered', 'reception', 'cancelled'].includes(d.status) ? 'opacity-70' : ''">
            <div>
              <div class="flex items-center gap-2"><StatusBadge :status="d.kind" /><b>{{ fmtDate(d.scheduled_date) }}</b><StatusBadge :status="d.status" /></div>
              <p v-if="d.note" class="mt-0.5 text-xs text-ink-2">{{ d.note }}</p>
              <p class="text-xs text-ink-3"><span v-if="d.delivered_at">done {{ fmtDateTime(d.delivered_at) }} · </span><span v-if="d.reminder_sent_at">reminder sent {{ fmtDateTime(d.reminder_sent_at) }}</span></p>
            </div>
            <div v-if="d.status !== 'cancelled'" class="flex flex-wrap gap-1">
              <Btn v-if="!['delivered', 'reception'].includes(d.status)" size="sm" variant="primary" :disabled="busy" @click="setDelivery(d.id, 'delivered')">In the room</Btn>
              <Btn v-if="!['delivered', 'reception'].includes(d.status)" size="sm" :disabled="busy" @click="setDelivery(d.id, 'reception')">Reception</Btn>
              <Btn v-if="d.status === 'planned'" size="sm" :disabled="busy" @click="setDelivery(d.id, 'packed')">Packed</Btn>
              <Btn v-if="!['delivered', 'reception', 'failed'].includes(d.status)" size="sm" variant="ghost" :disabled="busy" @click="setDelivery(d.id, 'failed')">Failed</Btn>
              <Btn size="sm" variant="ghost" :disabled="busy" @click="reschedule = { id: d.id, date: d.scheduled_date }">Move</Btn>
            </div>
          </div>
        </div>
        <EmptyState v-else title="No deliveries planned" />
        <p class="kicker mt-4 mb-1">In the box</p>
        <ul class="list-disc pl-5 text-sm">
          <li v-for="l in orderLines(order)" :key="l">{{ l }}</li>
        </ul>
        <p v-if="order.notes" class="mt-3 rounded-lg bg-ground px-3 py-2 text-sm"><span class="kicker">Customer note</span><br>{{ order.notes }}</p>
        <p v-if="order.adminNotes" class="mt-2 rounded-lg bg-brand-wash px-3 py-2 text-sm"><span class="kicker">Admin note</span><br>{{ order.adminNotes }}</p>
      </Card>
      <div class="space-y-4">
        <Card title="Timeline">
          <ol class="space-y-1.5 text-sm">
            <li v-for="t in timeline" :key="t.label" class="flex justify-between gap-3"><span>{{ t.label }}</span><span class="text-ink-2">{{ fmtDateTime(t.at) }}</span></li>
          </ol>
          <p v-if="order.cancelReason" class="mt-2 text-xs text-ink-2">{{ order.cancelReason }}</p>
        </Card>
        <Card title="Referrals">
          <DescriptionList :items="[{ label: 'Code', value: order.ref, mono: true }, { label: 'Used', value: order.referral, mono: true }, { label: 'Discount', value: order.discount ? fmtMoney(order.discount) : null }, { label: 'Credit earned', value: order.referralCredit ? fmtMoney(order.referralCredit) : null }]" />
        </Card>
      </div>
    </div>

    <div v-else-if="tab === 'money'" class="grid gap-4 lg:grid-cols-3">
      <Card title="Ledger" flush class="lg:col-span-2">
        <table v-if="order.payments.length" class="w-full text-sm">
          <thead class="bg-ground"><tr><th class="th">When</th><th class="th">Kind</th><th class="th">Method</th><th class="th">Reference</th><th class="th text-right">Amount</th><th class="th">By</th></tr></thead>
          <tbody class="divide-y divide-rule-soft">
            <tr v-for="p in order.payments" :key="p.id">
              <td class="td whitespace-nowrap text-xs text-ink-2">{{ fmtDateTime(p.createdAt) }}</td>
              <td class="td"><StatusBadge :status="p.kind" /><span v-if="p.refundOf" class="ml-1 text-xs text-ink-2">of {{ p.refundOf }}</span><div v-if="p.note" class="text-xs text-ink-3">{{ p.note }}</div></td>
              <td class="td">{{ p.method ?? '—' }} <StatusBadge :status="p.provider" /></td>
              <td class="td font-mono text-xs">{{ p.providerRef ?? '' }}</td>
              <td class="td tnum text-right font-semibold" :class="p.kind === 'refund' ? 'text-bad' : ''">{{ p.kind === 'refund' ? '−' : '' }}{{ fmtMoney(p.amount) }}</td>
              <td class="td text-xs text-ink-2">{{ p.userId ?? '' }}</td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-else title="No money moved yet" text="Card payments through Stripe and cash or bank entries recorded here land in this ledger." />
      </Card>
      <Card title="Documents" flush>
        <ul v-if="order.invoices.length" class="divide-y divide-rule-soft text-sm">
          <li v-for="inv in order.invoices" :key="inv.id" class="flex items-center justify-between gap-2 px-4 py-2">
            <div><button class="font-mono text-xs font-semibold text-brand-ink hover:underline" @click="showDoc(inv.number)">{{ inv.number }}</button><div class="text-xs text-ink-3">{{ humanize(inv.type) }} · {{ fmtDateTime(inv.issuedAt) }}</div></div>
            <span class="tnum font-semibold">{{ fmtMoney(inv.amount) }}</span>
          </li>
        </ul>
        <EmptyState v-else title="No invoice yet"><Btn size="sm" @click="showInvoice"><FileText class="h-3.5 w-3.5" /> Issue the invoice</Btn></EmptyState>
      </Card>
    </div>

    <Card v-else-if="tab === 'emails'" title="Emails to this customer" flush>
      <template #header><Btn size="sm" @click="openNotify()"><Mail class="h-3.5 w-3.5" /> Send an email</Btn></template>
      <table v-if="order.notifications.length" class="w-full text-sm">
        <thead class="bg-ground"><tr><th class="th">When</th><th class="th">Event</th><th class="th">Subject</th><th class="th">Status</th></tr></thead>
        <tbody class="divide-y divide-rule-soft">
          <tr v-for="n in order.notifications" :key="n.id">
            <td class="td whitespace-nowrap text-xs text-ink-2">{{ fmtDateTime(n.created_at) }}</td>
            <td class="td">{{ humanize(n.event) }}</td>
            <td class="td">{{ n.subject }}</td>
            <td class="td"><StatusBadge :status="n.status" /><div v-if="n.error_message" class="text-xs text-bad">{{ n.error_message }}</div></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else title="Nothing sent yet" />
    </Card>

    <Card v-else title="Audit trail" flush>
      <ol class="divide-y divide-rule-soft text-sm">
        <li v-for="e in order.events" :key="e.id" class="flex flex-wrap items-start justify-between gap-2 px-4 py-2">
          <span><b>{{ humanize(e.activity) }}</b><span v-if="e.user_id" class="text-ink-2"> by {{ e.user_id }}</span><span class="ml-2 font-mono text-[11px] text-ink-3">{{ JSON.stringify(e.payload).slice(0, 180) }}</span></span>
          <span class="whitespace-nowrap text-xs text-ink-3">{{ e.origin_ip }} {{ e.origin_country }} · {{ fmtDateTime(e.created_at) }}</span>
        </li>
      </ol>
    </Card>

    <!-- dialogs -->
    <Dialog v-model:open="editOpen" title="Edit order" description="Setting deposit or balance to paid emails the customer and writes the ledger." wide>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FormField label="Status"><SelectInput v-model="form.status" :options="ORDER_STATUSES" /></FormField>
        <FormField label="Check-in"><TextInput v-model="form.arrival_date" type="date" /></FormField>
        <FormField label="Halls"><SelectInput v-model="form.halls" :options="CAT.halls" /></FormField>
        <FormField label="Deposit"><SelectInput v-model="form.deposit_status" :options="DEPOSIT_STATUSES" /></FormField>
        <FormField label="Deposit method"><SelectInput v-model="form.deposit_method" placeholder="—" :options="PAY_METHODS" /></FormField>
        <FormField label="Building / room"><TextInput v-model="form.building" /></FormField>
        <FormField label="Balance"><SelectInput v-model="form.balance_status" :options="BALANCE_STATUSES" /></FormField>
        <FormField label="Balance method"><SelectInput v-model="form.balance_method" placeholder="—" :options="PAY_METHODS" /></FormField>
        <FormField label="University"><SelectInput v-model="form.uni" :options="CAT.unis" /></FormField>
        <FormField label="Name"><TextInput v-model="form.name" /></FormField>
        <FormField label="Email"><TextInput v-model="form.email" type="email" /></FormField>
        <FormField label="Phone"><TextInput v-model="form.phone" mono /></FormField>
        <FormField label="Referral credit £"><TextInput v-model="form.referral_credit" type="number" /></FormField>
        <FormField label="Storage interest"><SelectInput v-model="form.storage_interest" :options="['no', 'yes']" /></FormField>
        <FormField label="Admin notes" class="sm:col-span-2 lg:col-span-3"><TextInput v-model="form.admin_notes" /></FormField>
      </div>
      <template #footer><Btn @click="editOpen = false">Cancel</Btn><Btn variant="primary" :loading="busy" @click="saveEdit">Save</Btn></template>
    </Dialog>

    <Dialog :open="!!deliveryNote" :title="deliveryNote?.status === 'reception' ? 'Left at reception' : 'What happened?'" :description="deliveryNote?.status === 'reception' ? 'Goes into the email to the customer.' : undefined" @update:open="deliveryNote = null">
      <TextInput v-model="noteText" />
      <template #footer><Btn @click="deliveryNote = null">Back</Btn><Btn variant="primary" :loading="busy" @click="saveDeliveryNote">Confirm</Btn></template>
    </Dialog>

    <Dialog :open="!!reschedule" title="Move this drop" @update:open="reschedule = null">
      <TextInput v-if="reschedule" v-model="reschedule.date" type="date" />
      <template #footer><Btn @click="reschedule = null">Back</Btn><Btn variant="primary" :loading="busy" @click="run(() => deliveriesApi.patch(reschedule!.id, { scheduled_date: reschedule!.date }), 'Moved').then(() => (reschedule = null))">Move</Btn></template>
    </Dialog>

    <Dialog v-model:open="notifyOpen" title="Send an email" wide>
      <div class="grid gap-3 sm:grid-cols-2">
        <FormField label="Template"><SelectInput v-model="notifyEvent" :options="EVENTS.filter((e) => !e.startsWith('admin_')).map((e) => ({ value: e, label: humanize(e) }))" /></FormField>
        <FormField label="To"><TextInput :model-value="order.email" disabled /></FormField>
      </div>
      <div class="mt-3">
        <p v-if="previewLoading" class="p-4 text-sm text-ink-3">Rendering…</p>
        <template v-else-if="preview">
          <p class="mb-2 rounded-lg bg-ground px-3 py-2 text-sm"><span class="text-ink-3">Subject:</span> <b>{{ preview.subject }}</b></p>
          <iframe :srcdoc="preview.html" title="Preview" class="h-80 w-full rounded-lg border border-rule bg-white" sandbox=""></iframe>
        </template>
      </div>
      <template #footer><Btn @click="notifyOpen = false">Close</Btn><Btn variant="primary" :loading="busy" @click="send">Send now</Btn></template>
    </Dialog>

    <Dialog v-model:open="cancelOpen" title="Cancel this order?" :description="`Free cancellation is ${CAT.freeCancelDays} days before check-in; inside that the deposit is kept. The customer gets an email.`">
      <FormField label="Reason"><TextInput v-model="cancelReason" placeholder="Changed plans" /></FormField>
      <label class="mt-3 flex items-center gap-2 text-sm"><input v-model="cancelForce" type="checkbox" class="accent-brand" /> Refund the deposit regardless of the 14-day rule{{ session.health?.stripe ? '' : ' (card refunds need Stripe; cash and bank are recorded as handed back)' }}</label>
      <template #footer><Btn @click="cancelOpen = false">Keep</Btn><Btn variant="danger" :loading="busy" @click="run(() => ordersApi.cancel(order!.ref, cancelReason, cancelForce), (r) => `Cancelled, deposit ${r.depositOutcome}${r.refundError ? ' (refund failed: ' + r.refundError + ')' : ''}`).then(() => (cancelOpen = false))">Cancel order</Btn></template>
    </Dialog>

    <Dialog :open="!!refundOpen" :title="`Refund the ${refundOpen}`" :description="refundIsCard ? 'Goes back to the card through Stripe.' : 'Cash or bank: hand the money back yourself, this records it.'" @update:open="refundOpen = null">
      <div class="grid gap-3 sm:grid-cols-2">
        <FormField label="Amount £"><NumberInput v-model="refundAmount" :min="0.01" step="0.01" /></FormField>
        <FormField label="Reason"><TextInput v-model="refundReason" placeholder="Kettle missing" /></FormField>
      </div>
      <p class="mt-3 text-xs text-ink-3">A credit note is issued and the order's {{ refundOpen }} is marked refunded.</p>
      <template #footer><Btn @click="refundOpen = null">Back</Btn><Btn variant="danger" :loading="busy" :disabled="refundIsCard && !session.health?.stripe" @click="doRefund">Refund {{ fmtMoney(refundAmount) }}</Btn></template>
    </Dialog>

    <Dialog v-model:open="deleteOpen" title="Delete for good?" description="Removes the order, its deliveries, ledger and history. Cancelling is the normal path; this is for tests and mistakes.">
      <template #footer><Btn @click="deleteOpen = false">Keep</Btn><Btn variant="danger" :loading="busy" @click="ordersApi.remove(order!.ref).then(() => { toast('Deleted'); router.push({ name: 'orders' }) }).catch(toastError)">Delete</Btn></template>
    </Dialog>

    <Dialog :open="!!docOpen" :title="docOpen?.title ?? ''" wide @update:open="docOpen = null">
      <HtmlFrame v-if="docOpen" :html="docOpen.html" :filename="docOpen.filename" height="36rem" />
    </Dialog>
  </div>

  <EmptyState v-else title="Order not found"><RouterLink :to="{ name: 'orders' }" class="text-brand-ink hover:underline">Back to orders</RouterLink></EmptyState>
</template>
