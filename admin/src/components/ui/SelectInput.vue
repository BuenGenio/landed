<script setup lang="ts">
export interface Option { value: string | number; label: string }
defineProps<{ modelValue: string | number | null | undefined; options: Option[] | readonly string[]; id?: string; placeholder?: string; disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
const norm = (o: Option | string): Option => (typeof o === 'string' ? { value: o, label: o } : o)
</script>

<template>
  <select :id="id" :value="modelValue ?? ''" :disabled="disabled" class="input w-full pr-7" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
    <option v-if="placeholder" value="">{{ placeholder }}</option>
    <option v-for="o in (options as (Option | string)[]).map(norm)" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>
</template>
