<script setup lang="ts">
defineProps<{ title: string; text?: string }>()
</script>

<template>
  <div class="px-6 py-10 text-center">
    <p class="font-semibold">{{ title }}</p>
    <p v-if="text" class="mt-1 text-sm text-ink-2">{{ text }}</p>
    <div v-if="$slots.default" class="mt-4"><slot /></div>
  </div>
</template>
