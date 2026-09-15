<script setup lang="ts">
import EmptyState from '@/components/ui/EmptyState.vue'
</script>
<template>
  <EmptyState title="Nothing here" text="That page does not exist in the admin.">
    <RouterLink to="/" class="text-brand-ink hover:underline">Back to the dashboard</RouterLink>
  </EmptyState>
</template>
