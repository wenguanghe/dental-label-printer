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
