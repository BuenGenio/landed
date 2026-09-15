<script setup lang="ts">
defineProps<{ modelValue: string | number | null | undefined; type?: string; placeholder?: string; id?: string; disabled?: boolean; mono?: boolean; list?: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <input
    :id="id"
    :type="type ?? 'text'"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :disabled="disabled"
    :list="list"
    class="input w-full"
    :class="mono ? 'font-mono' : ''"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
