<script setup lang="ts">
defineProps<{ items: Array<{ label: string; value?: string | number | null; mono?: boolean; href?: string }> }>()
</script>

<template>
  <dl class="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
    <template v-for="item in items" :key="item.label">
      <dt class="text-ink-3">{{ item.label }}</dt>
      <dd class="min-w-0 break-words" :class="item.mono ? 'font-mono text-xs' : ''">
        <a v-if="item.href && item.value" :href="item.href" target="_blank" rel="noopener" class="text-brand-ink hover:underline">{{ item.value }}</a>
        <template v-else>{{ item.value ?? '—' }}</template>
      </dd>
    </template>
  </dl>
</template>
