<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'
import { X } from 'lucide-vue-next'

defineProps<{ open: boolean; title: string; description?: string; wide?: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-rule bg-surface p-5 shadow-xl focus:outline-none"
        :class="wide ? 'max-w-3xl' : 'max-w-lg'"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <DialogTitle class="text-base font-bold">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-sm text-ink-2">{{ description }}</DialogDescription>
          </div>
          <DialogClose class="rounded p-1 text-ink-3 hover:bg-ground hover:text-ink" aria-label="Close"><X class="h-4 w-4" /></DialogClose>
        </div>
        <div class="mt-4"><slot /></div>
        <div v-if="$slots.footer" class="mt-5 flex flex-wrap justify-end gap-2"><slot name="footer" /></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
