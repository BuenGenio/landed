import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { session } from '@/stores/session'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: () => import('@/features/dashboard/DashboardPage.vue'), meta: { title: 'Dashboard' } },
  { path: '/orders', name: 'orders', component: () => import('@/features/orders/OrdersPage.vue'), meta: { title: 'Orders' } },
  { path: '/orders/:ref', name: 'order', component: () => import('@/features/orders/OrderPage.vue'), meta: { title: 'Order' } },
  { path: '/shipping', name: 'shipping', component: () => import('@/features/shipping/ShippingPage.vue'), meta: { title: 'Shipping' } },
  { path: '/billing', name: 'billing', component: () => import('@/features/billing/BillingPage.vue'), meta: { title: 'Billing' } },
  { path: '/emails', name: 'emails', component: () => import('@/features/emails/EmailsPage.vue'), meta: { title: 'Emails' } },
  { path: '/settings', name: 'settings', component: () => import('@/features/settings/SettingsPage.vue'), meta: { title: 'Settings' } },
  { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { title: 'Sign in' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue'), meta: { title: 'Not found' } },
]

export const router = createRouter({
  history: createWebHistory('/admin/'),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.beforeEach(async (to) => {
  if (!session.ready) await session.load()
  if (session.needsLogin && to.name !== 'login') return { name: 'login', query: { next: to.fullPath } }
  if (!session.needsLogin && to.name === 'login') return { name: 'dashboard' }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Landed admin` : 'Landed admin'
})
