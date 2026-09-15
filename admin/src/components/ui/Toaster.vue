<script setup lang="ts">
import { useToasts, dismiss } from './toast'
const toasts = useToasts()
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2">
    <div v-for="t in toasts.items" :key="t.id" role="status" class="pointer-events-auto cursor-pointer rounded-full border px-4 py-2 text-center text-sm font-semibold shadow-lg" :class="{ ok: 'border-ok bg-ok-wash text-ok', bad: 'border-bad bg-bad-wash text-bad', info: 'border-info bg-info-wash text-info' }[t.tone]" @click="dismiss(t.id)">
      {{ t.text }}
    </div>
  </div>
</template>
