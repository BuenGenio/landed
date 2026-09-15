<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { session } from '@/stores/session'
import { ApiError } from '@/api/client'
import Btn from '@/components/ui/Btn.vue'
import FormField from '@/components/ui/FormField.vue'
import TextInput from '@/components/ui/TextInput.vue'

const route = useRoute()
const router = useRouter()
const email = ref('')
const name = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const setup = computed(() => !!session.me?.setup)
const origin = location.origin

onMounted(async () => { if (!session.ready) await session.load(); if (!session.needsLogin) router.replace(String(route.query.next || '/')) })

async function submit() {
  busy.value = true; error.value = ''
  try {
    if (setup.value) await session.setup(email.value, name.value, password.value)
    else await session.login(email.value, password.value)
    if (session.needsLogin) throw new Error('Signed in, but the session cookie did not come back. Are cookies blocked?')
    router.replace(String(route.query.next || '/'))
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : (e as Error).message || 'Could not sign in'
  } finally { busy.value = false }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-ground px-4">
    <form class="w-full max-w-sm rounded-card border border-rule bg-surface p-6 shadow-sm" @submit.prevent="submit">
      <p class="text-2xl font-extrabold tracking-tight">Landed <span class="text-base font-medium text-ink-2">admin</span></p>
      <p class="mt-1 text-sm text-ink-2">{{ setup ? 'No admin user exists yet. Create the first one; more can be added under Settings.' : 'Orders, shipping and billing for the Aberdeen kits.' }}</p>
      <div v-if="setup && session.me?.keyConfigured" class="mt-3 rounded-lg bg-warn-wash px-3 py-2 text-xs text-warn">This server has an ADMIN_API_KEY, so the first user must be created with it: run <code class="font-mono">npm run seed -- --url {{ origin }} --key … --admin you@example.com:password</code>, or send the key as an X-Admin-Key header.</div>
      <FormField class="mt-5" label="Email" for="email"><TextInput id="email" v-model="email" type="email" placeholder="you@example.com" /></FormField>
      <FormField v-if="setup" class="mt-3" label="Name" for="name"><TextInput id="name" v-model="name" placeholder="Eugene" /></FormField>
      <FormField class="mt-3" label="Password" for="password" :error="error" :hint="setup ? 'At least 8 characters.' : undefined"><TextInput id="password" v-model="password" type="password" /></FormField>
      <Btn type="submit" variant="primary" class="mt-4 w-full" :loading="busy" :disabled="!email || !password">{{ setup ? 'Create admin and sign in' : 'Sign in' }}</Btn>
      <p class="mt-3 text-xs text-ink-3">Sessions last 30 days in this browser. Forgot the password? Another admin can reset it under Settings, or recreate the user with the seed script.</p>
    </form>
  </div>
</template>
