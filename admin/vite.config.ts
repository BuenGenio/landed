import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * The admin app (Vue 3 + Tailwind 4, structure from duties-api resources/js/admin) builds into
 * web/admin/ so Cloudflare Pages serves it at /admin/ next to the API. `npm run admin:dev` runs
 * it with HMR against the dev server on :8788.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/admin/',
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: fileURLToPath(new URL('../web/admin', import.meta.url)), emptyOutDir: true },
  server: { port: 5174, proxy: { '/api': 'http://localhost:8788' } },
})
