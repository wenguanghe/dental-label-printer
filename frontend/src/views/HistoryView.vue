<template>
  <div class="max-w-lg mx-auto px-4 py-4">
    <h1 class="text-xl font-bold text-gray-900 mb-4">打印历史</h1>

    <!-- 日期选择 -->
    <div class="mb-4">
      <input v-model="selectedDate" type="date" class="input-field" @change="loadHistory" />
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="text-center py-8 text-gray-500">加载中...</div>

    <!-- 空状态 -->
    <div v-else-if="tasks.length === 0" class="text-center py-12 text-gray-400">
      <svg class="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      当日无打印记录
    </div>

    <!-- 历史列表 -->
    <div v-else class="space-y-3">
      <div v-for="task in tasks" :key="task.id"
        class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex justify-between items-start mb-2">
          <div>
            <div class="text-sm text-gray-500">{{ formatDateTime(task.createdAt) }}</div>
            <div class="text-base font-medium mt-1">
              {{ task.sterilizerName }} / {{ task.checkerName }}
            </div>
          </div>
          <button class="btn-secondary !min-h-[36px] !py-1.5 !px-3 text-sm"
            :disabled="reprinting === task.id" @click="reprint(task.id)">
            {{ reprinting === task.id ? '打印中...' : '补打' }}
          </button>
        </div>

        <div class="text-sm text-gray-600">
          消毒: {{ formatDateTime(task.sterilizeTime) }} → 失效: {{ formatDateTime(task.expireTime) }}
        </div>
        <div v-if="task.furnaceNo" class="text-xs text-gray-400 mt-1">炉号: {{ task.furnaceNo }}</div>

        <div class="flex flex-wrap gap-1.5 mt-2">
          <span v-for="item in task.items" :key="item.id"
            class="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
            {{ item.instrumentName }} ×{{ item.quantity }}
          </span>
          <span class="text-xs text-gray-400 ml-auto">共 {{ task.totalQuantity }} 张</span>
        </div>
      </div>
    </div>

    <!-- 补打结果提示 -->
    <div v-if="message"
      class="fixed top-4 left-4 right-4 z-50 rounded-lg px-4 py-3 text-center font-medium shadow-lg"
      :class="messageType === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const selectedDate = ref(new Date().toISOString().slice(0, 10))
const tasks = ref([])
const loading = ref(false)
const reprinting = ref(null)
const message = ref('')
const messageType = ref('success')

function formatDateTime(str) {
  const d = new Date(str)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function loadHistory() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/print/history', { params: { date: selectedDate.value } })
    tasks.value = data
  } catch (e) {
    console.error('Load history failed:', e)
  } finally {
    loading.value = false
  }
}

async function reprint(id) {
  reprinting.value = id
  try {
    const { data } = await axios.post(`/api/print/reprint/${id}`)
    message.value = data.message || '补打已下发'
    messageType.value = data.agentConnected ? 'success' : 'warning'
  } catch (e) {
    message.value = '补打失败: ' + (e.response?.data?.error || '未知错误')
    messageType.value = 'error'
  } finally {
    reprinting.value = null
    setTimeout(() => { message.value = '' }, 3000)
  }
}

onMounted(loadHistory)
</script>
