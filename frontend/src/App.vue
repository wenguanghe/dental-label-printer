<template>
  <div class="app-shell">
    <!-- Agent 离线横幅 -->
    <div v-if="printStore.agentStatus.connected === false && printStore.initialized" class="offline-banner">
      <el-icon :size="16"><WarningFilled /></el-icon>
      <span>打印 Agent 未连接，打印功能不可用</span>
    </div>

    <!-- 主内容区 -->
    <main class="app-main">
      <router-view />
    </main>

    <!-- 底部 Tab 导航 -->
    <nav class="bottom-nav">
      <router-link
        v-for="tab in tabs" :key="tab.name" :to="tab.path"
        class="nav-item"
        :class="{ active: $route.name === tab.name }">
        <el-icon :size="22"><component :is="tab.icon" /></el-icon>
        <span class="nav-label">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { usePrintStore } from './stores/print.js'
import { io } from 'socket.io-client'
import { Printer, Setting, WarningFilled } from '@element-plus/icons-vue'

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

<style scoped>
.app-shell {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg-page);
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 60px;
}

.offline-banner {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  color: #991b1b;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  border-bottom: 1px solid #fecaca;
}
</style>
