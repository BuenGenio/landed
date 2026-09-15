<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { settingsApi, usersApi } from '@/api'
import type { LogRow } from '@/api/types'
import type { AdminUser } from '@/stores/session'
import { fmtDateTime } from '@/lib/format'
import { CAT } from '@/lib/catalogue'
import { session } from '@/stores/session'
import { toast, toastError } from '@/components/ui/toast'
import Btn from '@/components/ui/Btn.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Card from '@/components/ui/Card.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TextInput from '@/components/ui/TextInput.vue'

type Dict = Record<string, string>
const general = ref<Dict & { _env?: Record<string, string | boolean> }>({})
const mail = ref<Dict>({})
const app = ref<Record<string, unknown>>({})
const logs = ref<LogRow[]>([])
const logSev = ref('')
const saving = ref('')

async function load() {
  try { [general.value, mail.value, app.value] = await Promise.all([settingsApi.get<typeof general.value>('general'), settingsApi.get<Dict>('mail'), settingsApi.get('app.settings')]); await loadLogs() } catch (e) { toastError(e) }
}
async function loadLogs() { try { logs.value = await settingsApi.logs({ severity: logSev.value || undefined, limit: 100 }) } catch (e) { toastError(e) } }
async function save(key: string, body: Record<string, unknown>) {
  saving.value = key
  try { await settingsApi.put(key, body); toast('Saved'); if (key === 'general') await session.load() } catch (e) { toastError(e) } finally { saving.value = '' }
}
const env = () => general.value._env ?? {}

