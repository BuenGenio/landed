<script setup lang="ts">
/** Sandboxed preview of server-rendered HTML (emails, invoices) with a print button. */
import { ref } from 'vue'
import { Printer, Download } from 'lucide-vue-next'
import Btn from './Btn.vue'

const props = defineProps<{ html: string; height?: string; filename?: string }>()
const frame = ref<HTMLIFrameElement | null>(null)

function print() {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) return
  w.document.open(); w.document.write(props.html); w.document.close()
  w.focus(); setTimeout(() => w.print(), 300)
}
function save() {
  const blob = new Blob([props.html], { type: 'text/html' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = props.filename ?? 'document.html'; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
</script>

<template>
  <div>
    <iframe ref="frame" :srcdoc="html" title="Preview" class="w-full rounded-lg border border-rule bg-white" :style="{ height: height ?? '32rem' }" sandbox=""></iframe>
    <div class="mt-2 flex justify-end gap-2">
      <Btn size="sm" @click="save"><Download class="h-3.5 w-3.5" /> Save HTML</Btn>
      <Btn size="sm" variant="primary" @click="print"><Printer class="h-3.5 w-3.5" /> Print / PDF</Btn>
    </div>
  </div>
</template>
