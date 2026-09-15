<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string; label?: string }>()

/** One tone map for order, deposit, balance, delivery, payment and email statuses. */
const tone = computed(() => ({
  // order
  reserved: 'bg-warn-wash text-warn', confirmed: 'bg-info-wash text-info', delivered: 'bg-ok-wash text-ok', closed: 'bg-ground text-ink-2 border-rule', cancelled: 'bg-bad-wash text-bad',
  // deposit / balance
  pending: 'bg-warn-wash text-warn', due: 'bg-warn-wash text-warn', paid: 'bg-ok-wash text-ok', refunded: 'bg-ground text-ink-2 border-rule', kept: 'bg-bad-wash text-bad', void: 'bg-ground text-ink-3 border-rule', waived: 'bg-ground text-ink-2 border-rule',
  // delivery
  planned: 'bg-warn-wash text-warn', packed: 'bg-info-wash text-info', reception: 'bg-ok-wash text-ok', failed: 'bg-bad-wash text-bad',
  // ledger / documents / emails
  deposit: 'bg-info-wash text-info', balance: 'bg-ok-wash text-ok', refund: 'bg-bad-wash text-bad', invoice: 'bg-info-wash text-info', credit_note: 'bg-bad-wash text-bad',
  sent: 'bg-ok-wash text-ok', skipped: 'bg-warn-wash text-warn', error: 'bg-bad-wash text-bad',
  stripe: 'bg-brand-wash text-brand-ink', manual: 'bg-ground text-ink-2 border-rule',
}[props.status] ?? 'bg-ground text-ink-2 border-rule'))
</script>

<template>
  <span class="inline-flex items-center whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold" :class="tone">{{ label ?? status.replace(/_/g, ' ') }}</span>
</template>
