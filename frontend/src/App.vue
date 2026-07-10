<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <!-- 打印机状态警告条 -->
    <div v-if="printStore.agentStatus.connected === false && printStore.initialized"
      class="bg-red-500 text-white text-center text-sm py-2 px-4 flex items-center justify-center gap-2">
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      打印 Agent 未连接，打印功能不可用
    </div>

    <!-- 主内容 -->
    <main class="flex-1 overflow-y-auto pb-16">
      <router-view />
    </main>

    <!-- 底部 Tab 导航 -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
      <router-link v-for="tab in tabs" :key="tab.name" :to="tab.path"
        class="flex-1 flex flex-col items-center py-2 text-gray-500"
        active-class="!text-blue-600"
        :class="{ '!text-blue-600': $route.name === tab.name }">
        <component :is="tab.icon" class="w-6 h-6" />
        <span class="text-xs mt-0.5">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { h, onMounted } from 'vue'
import { usePrintStore } from './stores/print.js'
import { io } from 'socket.io-client'

const printStore = usePrintStore()

// Tab 图标组件
const PrintIcon = { render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [h('path', { 'fill-rule': 'evenodd', d: 'M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0v3H7V4h6zm-6 8v4h6v-4H7z', 'clip-rule': 'evenodd' })]) }
const ManageIcon = { render: () => h('svg', { fill: 'currentColor', viewBox: '0 0 20 20' }, [h('path', { 'fill-rule': 'evenodd', d: 'M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z', 'clip-rule': 'evenodd' })]) }

const tabs = [
  { name: 'print', path: '/', label: '打印', icon: PrintIcon },
  { name: 'manage', path: '/manage', label: '管理', icon: ManageIcon }
]

onMounted(() => {
  const socket = io()

  socket.on('connect', () => {
    console.log('Socket connected')
    socket.emit('get_agent_status')
  })

  socket.on('agent_status', (status) => {
    printStore.setAgentStatus(status)
  })

  socket.on('print_result', (result) => {
    printStore.handlePrintResult(result)
  })

  socket.on('disconnect', () => {
    printStore.setAgentStatus({ connected: false, printerName: null, printerOnline: false })
  })

  printStore.setSocket(socket)
  printStore.initialized = true
})
</script>
