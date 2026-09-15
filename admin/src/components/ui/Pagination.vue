<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
defineProps<{ page: number; pages: number; total: number; from: number; to: number }>()
defineEmits<{ change: [page: number] }>()
</script>

<template>
  <div v-if="total" class="flex items-center justify-between gap-3 text-sm text-ink-2">
    <span class="tnum">{{ from }}–{{ to }} of {{ total.toLocaleString() }}</span>
    <div v-if="pages > 1" class="flex items-center gap-1">
      <button class="rounded-full border border-rule p-1.5 hover:bg-ground disabled:opacity-40" :disabled="page <= 1" aria-label="Previous page" @click="$emit('change', page - 1)"><ChevronLeft class="h-4 w-4" /></button>
      <span class="tnum px-2">{{ page }} / {{ pages }}</span>
      <button class="rounded-full border border-rule p-1.5 hover:bg-ground disabled:opacity-40" :disabled="page >= pages" aria-label="Next page" @click="$emit('change', page + 1)"><ChevronRight class="h-4 w-4" /></button>
    </div>
  </div>
</template>
