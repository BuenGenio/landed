<script setup lang="ts">
defineProps<{ title?: string; flush?: boolean }>()
</script>

<template>
  <section class="rounded-card border border-rule bg-surface">
    <header v-if="title || $slots.header" class="flex flex-wrap items-center justify-between gap-3 border-b border-rule-soft px-4 py-2.5">
      <h2 class="text-sm font-bold">{{ title }}</h2>
      <slot name="header" />
    </header>
    <div :class="flush ? '' : 'p-4'">
      <slot />
    </div>
  </section>
</template>
