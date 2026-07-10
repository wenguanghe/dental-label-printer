<template>
  <div style="min-height: 100vh; background: #f5f7fa;">
    <!-- 打印机状态警告条 -->
    <el-alert
      v-if="printStore.agentStatus.connected === false && printStore.initialized"
      type="error"
      :closable="false"
      show-icon
      center
      style="border-radius: 0;"
    >
      打印 Agent 未连接，打印功能不可用
    </el-alert>

    <!-- 主内容 -->
    <main style="overflow-y: auto; padding-bottom: 64px;">
      <router-view />
    </main>

    <!-- 底部 Tab 导航 -->
    <nav class="bottom-nav">
      <router-link
        v-for="tab in tabs" :key="tab.name" :to="tab.path"
        class="nav-item"
        :class="{ active: $route.name === tab.name }">
        <el-icon :size="24"><component :is="tab.icon" /></el-icon>
        <span class="nav-label">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { usePrintStore } from './stores/print.js'
import { io } from 'socket.io-client'
import { Printer, Setting } from '@element-plus/icons-vue'

const printStore = usePrintStore()

const tabs = [
  { name: 'print', path: '/', label: '打印', icon: Printer },
  { name: 'manage', path: '/manage', label: '管理', icon: Setting }
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
