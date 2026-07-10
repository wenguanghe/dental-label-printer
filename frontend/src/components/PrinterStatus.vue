<template>
  <div v-if="printStore.agentStatus.connected"
    class="bg-green-100 text-green-800 text-xs px-4 py-1.5 flex items-center gap-2">
    <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
    打印机已连接: {{ printStore.agentStatus.printerName || '就绪' }}
  </div>
  <div v-else-if="printStore.initialized"
    class="bg-red-100 text-red-800 text-xs px-4 py-1.5 flex items-center gap-2">
    <span class="w-2 h-2 bg-red-500 rounded-full" />
    打印 Agent 未连接
  </div>
</template>

<script setup>
import { usePrintStore } from '../stores/print.js'
const printStore = usePrintStore()
</script>
