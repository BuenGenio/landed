<script setup lang="ts">
defineProps<{ modelValue: string | null | undefined; rows?: number; id?: string; placeholder?: string; mono?: boolean }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <textarea
    :id="id"
    :rows="rows ?? 6"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    class="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
    :class="mono ? 'font-mono text-xs' : ''"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
