<script setup lang="ts">
defineProps<{ label: string; value: string | number; note?: string; tone?: 'brand' | 'ok' | 'warn' | 'bad' }>()
</script>

<template>
  <div class="rounded-card px-4 py-3.5" :class="{ brand: 'bg-brand-wash', ok: 'bg-ok-wash', warn: 'bg-warn-wash', bad: 'bg-bad-wash' }[tone ?? 'brand'] ?? 'bg-surface border border-rule'" :style="!tone ? '' : undefined">
    <p class="text-xs text-ink-2">{{ label }}</p>
    <p class="tnum mt-0.5 text-2xl font-extrabold tracking-tight">{{ value }}</p>
    <p v-if="note || $slots.default" class="mt-0.5 text-xs text-ink-2"><slot>{{ note }}</slot></p>
  </div>
</template>
