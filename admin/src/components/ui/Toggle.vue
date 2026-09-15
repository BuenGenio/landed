<script setup lang="ts">
defineProps<{ modelValue: boolean; label?: string; id?: string }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="inline-flex cursor-pointer items-center gap-2 text-sm">
    <input :id="id" type="checkbox" class="peer sr-only" :checked="modelValue" @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)" />
    <span class="relative h-5 w-9 rounded-full bg-rule transition-colors peer-checked:bg-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
    <span v-if="label" class="text-ink-2">{{ label }}</span>
  </label>
</template>
