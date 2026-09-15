<script setup lang="ts">
/**
 * Billing: money taken / refunded / outstanding, the payments ledger, issued invoices and credit notes,
 * and the business details printed on them. Pattern from duties-api's ReportsPage + InvoicingSettings.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, Search, X, FileText } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { billingApi, settingsApi } from '@/api'
import { download } from '@/api/client'
import type { BillingSummary, Invoice, Payment } from '@/api/types'
import { fmtDate, fmtDateTime, fmtMoney, humanize, today, plusDays, PAY_METHODS } from '@/lib/format'
import { toast, toastError } from '@/components/ui/toast'
import Btn from '@/components/ui/Btn.vue'
import Card from '@/components/ui/Card.vue'
import Dialog from '@/components/ui/Dialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import HtmlFrame from '@/components/ui/HtmlFrame.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TextArea from '@/components/ui/TextArea.vue'
import TextInput from '@/components/ui/TextInput.vue'
import Tile from '@/components/ui/Tile.vue'

const route = useRoute()
const router = useRouter()
const tab = ref<'ledger' | 'documents' | 'details'>((route.query.tab as 'ledger') || 'ledger')
watch(tab, (t) => router.replace({ query: { tab: t } }))

const summary = ref<BillingSummary | null>(null)
const payments = ref<Payment[]>([])
const invoices = ref<Invoice[]>([])
const loading = ref(false)
const f = reactive({ q: '', kind: '', method: '', provider: '', from: '', to: '' })
const preset = ref('')
const presets = [{ key: 'today', label: 'Today' }, { key: 'week', label: 'Last 7 days' }, { key: 'month', label: 'This month' }]
function applyPreset(key: string) {
  preset.value = key
  const t = today()
  if (key === 'today') { f.from = t; f.to = t }
  else if (key === 'week') { f.from = plusDays(-6); f.to = t }
  else if (key === 'month') { f.from = t.slice(0, 8) + '01'; f.to = t }
  else { f.from = ''; f.to = '' }
}

async function load() {
  loading.value = true
  try {
    const [s, p, i] = await Promise.all([billingApi.summary(), billingApi.payments({ ...f }), billingApi.invoices({ q: f.q, from: f.from, to: f.to })])
    summary.value = s; payments.value = p; invoices.value = i
  } catch (e) { toastError(e, 'Could not load billing') } finally { loading.value = false }
}
const reload = useDebounceFn(load, 250)
watch(() => ({ ...f }), reload, { deep: true })
onMounted(async () => { await load(); await loadDetails() })

const hasFilters = computed(() => Object.values(f).some(Boolean))
const clear = () => { Object.assign(f, { q: '', kind: '', method: '', provider: '', from: '', to: '' }); preset.value = '' }
const ledgerTotals = computed(() => ({ inn: payments.value.filter((p) => p.kind !== 'refund').reduce((s, p) => s + p.amount, 0), out: payments.value.filter((p) => p.kind === 'refund').reduce((s, p) => s + p.amount, 0) }))
const maxWeek = computed(() => Math.max(1, ...(summary.value?.byWeek ?? []).map((w) => Number(w.taken))))

// --- documents
const doc = ref<{ number: string; html: string } | null>(null)
async function open(inv: Invoice) { try { doc.value = { number: inv.number, html: await billingApi.invoiceHtml(inv.number) } } catch (e) { toastError(e) } }

// --- business details
const details = ref<Record<string, string>>({})
const saving = ref(false)
async function loadDetails() { try { details.value = await settingsApi.get<Record<string, string>>('billing') } catch (e) { toastError(e) } }
async function saveDetails() {
  saving.value = true
  try { await settingsApi.put('billing', { ...details.value, next_number: Number(details.value.next_number) || 1 }); toast('Saved') } catch (e) { toastError(e) } finally { saving.value = false }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight">Billing</h1>
        <p class="text-sm text-ink-2">Every pound in and out, with the paperwork.</p>
      </div>
      <nav class="flex gap-1 rounded-full border border-rule bg-surface p-1">
        <button v-for="t in (['ledger', 'documents', 'details'] as const)" :key="t" class="rounded-full px-3 py-1 text-sm font-semibold capitalize" :class="tab === t ? 'bg-ink text-surface dark:bg-brand dark:text-[#1B2430]' : 'text-ink-2 hover:bg-ground'" @click="tab = t">{{ t }}</button>
      </nav>
    </div>

    <div v-if="summary" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Taken" :value="fmtMoney(summary.taken)" :note="`${summary.deposits.n} deposits ${fmtMoney(summary.deposits.value)} · ${summary.balances.n} balances ${fmtMoney(summary.balances.value)}`" tone="ok" />
      <Tile label="Refunded" :value="fmtMoney(summary.refunds.value)" :note="`${summary.refunds.n} refunds · net ${fmtMoney(summary.net)}`" tone="bad" />
      <Tile label="Still to collect" :value="fmtMoney(summary.outstanding.balance)" :note="`${summary.outstanding.balanceN} balances due · ${summary.outstanding.depositsN} deposits pending (${fmtMoney(summary.outstanding.deposits)})`" tone="warn" />
      <Tile label="Booked" :value="fmtMoney(summary.booked)" :note="`${summary.invoices.invoices} invoices · ${summary.invoices.creditNotes} credit notes`" />
    </div>

    <template v-if="tab === 'ledger'">
      <div class="grid gap-4 lg:grid-cols-3">
        <Card title="Taken by week" class="lg:col-span-2">
          <div v-if="summary?.byWeek.length" class="flex h-28 items-end gap-1">
            <div v-for="w in summary.byWeek" :key="w.week" class="flex h-full flex-1 flex-col justify-end" :title="`w/c ${fmtDate(w.starts)}: ${fmtMoney(w.taken)} taken, ${fmtMoney(w.refunded)} refunded`">
              <div class="rounded-t bg-ok/80" :style="{ height: (Number(w.taken) / maxWeek) * 100 + '%' }" />
              <div v-if="Number(w.refunded)" class="bg-bad/70" :style="{ height: (Number(w.refunded) / maxWeek) * 100 + '%' }" />
            </div>
          </div>
          <EmptyState v-else title="Nothing taken yet" />
        </Card>
        <Card title="By method" flush>
          <table class="w-full text-sm">
            <tbody class="divide-y divide-rule-soft">
              <tr v-for="m in summary?.byMethod ?? []" :key="m.method + m.kind"><td class="td">{{ m.method }}</td><td class="td"><StatusBadge :status="m.kind" /></td><td class="td tnum text-right">{{ m.n }}</td><td class="td tnum text-right font-semibold">{{ fmtMoney(m.value) }}</td></tr>
              <tr v-if="!summary?.byMethod.length"><td class="td text-ink-3">Nothing yet</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div class="flex flex-wrap items-center gap-2 rounded-card border border-rule bg-surface p-2">
        <label class="relative min-w-48 flex-1"><Search class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-3" /><input v-model="f.q" type="search" placeholder="Ref, name, email, Stripe id" class="input w-full pl-8" /></label>
        <SelectInput v-model="f.kind" class="!w-32" placeholder="Kind" :options="['deposit', 'balance', 'refund']" />
        <SelectInput v-model="f.method" class="!w-32" placeholder="Method" :options="PAY_METHODS" />
        <SelectInput v-model="f.provider" class="!w-32" placeholder="Provider" :options="['stripe', 'manual']" />
        <button v-for="p in presets" :key="p.key" class="rounded-full border px-3 py-1 text-sm" :class="preset === p.key ? 'border-brand bg-brand-wash text-brand-ink' : 'border-rule text-ink-2 hover:bg-ground'" @click="applyPreset(preset === p.key ? '' : p.key)">{{ p.label }}</button>
        <input v-model="f.from" type="date" class="input" @input="preset = ''" /><input v-model="f.to" type="date" class="input" @input="preset = ''" />
        <Btn v-if="hasFilters" variant="ghost" size="sm" @click="clear"><X class="h-3.5 w-3.5" /> Clear</Btn>
        <span class="flex-1" />
        <Btn size="sm" @click="download('/payments', `landed-payments-${today()}.csv`, { ...f, format: 'csv', limit: 5000 })"><Download class="h-3.5 w-3.5" /> CSV</Btn>
      </div>

      <Card flush :class="loading ? 'opacity-60' : ''">
        <template #header><span class="text-sm font-bold">Ledger</span><span class="tnum text-xs text-ink-2">{{ payments.length }} rows · in {{ fmtMoney(ledgerTotals.inn) }} · out {{ fmtMoney(ledgerTotals.out) }} · net {{ fmtMoney(ledgerTotals.inn - ledgerTotals.out) }}</span></template>
        <div class="overflow-x-auto">
          <table v-if="payments.length" class="w-full text-sm">
            <thead class="bg-ground"><tr><th class="th">When</th><th class="th">Order</th><th class="th">Kind</th><th class="th">Method</th><th class="th">Reference</th><th class="th text-right">Amount</th><th class="th">By</th></tr></thead>
            <tbody class="divide-y divide-rule-soft">
              <tr v-for="p in payments" :key="p.id" class="row-link" @click="router.push({ name: 'order', params: { ref: p.ref } })">
                <td class="td whitespace-nowrap text-xs text-ink-2">{{ fmtDateTime(p.createdAt) }}</td>
                <td class="td"><span class="font-mono text-xs font-semibold text-brand-ink">{{ p.ref }}</span><div class="text-xs text-ink-3">{{ p.name }} · {{ p.halls }}</div></td>
                <td class="td"><StatusBadge :status="p.kind" /><span v-if="p.refundOf" class="ml-1 text-xs text-ink-2">of {{ p.refundOf }}</span><div v-if="p.note" class="text-xs text-ink-3">{{ p.note }}</div></td>
                <td class="td whitespace-nowrap">{{ p.method ?? '—' }} <StatusBadge :status="p.provider" /></td>
                <td class="td font-mono text-xs">{{ p.providerRef ?? '' }}</td>
                <td class="td tnum text-right font-semibold" :class="p.kind === 'refund' ? 'text-bad' : ''">{{ p.kind === 'refund' ? '−' : '' }}{{ fmtMoney(p.amount) }}</td>
                <td class="td text-xs text-ink-2">{{ p.userId ?? '' }}</td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-else title="No payments match" />
        </div>
      </Card>
    </template>

    <Card v-else-if="tab === 'documents'" flush>
      <template #header>
        <span class="text-sm font-bold">Invoices and credit notes</span>
        <label class="relative"><Search class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-3" /><input v-model="f.q" type="search" placeholder="Number, ref, name" class="input w-56 pl-8" /></label>
      </template>
      <table v-if="invoices.length" class="w-full text-sm">
        <thead class="bg-ground"><tr><th class="th">Number</th><th class="th">Type</th><th class="th">Order</th><th class="th">Issued</th><th class="th text-right">Amount</th><th class="th text-right">Outstanding</th><th class="th"></th></tr></thead>
        <tbody class="divide-y divide-rule-soft">
          <tr v-for="i in invoices" :key="i.id">
            <td class="td"><button class="font-mono text-xs font-semibold text-brand-ink hover:underline" @click="open(i)">{{ i.number }}</button></td>
            <td class="td"><StatusBadge :status="i.type" /></td>
            <td class="td"><RouterLink :to="{ name: 'order', params: { ref: i.ref } }" class="font-mono text-xs hover:underline">{{ i.ref }}</RouterLink><div class="text-xs text-ink-3">{{ i.name }}</div></td>
            <td class="td whitespace-nowrap text-xs text-ink-2">{{ fmtDateTime(i.issuedAt) }}</td>
            <td class="td tnum text-right font-semibold">{{ fmtMoney(i.amount) }}</td>
            <td class="td tnum text-right" :class="i.type === 'invoice' && i.outstanding ? 'text-warn' : 'text-ink-3'">{{ i.type === 'invoice' ? fmtMoney(i.outstanding) : '—' }}</td>
            <td class="td text-right"><Btn size="sm" variant="ghost" @click="open(i)"><FileText class="h-3.5 w-3.5" /> Open</Btn></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else title="No documents yet" text="Invoices are issued from an order's page; credit notes come with refunds." />
    </Card>

    <Card v-else title="Business details on invoices">
      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="saveDetails">
        <FormField label="Business name"><TextInput v-model="details.business_name" /></FormField>
        <FormField label="Email"><TextInput v-model="details.email" type="email" /></FormField>
        <FormField label="Address" class="sm:col-span-2"><TextInput v-model="details.address" /></FormField>
        <FormField label="Phone"><TextInput v-model="details.phone" /></FormField>
        <FormField label="VAT number" hint="Leave empty while not VAT registered."><TextInput v-model="details.vat_number" /></FormField>
        <FormField label="Number prefix" hint="Invoices LND-0001, credit notes LND-CN-0002; one running sequence."><TextInput v-model="details.invoice_prefix" mono /></FormField>
        <FormField label="Next number"><TextInput v-model="details.next_number" type="number" /></FormField>
        <FormField label="Footer" class="sm:col-span-2"><TextArea v-model="details.footer" :rows="3" /></FormField>
        <div class="sm:col-span-2"><Btn type="submit" variant="primary" :loading="saving">Save</Btn></div>
      </form>
    </Card>

    <Dialog :open="!!doc" :title="doc?.number ?? ''" wide @update:open="doc = null">
      <HtmlFrame v-if="doc" :html="doc.html" :filename="`${doc.number}.html`" height="36rem" />
    </Dialog>
  </div>
</template>
