<script setup lang="ts">
import { useRoute } from 'vue-router'
import { session } from '@/stores/session'
import AppShell from '@/layouts/AppShell.vue'
import Toaster from '@/components/ui/Toaster.vue'

const route = useRoute()
</script>

<template>
  <RouterView v-if="route.name === 'login'" />
  <AppShell v-else-if="session.ready">
    <RouterView />
  </AppShell>
  <div v-else class="flex min-h-screen items-center justify-center text-ink-3">Loading…</div>
  <Toaster />
</template>
