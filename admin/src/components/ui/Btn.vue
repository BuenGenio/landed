<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit'
  loading?: boolean
  disabled?: boolean
}>(), { variant: 'secondary', size: 'md', type: 'button' })

const classes = computed(() => [
  'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
  props.size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
  {
    primary: 'bg-ink text-surface hover:opacity-90 dark:bg-ink dark:text-ground',
    brand: 'bg-brand text-[#1B2430] hover:bg-brand-deep',
    secondary: 'border border-rule bg-surface text-ink hover:bg-ground',
    ghost: 'text-ink-2 hover:bg-ground hover:text-ink',
    danger: 'bg-bad text-white hover:opacity-90 dark:text-ink',
  }[props.variant],
])
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading">
    <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
    <slot />
  </button>
</template>
