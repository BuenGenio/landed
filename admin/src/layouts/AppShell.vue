<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { LayoutDashboard, Box, Truck, Receipt, Mail, Settings, Moon, Sun, LogOut, Menu, ExternalLink } from 'lucide-vue-next'
import { session } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const open = ref(false)

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: Box },
  { to: '/shipping', label: 'Shipping', icon: Truck },
  { to: '/billing', label: 'Billing', icon: Receipt },
  { to: '/emails', label: 'Emails', icon: Mail },
  { to: '/settings', label: 'Settings', icon: Settings },
]
async function logout() { await session.logout(); router.push({ name: 'login' }) }
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`))
</script>

<template>
  <div class="min-h-screen bg-ground text-ink">
    <header class="no-print sticky top-0 z-30 border-b border-rule bg-surface/95 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
        <button class="rounded-full p-2 hover:bg-ground md:hidden" aria-label="Menu" @click="open = !open"><Menu class="h-5 w-5" /></button>
        <RouterLink to="/" class="flex items-baseline gap-1.5">
          <span class="text-xl font-extrabold tracking-tight">Landed</span>
          <span class="text-sm font-medium text-ink-2">admin</span>
        </RouterLink>
        <nav class="ml-4 hidden items-center gap-1 md:flex">
          <RouterLink v-for="item in nav" :key="item.to" :to="item.to" class="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors" :class="isActive(item.to) ? 'bg-ink text-surface dark:bg-brand dark:text-[#1B2430]' : 'text-ink-2 hover:bg-ground hover:text-ink'">
            <component :is="item.icon" class="h-4 w-4" /> {{ item.label }}
          </RouterLink>
        </nav>
        <div class="ml-auto flex items-center gap-1">
          <div v-if="session.health" class="mr-2 hidden items-center gap-3 text-xs text-ink-2 lg:flex" title="Server environment">
            <span>db <b :class="session.health.ok ? 'text-ok' : 'text-bad'">{{ session.health.ok ? 'ok' : 'down' }}</b></span>
            <span>stripe <b :class="session.health.stripe ? 'text-ok' : 'text-bad'">{{ session.health.stripe ? 'on' : 'off' }}</b></span>
            <span>email <b :class="session.health.email ? 'text-ok' : 'text-warn'">{{ session.health.email ? 'resend' : 'log only' }}</b></span>
            <span v-if="session.me?.via === 'open'" class="text-warn" title="No admin user exists yet; anyone can open this">open · <RouterLink to="/settings" class="underline">add a user</RouterLink></span>
          </div>
          <a href="/" target="_blank" rel="noopener" class="rounded-full p-2 text-ink-2 hover:bg-ground" title="Open the order page"><ExternalLink class="h-4 w-4" /></a>
          <span v-if="session.user" class="hidden text-sm text-ink-2 sm:inline">{{ session.user.name || session.user.email }}</span>
          <button v-if="session.user" class="rounded-full p-2 text-ink-2 hover:bg-ground" title="Sign out" @click="logout"><LogOut class="h-4 w-4" /></button>
          <button class="rounded-full p-2 text-ink-2 hover:bg-ground" :title="session.dark ? 'Day mode' : 'Night mode'" @click="session.toggleDark()">
            <Sun v-if="session.dark" class="h-4 w-4" /><Moon v-else class="h-4 w-4" />
          </button>
        </div>
      </div>
      <nav v-if="open" class="border-t border-rule-soft px-4 py-2 md:hidden">
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold" :class="isActive(item.to) ? 'bg-brand-wash text-brand-ink' : 'text-ink-2'" @click="open = false">
          <component :is="item.icon" class="h-4 w-4" /> {{ item.label }}
        </RouterLink>
      </nav>
    </header>
    <main class="mx-auto max-w-screen-2xl px-4 py-6">
      <slot />
    </main>
    <footer class="no-print mx-auto max-w-screen-2xl px-4 pb-6 pt-2 font-mono text-xs text-ink-3">Landed admin · {{ new Date().getFullYear() }}</footer>
  </div>
</template>
