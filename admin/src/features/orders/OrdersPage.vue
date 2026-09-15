<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, X, Download, ArrowUpDown } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { ordersApi, defaultOrderFilters, type OrderFilters } from '@/api'
import { download } from '@/api/client'
import type { Order } from '@/api/types'
import { fmtDate, fmtDateTime, fmtMoney, addonCount, today, ORDER_STATUSES, DEPOSIT_STATUSES, BALANCE_STATUSES } from '@/lib/format'
import { CAT, kitName } from '@/lib/catalogue'
import { toastError } from '@/components/ui/toast'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Pagination from '@/components/ui/Pagination.vue'
import Btn from '@/components/ui/Btn.vue'

const route = useRoute()
const router = useRouter()
const PER_PAGE = 50

const filters = reactive<OrderFilters>({ ...defaultOrderFilters(), ...fromQuery(route.query as Record<string, string>) })
const rows = ref<Order[]>([])
const loading = ref(false)
const page = ref(Number(route.query.page) || 1)
const sort = ref<{ col: keyof Order | 'balance'; dir: 'asc' | 'desc' }>({ col: 'createdAt', dir: 'desc' })

const groups = [
  { key: 'open', label: 'Open', statuses: ['reserved', 'confirmed'] },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered', 'closed'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
]

function fromQuery(q: Record<string, string>): Partial<OrderFilters> {
  const out: Partial<OrderFilters> = {}
  for (const k of ['q', 'status', 'deposit_status', 'balance_status', 'halls', 'kit', 'arrival_from', 'arrival_to', 'from', 'to'] as const) if (q[k]) out[k] = q[k]
  if (q.storage === '1') out.storage = true
  return out
}
function toQuery(): Record<string, string> {
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(filters)) if (v) q[k] = v === true ? '1' : String(v)
  if (page.value > 1) q.page = String(page.value)
  return q
}

async function load() {
  loading.value = true
  try { rows.value = await ordersApi.list(filters); router.replace({ query: toQuery() }) }
  catch (e) { toastError(e, 'Could not load orders') }
  finally { loading.value = false }
}
const reload = useDebounceFn(() => { page.value = 1; load() }, 250)
watch(() => ({ ...filters }), reload, { deep: true })

const groupSel = ref('')
const sorted = computed(() => {
  const { col, dir } = sort.value
  const s = [...rows.value].sort((a, b) => { const x = a[col as keyof Order] ?? '', y = b[col as keyof Order] ?? ''; return x < y ? -1 : x > y ? 1 : 0 })
  return dir === 'desc' ? s.reverse() : s
})
const grouped = computed(() => { const g = groups.find((g) => g.key === groupSel.value); return g ? sorted.value.filter((o) => g.statuses.includes(o.status)) : sorted.value })
const pages = computed(() => Math.max(1, Math.ceil(grouped.value.length / PER_PAGE)))
const shown = computed(() => grouped.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))
const count = (statuses: string[]) => rows.value.filter((o) => statuses.includes(o.status)).length
const hasFilters = computed(() => Object.values(filters).some(Boolean) || !!groupSel.value)
const totals = computed(() => ({ value: grouped.value.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0), due: grouped.value.filter((o) => o.status !== 'cancelled' && o.balanceStatus === 'due').reduce((s, o) => s + o.balance, 0) }))