// --- admin users
const users = ref<AdminUser[]>([])
const userForm = ref({ email: '', name: '', password: '' })
const resetFor = ref<AdminUser | null>(null)
const newPassword = ref('')
const removeFor = ref<AdminUser | null>(null)
async function loadUsers() { try { users.value = await usersApi.list() } catch (e) { toastError(e) } }
async function addUser() {
  saving.value = 'user'
  try { await usersApi.create(userForm.value); userForm.value = { email: '', name: '', password: '' }; toast('User added'); await loadUsers(); await session.load() } catch (e) { toastError(e) } finally { saving.value = '' }
}
async function resetPassword() {
  saving.value = 'reset'
  try { await usersApi.setPassword(resetFor.value!.id, newPassword.value); toast('Password changed; their other sessions are signed out'); resetFor.value = null; newPassword.value = '' } catch (e) { toastError(e) } finally { saving.value = '' }
}
async function removeUser() {
  saving.value = 'remove'
  try { await usersApi.remove(removeFor.value!.id); toast('User removed'); removeFor.value = null; await loadUsers() } catch (e) { toastError(e) } finally { saving.value = '' }
}
const origin = location.origin
onMounted(() => { load(); loadUsers() })
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-extrabold tracking-tight">Settings</h1>
      <p class="text-sm text-ink-2">Secrets live in Cloudflare Pages (or .dev.vars); everything here is stored in the database.</p>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <Card title="General">
        <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="save('general', general)">
          <FormField label="Admin email (new-order alerts, test sends)"><TextInput v-model="general.admin_email" type="email" :placeholder="String(env().order_email || '')" /></FormField>
          <FormField label="Public contact email (shown on the site)"><TextInput v-model="general.contact_email" type="email" placeholder="hello@landed.school" /></FormField>
          <FormField label="WhatsApp number (digits with country code)"><TextInput v-model="general.whatsapp_number" mono :placeholder="String(env().whatsapp_number || '447700900000')" /></FormField>
          <FormField label="Winter-kit delivery day"><TextInput v-model="general.winter_delivery_date" type="date" :placeholder="CAT.winterDelivery" /></FormField>
          <FormField label="Site URL in emails"><TextInput v-model="general.site_url" :placeholder="String(env().site_url || origin)" /></FormField>
          <FormField label="Go / no-go target (paid deposits)"><TextInput v-model="general.go_target" type="number" placeholder="50" /></FormField>
          <FormField label="Go / no-go date"><TextInput v-model="general.go_date" type="date" placeholder="2027-07-31" /></FormField>
          <div class="sm:col-span-2 flex items-center gap-3"><Btn type="submit" variant="primary" :loading="saving === 'general'">Save</Btn><span class="text-xs text-ink-3">Server env: Stripe {{ env().stripe ? 'configured' : 'not set' }} · Resend {{ env().resend ? 'configured' : 'not set' }}</span></div>
        </form>
      </Card>

      <Card title="Mail transport">
        <p class="mb-3 text-xs text-ink-2">A Resend key in the environment wins. Otherwise pick one here. With neither, emails are logged under Emails for you to send by hand.</p>
        <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="save('mail', mail)">
          <FormField label="Transport"><SelectInput v-model="mail.transport" :options="[{ value: '', label: 'none (log only)' }, { value: 'resend', label: 'Resend API' }, { value: 'smtp', label: 'SMTP' }]" /></FormField>
          <FormField label="From"><TextInput v-model="mail.from" placeholder="Landed <hello@landed.scot>" /></FormField>
          <FormField v-if="mail.transport === 'resend'" label="Resend API key" class="sm:col-span-2"><TextInput v-model="mail.resend_api_key" type="password" mono /></FormField>
          <template v-if="mail.transport === 'smtp'">
            <FormField label="SMTP host"><TextInput v-model="mail.smtp_host" mono /></FormField>
            <FormField label="Port"><TextInput v-model="mail.smtp_port" type="number" placeholder="587" /></FormField>
            <FormField label="Encryption"><SelectInput v-model="mail.smtp_encryption" :options="['tls', 'ssl', 'none']" /></FormField>
            <FormField label="User"><TextInput v-model="mail.smtp_user" /></FormField>
            <FormField label="Password"><TextInput v-model="mail.smtp_pass" type="password" /></FormField>
          </template>
          <div class="sm:col-span-2"><Btn type="submit" variant="primary" :loading="saving === 'mail'">Save</Btn></div>
        </form>
      </Card>

      <Card title="Admin users" class="lg:col-span-2">
        <p class="mb-3 text-xs text-ink-2">Everyone who can open this admin. Each signs in with their own email and password; sessions last 30 days.<span v-if="session.me?.via === 'open'" class="text-warn"> There are no users yet, so the admin is open to anyone who finds it: add one now.</span></p>
        <div class="grid gap-4 lg:grid-cols-2">
          <table class="w-full text-sm">
            <thead class="bg-ground"><tr><th class="th">User</th><th class="th">Last sign-in</th><th class="th"></th></tr></thead>
            <tbody class="divide-y divide-rule-soft">
              <tr v-for="u in users" :key="u.id">
                <td class="td"><b>{{ u.name || '—' }}</b><span v-if="u.id === session.user?.id" class="ml-1 rounded bg-brand-wash px-1 font-mono text-[10px] text-brand-ink">you</span><div class="font-mono text-xs text-ink-2">{{ u.email }}</div></td>
                <td class="td text-xs text-ink-2">{{ fmtDateTime(u.lastLoginAt) }}</td>
                <td class="td whitespace-nowrap text-right"><Btn size="sm" variant="ghost" @click="resetFor = u; newPassword = ''">Password</Btn><Btn v-if="u.id !== session.user?.id" size="sm" variant="ghost" @click="removeFor = u">Remove</Btn></td>
              </tr>
              <tr v-if="!users.length"><td class="td text-ink-3" colspan="3">No users yet</td></tr>
            </tbody>
          </table>
          <form class="grid gap-3 sm:grid-cols-3" @submit.prevent="addUser">
            <FormField label="Email"><TextInput v-model="userForm.email" type="email" placeholder="driver@example.com" /></FormField>
            <FormField label="Name"><TextInput v-model="userForm.name" /></FormField>
            <FormField label="Password" hint="At least 8 characters"><TextInput v-model="userForm.password" type="password" /></FormField>
            <div class="sm:col-span-3"><Btn type="submit" variant="primary" :loading="saving === 'user'" :disabled="!userForm.email || userForm.password.length < 8">Add user</Btn></div>
          </form>
        </div>
      </Card>

      <Card title="Catalogue" class="lg:col-span-2">
        <p class="mb-2 text-xs text-ink-2">Prices come from <code class="font-mono">web/catalogue.js</code>, which the order page and the server both read. Change them there and redeploy.</p>
        <div class="grid gap-4 sm:grid-cols-3 text-sm">
          <div><p class="kicker mb-1">Kits</p><ul><li v-for="(k, id) in CAT.kits" :key="id" class="flex justify-between"><span>{{ CAT.names.kit[id] }}</span><span class="tnum">£{{ k.price }}<span class="text-ink-3"> (DIY £{{ k.diy }})</span></span></li></ul></div>
          <div><p class="kicker mb-1">Add-ons</p><ul><li v-for="a in CAT.addons" :key="a.id" class="flex justify-between"><span>{{ CAT.names.addon[a.id] }}</span><span class="tnum">£{{ a.price }}</span></li></ul></div>
          <div><p class="kicker mb-1">Rules</p><ul><li class="flex justify-between"><span>Deposit</span><span class="tnum">£{{ CAT.deposit }}</span></li><li class="flex justify-between"><span>Referral discount / credit</span><span class="tnum">£{{ CAT.referralDiscount }} / £{{ CAT.referralCredit }}</span></li><li class="flex justify-between"><span>Mix minimum</span><span class="tnum">£{{ CAT.mixMinimum }}</span></li><li class="flex justify-between"><span>Free cancellation</span><span class="tnum">{{ CAT.freeCancelDays }} days before</span></li></ul></div>
        </div>
      </Card>

      <Card title="Application log" flush class="lg:col-span-2">
        <template #header>
          <div class="flex items-center gap-2">
            <SelectInput v-model="logSev" class="!h-7 !w-28 text-xs" placeholder="All levels" :options="['debug', 'info', 'warn', 'error']" @update:model-value="loadLogs" />
            <SelectInput :model-value="String(app['log-level'] || 'info')" class="!h-7 !w-28 text-xs" :options="['debug', 'info', 'warn', 'error']" title="Log level" @update:model-value="(v) => save('app.settings', { 'log-level': v, 'log-drivers': ['console', 'db'] })" />
            <Btn size="sm" variant="ghost" @click="settingsApi.clearLogs(30).then((r) => { toast(`Deleted ${r.deleted} rows older than 30 days`); loadLogs() }).catch(toastError)">Clear old</Btn>
          </div>
        </template>
        <table v-if="logs.length" class="w-full text-sm">
          <tbody class="divide-y divide-rule-soft">
            <tr v-for="l in logs" :key="l.id"><td class="td whitespace-nowrap text-xs text-ink-2">{{ fmtDateTime(l.created_at) }}</td><td class="td"><StatusBadge :status="l.severity === 'error' ? 'failed' : l.severity === 'warn' ? 'pending' : 'sent'" :label="l.severity" /></td><td class="td font-mono text-xs text-ink-2">{{ l.type }}</td><td class="td">{{ l.message }}<details v-if="Object.keys(l.metadata).length" class="text-xs text-ink-3"><summary>meta</summary><pre class="whitespace-pre-wrap font-mono">{{ JSON.stringify(l.metadata, null, 1) }}</pre></details></td></tr>
          </tbody>
        </table>
        <EmptyState v-else title="Log is empty" />
      </Card>
    </div>
    <Dialog :open="!!resetFor" :title="`New password for ${resetFor?.email ?? ''}`" description="Their other browsers are signed out." @update:open="resetFor = null">
      <FormField label="Password" hint="At least 8 characters"><TextInput v-model="newPassword" type="password" /></FormField>
      <template #footer><Btn @click="resetFor = null">Cancel</Btn><Btn variant="primary" :loading="saving === 'reset'" :disabled="newPassword.length < 8" @click="resetPassword">Change password</Btn></template>
    </Dialog>
    <Dialog :open="!!removeFor" :title="`Remove ${removeFor?.email ?? ''}?`" description="They can no longer sign in. Orders and history are untouched." @update:open="removeFor = null">
      <template #footer><Btn @click="removeFor = null">Keep</Btn><Btn variant="danger" :loading="saving === 'remove'" @click="removeUser">Remove</Btn></template>
    </Dialog>
  </div>
</template>
