<script setup lang="ts">
defineProps<{ label: string; for?: string; hint?: string; error?: string }>()
</script>

<template>
  <label class="block text-sm" :for="$props.for">
    <span class="mb-1 block text-xs font-medium text-ink-2">{{ label }}</span>
    <slot />
    <span v-if="error" class="mt-1 block text-xs text-bad">{{ error }}</span>
    <span v-else-if="hint" class="mt-1 block text-xs text-ink-3">{{ hint }}</span>
  </label>
</template>