function sortBy(col: keyof Order | 'balance') {
  if (sort.value.col === col) sort.value.dir = sort.value.dir === 'asc' ? 'desc' : 'asc'
  else sort.value = { col, dir: col === 'createdAt' ? 'desc' : 'asc' }
}
function setGroup(key: string) { groupSel.value = key; page.value = 1 }
function clear() { Object.assign(filters, defaultOrderFilters()); groupSel.value = '' }
const csv = () => download('/orders', `landed-orders-${today()}.csv`, { ...filters, format: 'csv', limit: 5000 })

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight">Orders</h1>
        <p class="text-sm text-ink-2"><span class="tnum">{{ grouped.length }}</span> matching · {{ fmtMoney(totals.value) }} booked · {{ fmtMoney(totals.due) }} still to collect</p>
      </div>
      <div class="flex flex-wrap gap-1">
        <button class="rounded-full border px-3 py-1 text-sm" :class="!groupSel ? 'border-brand bg-brand-wash text-brand-ink' : 'border-rule text-ink-2 hover:bg-ground'" @click="setGroup('')">All <span class="tnum ml-1 text-ink-3">{{ rows.length }}</span></button>
        <button v-for="g in groups" :key="g.key" class="rounded-full border px-3 py-1 text-sm" :class="groupSel === g.key ? 'border-brand bg-brand-wash text-brand-ink' : 'border-rule text-ink-2 hover:bg-ground'" @click="setGroup(g.key)">{{ g.label }} <span class="tnum ml-1 text-ink-3">{{ count(g.statuses) }}</span></button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 rounded-card border border-rule bg-surface p-2">
      <label class="relative min-w-56 flex-1">
        <Search class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-3" />
        <input v-model="filters.q" type="search" placeholder="Ref, name, email, phone, room" class="input w-full pl-8" />
      </label>
      <SelectInput v-model="filters.status" class="!w-36" placeholder="Status" :options="ORDER_STATUSES" />
      <SelectInput v-model="filters.deposit_status" class="!w-36" placeholder="Deposit" :options="DEPOSIT_STATUSES" />
      <SelectInput v-model="filters.balance_status" class="!w-36" placeholder="Balance" :options="BALANCE_STATUSES" />
      <SelectInput v-model="filters.halls" class="!w-40" placeholder="Halls" :options="CAT.halls" />
      <SelectInput v-model="filters.kit" class="!w-40" placeholder="Kit" :options="Object.keys(CAT.kits).map((k) => ({ value: k, label: kitName(k) }))" />
      <input v-model="filters.arrival_from" type="date" class="input" title="Check-in from" />
      <input v-model="filters.arrival_to" type="date" class="input" title="Check-in until" />
      <label class="flex items-center gap-1.5 text-sm text-ink-2"><input v-model="filters.storage" type="checkbox" class="accent-brand" /> Storage</label>
      <Btn v-if="hasFilters" variant="ghost" size="sm" @click="clear"><X class="h-3.5 w-3.5" /> Clear</Btn>
      <span class="flex-1" />
      <Btn size="sm" @click="csv"><Download class="h-3.5 w-3.5" /> CSV</Btn>
    </div>

    <div class="overflow-x-auto rounded-card border border-rule bg-surface" :class="loading ? 'opacity-60' : ''">
      <table class="w-full text-sm">
        <thead class="bg-ground">
          <tr>
            <th class="th"><button class="inline-flex items-center gap-1" @click="sortBy('ref')">Ref <ArrowUpDown class="h-3 w-3" /></button></th>
            <th class="th"><button class="inline-flex items-center gap-1" @click="sortBy('name')">Customer <ArrowUpDown class="h-3 w-3" /></button></th>
            <th class="th">Kit</th>
            <th class="th"><button class="inline-flex items-center gap-1" @click="sortBy('halls')">Where <ArrowUpDown class="h-3 w-3" /></button></th>
            <th class="th"><button class="inline-flex items-center gap-1" @click="sortBy('arrival')">Check-in <ArrowUpDown class="h-3 w-3" /></button></th>
            <th class="th text-right"><button class="inline-flex items-center gap-1" @click="sortBy('total')">Total <ArrowUpDown class="h-3 w-3" /></button></th>
            <th class="th">Deposit</th>
            <th class="th">Balance</th>
            <th class="th">Status</th>
            <th class="th"><button class="inline-flex items-center gap-1" @click="sortBy('createdAt')">Placed <ArrowUpDown class="h-3 w-3" /></button></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-rule-soft">
          <tr v-for="o in shown" :key="o.ref" class="row-link" @click="router.push({ name: 'order', params: { ref: o.ref } })">
            <td class="td"><RouterLink :to="{ name: 'order', params: { ref: o.ref } }" class="font-mono text-xs font-semibold text-brand-ink hover:underline" @click.stop>{{ o.ref }}</RouterLink></td>
            <td class="td"><div class="font-semibold">{{ o.name }}</div><div class="truncate text-xs text-ink-3">{{ o.email }}</div></td>
            <td class="td">{{ kitName(o.kit) }}<span v-if="addonCount(o)" class="ml-1 text-xs text-ink-3">+{{ addonCount(o) }}</span><span v-if="o.storageInterest" class="ml-1 rounded bg-ground px-1 font-mono text-[10px] text-ink-2">storage</span></td>
            <td class="td">{{ o.halls }}<div class="text-xs text-ink-3">{{ o.building }}</div></td>
            <td class="td whitespace-nowrap">{{ fmtDate(o.arrival) }}</td>
            <td class="td tnum text-right font-semibold">{{ fmtMoney(o.total) }}</td>
            <td class="td"><StatusBadge :status="o.depositStatus" /></td>
            <td class="td whitespace-nowrap"><StatusBadge :status="o.balanceStatus" /> <span class="tnum text-xs text-ink-2">{{ fmtMoney(o.balance) }}</span></td>
            <td class="td"><StatusBadge :status="o.status" /></td>
            <td class="td whitespace-nowrap text-xs text-ink-2">{{ fmtDateTime(o.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="!loading && !shown.length" title="No orders match" text="Try another filter or clear them." />
    </div>
    <Pagination :page="page" :pages="pages" :total="grouped.length" :from="Math.min(grouped.length, (page - 1) * PER_PAGE + 1)" :to="Math.min(grouped.length, page * PER_PAGE)" @change="(p) => { page = p; router.replace({ query: toQuery() }) }" />
  </div>
</template>
