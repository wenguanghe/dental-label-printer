<template>
  <div v-if="printStore.agentStatus.connected" class="status-badge status-online">
    <span class="status-dot online"></span>
    <span class="status-text">{{ printStore.agentStatus.printerName || '就绪' }}</span>
  </div>
  <div v-else-if="printStore.initialized" class="status-badge status-offline">
    <span class="status-dot offline"></span>
    <span class="status-text">Agent 未连接</span>
  </div>
</template>

<script setup>
import { usePrintStore } from '../stores/print.js'
const printStore = usePrintStore()
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 4px 8px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 12px;
}
.status-online {
  background: rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.95);
}
.status-offline {
  background: rgba(239,68,68,0.15);
  color: #fca5a5;
}
.status-text {
  line-height: 1;
}
</style>
<template>
  <el-tag
    v-if="printStore.agentStatus.connected"
    type="success"
    effect="light"
    style="margin-bottom: 8px;"
  >
    <el-icon style="margin-right: 4px;"><CircleCheck /></el-icon>
    打印机已连接: {{ printStore.agentStatus.printerName || '就绪' }}
  </el-tag>
  <el-tag
    v-else-if="printStore.initialized"
    type="danger"
    effect="light"
    style="margin-bottom: 8px;"
  >
    <el-icon style="margin-right: 4px;"><WarningFilled /></el-icon>
    打印 Agent 未连接
  </el-tag>
</template>

<script setup>
import { CircleCheck, WarningFilled } from '@element-plus/icons-vue'
import { usePrintStore } from '../stores/print.js'
const printStore = usePrintStore()
</script>
