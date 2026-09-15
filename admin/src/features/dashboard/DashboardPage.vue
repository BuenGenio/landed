<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { statsApi, billingApi } from '@/api'
import type { Stats, BillingSummary } from '@/api/types'
import { fmtDate, fmtMoney } from '@/lib/format'
import { kitName } from '@/lib/catalogue'
import { toastError } from '@/components/ui/toast'
import Card from '@/components/ui/Card.vue'
import Tile from '@/components/ui/Tile.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const stats = ref<Stats | null>(null)
const billing = ref<BillingSummary | null>(null)

onMounted(async () => {
  try { [stats.value, billing.value] = await Promise.all([statsApi.get(), billingApi.summary()]) } catch (e) { toastError(e, 'Could not load the dashboard') }
})
const max = (rows: { n: number }[]) => Math.max(1, ...rows.map((r) => Number(r.n)))
</script>

<template>
  <div v-if="stats && billing" class="space-y-5">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">Dashboard</h1>
      <p class="text-sm text-ink-2">Where the pre-orders stand against the go / no-go.</p>
    </div>

    <div class="rounded-card bg-brand-wash px-5 py-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-xs text-ink-2">Go / no-go: {{ stats.goNoGo.target }} paid deposits by {{ fmtDate(stats.goNoGo.targetDate) }} · {{ stats.goNoGo.daysLeft }} days left</p>
          <p class="tnum text-4xl font-extrabold tracking-tight">{{ stats.goNoGo.paid }} <span class="text-xl text-ink-2">/ {{ stats.goNoGo.target }}</span></p>
        </div>
        <p class="tnum text-2xl font-extrabold">{{ stats.goNoGo.pct }}%</p>
      </div>
      <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-surface/70"><div class="h-full rounded-full bg-brand" :style="{ width: stats.goNoGo.pct + '%' }" /></div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Live reservations" :value="stats.live" :note="`${stats.cancelled} cancelled · ${stats.referred} referred`" />
      <Tile label="Deposits taken" :value="fmtMoney(stats.depositsValue)" :note="`${stats.depositsPaid} paid · ${fmtMoney(billing.outstanding.deposits)} pending`" tone="ok" />
      <Tile label="Balance to collect" :value="fmtMoney(billing.outstanding.balance)" :note="`${billing.outstanding.balanceN} orders · ${fmtMoney(stats.balanceCollected)} collected`" tone="warn" />
      <Tile label="Booked value" :value="fmtMoney(stats.bookedValue)" :note="`${fmtMoney(billing.net)} net in the bank`" />
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <Card title="Upcoming drops" flush class="lg:col-span-1">
        <template #header><RouterLink to="/shipping" class="text-xs text-brand-ink hover:underline">Shipping</RouterLink></template>
        <table v-if="stats.upcoming.length" class="w-full text-sm">
          <tbody class="divide-y divide-rule-soft">
            <tr v-for="u in stats.upcoming" :key="u.date + u.kind" class="row-link" @click="$router.push({ name: 'shipping', query: { date: u.date } })">
              <td class="td">{{ fmtDate(u.date) }}</td><td class="td"><StatusBadge :status="u.kind" /></td><td class="td tnum text-right font-semibold">{{ u.n }}</td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-else title="Nothing planned" />
      </Card>

      <Card title="By halls">
        <ul class="space-y-2 text-sm">
          <li v-for="h in stats.byHalls" :key="h.halls">
            <div class="flex justify-between"><span>{{ h.halls }}</span><span class="tnum font-semibold">{{ h.n }}</span></div>
            <div class="mt-1 h-1.5 rounded-full bg-ground"><div class="h-full rounded-full bg-ink/70 dark:bg-brand" :style="{ width: (Number(h.n) / max(stats.byHalls)) * 100 + '%' }" /></div>
          </li>
          <li v-if="!stats.byHalls.length" class="text-ink-3">No orders yet</li>
        </ul>
      </Card>

      <Card title="By kit">
        <table class="w-full text-sm">
          <tbody class="divide-y divide-rule-soft">
            <tr v-for="k in stats.byKit" :key="k.kit"><td class="py-1.5">{{ kitName(k.kit) }}</td><td class="tnum py-1.5 text-right">{{ k.n }}</td><td class="tnum py-1.5 text-right text-ink-2">{{ fmtMoney(k.value) }}</td></tr>
            <tr v-if="!stats.byKit.length"><td class="py-1.5 text-ink-3">No orders yet</td></tr>
          </tbody>
        </table>
        <p class="kicker mt-4 mb-2">Status</p>
        <div class="flex flex-wrap gap-2">
          <RouterLink v-for="s in stats.byStatus" :key="s.status" :to="{ name: 'orders', query: { status: s.status } }" class="inline-flex items-center gap-1.5"><StatusBadge :status="s.status" /><span class="tnum text-xs text-ink-2">{{ s.n }}</span></RouterLink>
        </div>
      </Card>

      <Card title="Reservations by week" class="lg:col-span-2">
        <div v-if="stats.byWeek.length" class="flex h-32 items-end gap-1">
          <div v-for="w in stats.byWeek.slice(-16)" :key="w.week" class="flex h-full flex-1 flex-col justify-end" :title="`${w.week}: ${w.n} reserved, ${w.paid} paid`">
            <div class="rounded-t bg-rule" :style="{ height: (Number(w.n) / max(stats.byWeek)) * 100 + '%' }"><div class="w-full rounded-t bg-brand" :style="{ height: (Number(w.paid) / Math.max(1, Number(w.n))) * 100 + '%' }" /></div>
          </div>
        </div>
        <EmptyState v-else title="No orders yet" />
        <p class="mt-2 text-xs text-ink-3"><span class="inline-block h-2 w-2 rounded-sm bg-brand" /> deposit paid · <span class="inline-block h-2 w-2 rounded-sm bg-rule" /> reserved</p>
      </Card>

      <Card title="Emails">
        <div class="grid grid-cols-3 gap-2 text-center">
          <div><p class="tnum text-2xl font-extrabold text-ok">{{ stats.notifications.sent }}</p><p class="text-xs text-ink-2">sent</p></div>
          <div><p class="tnum text-2xl font-extrabold text-warn">{{ stats.notifications.skipped }}</p><p class="text-xs text-ink-2">skipped</p></div>
          <div><p class="tnum text-2xl font-extrabold text-bad">{{ stats.notifications.failed }}</p><p class="text-xs text-ink-2">failed</p></div>
        </div>
        <p class="mt-3 text-xs text-ink-3">Skipped means no mail transport was configured; the text is under <RouterLink to="/emails" class="text-brand-ink hover:underline">Emails</RouterLink> to send by hand.</p>
        <p class="kicker mt-4 mb-1">Storage interest</p>
        <p class="text-sm"><RouterLink :to="{ name: 'orders', query: { storage: '1' } }" class="font-semibold text-brand-ink hover:underline">{{ stats.storageInterest }} people</RouterLink> asked to hear when summer storage opens.</p>
      </Card>
    </div>
  </div>
  <p v-else class="py-24 text-center text-ink-3">Loading…</p>
</template>
