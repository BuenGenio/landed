<script setup lang="ts">
/** TextInput that reads and writes numbers (empty => null). From duties-api gateways/NumberInput.vue. */
defineProps<{ modelValue: number | null | undefined; id?: string; min?: number; max?: number; step?: number | string; disabled?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()
function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  const value = raw === '' ? null : Number(raw)
  emit('update:modelValue', value === null || Number.isNaN(value) ? null : value)
}
</script>

<template>
  <input :id="id" type="number" :value="modelValue ?? ''" :min="min" :max="max" :step="step ?? 'any'" :disabled="disabled" :placeholder="placeholder" class="input tnum w-full" @input="onInput" />
</template>
