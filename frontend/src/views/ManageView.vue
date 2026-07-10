<template>
  <div class="max-w-lg mx-auto px-4 py-4">
    <!-- 密码门 -->
    <div v-if="!unlocked" class="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 class="text-xl font-bold text-gray-900 mb-6">管理入口</h1>
      <input v-model="password" type="password" class="input-field text-center max-w-xs"
        placeholder="请输入管理密码" @keyup.enter="checkPassword" />
      <button class="btn-primary mt-4 w-full max-w-xs" @click="checkPassword">进入</button>
      <div v-if="error" class="text-red-500 text-sm mt-2">{{ error }}</div>
    </div>

    <!-- 管理内容 -->
    <div v-else>
      <!-- 顶部 Tab -->
      <div class="flex border-b border-gray-200 mb-4 sticky top-0 bg-gray-50 z-10">
        <button v-for="tab in tabs" :key="tab.key"
          class="flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors"
          :class="activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'"
          @click="activeTab = tab.key">
          {{ tab.label }}
        </button>
      </div>

      <!-- 历史 -->
      <div v-if="activeTab === 'history'">
        <div class="mb-4">
          <input v-model="selectedDate" type="date" class="input-field" @change="loadHistory" />
        </div>
        <div v-if="historyLoading" class="text-center py-8 text-gray-500">加载中...</div>
        <div v-else-if="historyTasks.length === 0" class="text-center py-12 text-gray-400">当日无打印记录</div>
        <div v-else class="space-y-3">
          <div v-for="task in historyTasks" :key="task.id" class="bg-white rounded-lg border border-gray-200 p-4">
            <div class="flex justify-between items-start mb-2">
              <div>
                <div class="text-sm text-gray-500">{{ formatDateTime(task.createdAt) }}</div>
                <div class="text-base font-medium mt-1">{{ task.sterilizerName }} / {{ task.checkerName }}</div>
              </div>
              <button class="btn-secondary !min-h-[36px] !py-1.5 !px-3 text-sm"
                :disabled="reprinting === task.id" @click="reprint(task.id)">
                {{ reprinting === task.id ? '打印中...' : '补打' }}
              </button>
            </div>
            <div class="text-sm text-gray-600">消毒: {{ formatDateTime(task.sterilizeTime) }} → 失效: {{ formatDateTime(task.expireTime) }}</div>
            <div v-if="task.furnaceNo" class="text-xs text-gray-400 mt-1">炉号: {{ task.furnaceNo }}</div>
            <div class="flex flex-wrap gap-1.5 mt-2">
              <span v-for="item in task.items" :key="item.id" class="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">{{ item.instrumentName }} ×{{ item.quantity }}</span>
              <span class="text-xs text-gray-400 ml-auto">共 {{ task.totalQuantity }} 张</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 统计 -->
      <div v-if="activeTab === 'stats'">
        <div class="flex gap-2 mb-4">
          <input v-model="startDate" type="date" class="input-field !py-2 !min-h-[40px] text-sm" />
          <span class="self-center text-gray-400">~</span>
          <input v-model="endDate" type="date" class="input-field !py-2 !min-h-[40px] text-sm" />
          <button class="btn-secondary !min-h-[40px] whitespace-nowrap text-sm" @click="loadStats">查询</button>
        </div>
        <div v-if="stats" class="grid grid-cols-2 gap-3 mb-4">
          <div class="bg-blue-50 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-blue-700">{{ stats.summary.totalTasks }}</div>
            <div class="text-xs text-blue-500">总任务数</div>
          </div>
          <div class="bg-green-50 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-green-700">{{ stats.summary.totalQuantity }}</div>
            <div class="text-xs text-green-500">总标签数</div>
          </div>
        </div>
        <div v-if="stats && stats.instruments.length" class="mb-4">
          <h3 class="text-sm font-semibold text-gray-600 mb-2">器械消毒 Top 10</h3>
          <Bar :data="instrumentChartData" :options="chartOptions" />
        </div>
        <div v-if="stats" class="space-y-3">
          <div v-if="stats.sterilizers.length">
            <h3 class="text-sm font-semibold text-gray-600 mb-2">消毒人员工作量</h3>
            <div v-for="s in stats.sterilizers" :key="s.name" class="flex justify-between items-center py-2 border-b border-gray-100">
              <span class="text-base">{{ s.name }}</span>
              <span class="text-sm text-gray-500">{{ s.taskCount }} 次 / {{ s.totalQuantity }} 张</span>
            </div>
          </div>
          <div v-if="stats.checkers.length">
            <h3 class="text-sm font-semibold text-gray-600 mb-2 mt-4">核对人员工作量</h3>
            <div v-for="c in stats.checkers" :key="c.name" class="flex justify-between items-center py-2 border-b border-gray-100">
              <span class="text-base">{{ c.name }}</span>
              <span class="text-sm text-gray-500">{{ c.taskCount }} 次 / {{ c.totalQuantity }} 张</span>
            </div>
          </div>
        </div>
        <button class="btn-primary w-full mt-6" @click="exportExcel">导出 Excel 报表</button>
      </div>

      <!-- 设置 -->
      <div v-if="activeTab === 'settings'">
        <div class="mb-6">
          <h2 class="text-base font-semibold text-gray-700 mb-2">硬件状态</h2>
          <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full" :class="printStore.agentStatus.connected ? 'bg-green-500' : 'bg-red-500'" />
              <span class="text-sm">Agent 连接:</span>
              <span class="text-sm font-medium" :class="printStore.agentStatus.connected ? 'text-green-700' : 'text-red-700'">
                {{ printStore.agentStatus.connected ? '已连接' : '未连接' }}
              </span>
            </div>
            <div v-if="printStore.agentStatus.connected" class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full" :class="printStore.agentStatus.printerOnline ? 'bg-green-500' : 'bg-yellow-500'" />
              <span class="text-sm">打印机:</span>
              <span class="text-sm font-medium">{{ printStore.agentStatus.printerName || '未知' }}</span>
            </div>
          </div>
        </div>
        <!-- AI 模型设置 -->
        <div class="mb-6">
          <h2 class="text-base font-semibold text-gray-700 mb-2">AI 模型设置</h2>

          <!-- 语音识别模型 -->
          <div class="bg-white rounded-lg border border-gray-200 p-4 mb-3">
            <h3 class="text-sm font-semibold text-blue-600 mb-3">🎤 语音识别模型 <span class="text-gray-400 font-normal">（多模态，语音转文字）</span></h3>
            <div class="space-y-2.5">
              <div>
                <label class="label-text">API Key</label>
                <div class="relative">
                  <input v-model="aiSettings.stt.apiKey" :type="showSttKey ? 'text' : 'password'"
                    class="input-field pr-20 !py-2 !min-h-[42px]" placeholder="输入 API Key" />
                  <button class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-500 hover:underline px-2 py-1"
                    @click="showSttKey = !showSttKey">{{ showSttKey ? '隐藏' : '显示' }}</button>
                </div>
                <div v-if="aiSettings.stt.hasApiKey && !aiSettings.stt.apiKey" class="text-xs text-green-600 mt-1">✓ 已配置（留空保持不变）</div>
              </div>
              <div>
                <label class="label-text">API 地址</label>
                <input v-model="aiSettings.stt.apiBase" type="text"
                  class="input-field !py-2 !min-h-[42px]" placeholder="https://api.openai.com/v1" />
              </div>
              <div>
                <label class="label-text">模型名称</label>
                <input v-model="aiSettings.stt.model" type="text"
                  class="input-field !py-2 !min-h-[42px]" placeholder="如 qwen3-omni-flash、gpt-4o" />
              </div>
              <div>
                <label class="label-text">接口格式</label>
                <select v-model="aiSettings.stt.format" class="input-field !py-2 !min-h-[42px]">
                  <option value="openai">OpenAI 兼容格式</option>
                  <option value="custom">自定义格式</option>
                </select>
              </div>
              <div class="pt-1 flex items-center gap-2 flex-wrap">
                <button class="btn-secondary !min-h-[34px] !px-4 text-xs flex items-center gap-1.5"
                  :disabled="sttTesting" @click="testModel('stt')">
                  <svg v-if="sttTesting" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <span v-else>🔗</span>
                  {{ sttTesting ? '测试中...' : '测试连接' }}
                </button>
                <button class="btn-primary !min-h-[34px] !px-4 text-xs" @click="saveModel('stt')">保存语音识别</button>
                <span v-if="sttSaveStatus" class="text-xs" :class="sttSaveStatus === '✓ 已保存' ? 'text-green-600' : 'text-red-500'">{{ sttSaveStatus }}</span>
              </div>
              <div v-if="sttTestResult" class="text-xs px-2 py-1.5 rounded"
                :class="sttTestResult.success ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'">
                {{ sttTestResult.success ? '✓ ' : '✗ ' }}{{ sttTestResult.message || sttTestResult.error }}
              </div>
            </div>
          </div>

          <!-- 语义提取模型 -->
          <div class="bg-white rounded-lg border border-gray-200 p-4 mb-3">
            <h3 class="text-sm font-semibold text-purple-600 mb-3">🧠 语义提取模型 <span class="text-gray-400 font-normal">（文本模型，理解语义提取器械）</span></h3>
            <div class="space-y-2.5">
              <div>
                <label class="label-text">API Key</label>
                <div class="relative">
                  <input v-model="aiSettings.ext.apiKey" :type="showExtKey ? 'text' : 'password'"
                    class="input-field pr-20 !py-2 !min-h-[42px]" placeholder="输入 API Key" />
                  <button class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-500 hover:underline px-2 py-1"
                    @click="showExtKey = !showExtKey">{{ showExtKey ? '隐藏' : '显示' }}</button>
                </div>
                <div v-if="aiSettings.ext.hasApiKey && !aiSettings.ext.apiKey" class="text-xs text-green-600 mt-1">✓ 已配置（留空保持不变）</div>
              </div>
              <div>
                <label class="label-text">API 地址</label>
                <input v-model="aiSettings.ext.apiBase" type="text"
                  class="input-field !py-2 !min-h-[42px]" placeholder="https://api.openai.com/v1" />
              </div>
              <div>
                <label class="label-text">模型名称</label>
                <input v-model="aiSettings.ext.model" type="text"
                  class="input-field !py-2 !min-h-[42px]" placeholder="如 qwen-plus、qwen-max、gpt-4o" />
              </div>
              <div>
                <label class="label-text">接口格式</label>
                <select v-model="aiSettings.ext.format" class="input-field !py-2 !min-h-[42px]">
                  <option value="openai">OpenAI 兼容格式</option>
                  <option value="custom">自定义格式</option>
                </select>
              </div>
              <div class="pt-1 flex items-center gap-2 flex-wrap">
                <button class="btn-secondary !min-h-[34px] !px-4 text-xs flex items-center gap-1.5"
                  :disabled="extTesting" @click="testModel('ext')">
                  <svg v-if="extTesting" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <span v-else>🔗</span>
                  {{ extTesting ? '测试中...' : '测试连接' }}
                </button>
                <button class="btn-primary !min-h-[34px] !px-4 text-xs" @click="saveModel('ext')">保存语义提取</button>
                <span v-if="extSaveStatus" class="text-xs" :class="extSaveStatus === '✓ 已保存' ? 'text-green-600' : 'text-red-500'">{{ extSaveStatus }}</span>
              </div>
              <div v-if="extTestResult" class="text-xs px-2 py-1.5 rounded"
                :class="extTestResult.success ? 'bg-purple-50 text-purple-700' : 'bg-red-50 text-red-600'">
                {{ extTestResult.success ? '✓ ' : '✗ ' }}{{ extTestResult.message || extTestResult.error }}
              </div>
            </div>
          </div>

          <!-- 日志设置 -->
          <div class="bg-white rounded-lg border border-gray-200 p-4 mb-3">
            <h3 class="text-sm font-semibold text-gray-600 mb-3">📝 日志设置</h3>
            <div class="space-y-2.5">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="aiSettings.logging.enabled" class="w-4 h-4 accent-blue-600" />
                <span class="text-sm text-gray-700">开启模型交互日志记录</span>
              </label>
              <div>
                <label class="label-text">日志保存目录 <span class="text-gray-400 font-normal">（留空使用默认路径）</span></label>
                <input v-model="aiSettings.logging.logDir" type="text"
                  class="input-field !py-2 !min-h-[42px]" placeholder="如 /path/to/logs" />
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <button class="btn-primary !min-h-[34px] !px-4 text-xs" @click="saveLogSettings">保存日志设置</button>
                <span v-if="logSaveStatus" class="text-xs" :class="logSaveStatus === '✓ 已保存' ? 'text-green-600' : 'text-red-500'">{{ logSaveStatus }}</span>
                <button class="btn-secondary !min-h-[34px] !px-4 text-xs" @click="loadLogFiles">📂 查看日志</button>
              </div>
            </div>
            <!-- 日志文件列表 -->
            <div v-if="logFiles.length > 0" class="mt-3 border-t border-gray-100 pt-3">
              <div class="text-xs text-gray-500 mb-1.5">日志文件：</div>
              <div class="space-y-1 max-h-32 overflow-y-auto">
                <div v-for="file in logFiles" :key="file.name"
                  class="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                  @click="viewLog(file.name)">
                  <span class="text-blue-600 hover:underline">{{ file.name }}</span>
                  <span class="text-gray-400">{{ (file.size / 1024).toFixed(1) }}KB</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 日志查看弹窗 -->
          <div v-if="logViewContent" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="logViewContent = ''">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
              <div class="flex items-center justify-between px-4 py-3 border-b">
                <h3 class="text-sm font-semibold text-gray-700">📝 {{ logViewFilename }}</h3>
                <button class="text-gray-400 hover:text-gray-600 text-lg" @click="logViewContent = ''">✗</button>
              </div>
              <div class="flex-1 overflow-y-auto p-4">
                <pre class="text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{{ logViewContent }}</pre>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div v-for="dict in dictTypes" :key="dict.type">
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-base font-semibold text-gray-700">{{ dict.label }}</h2>
              <div class="flex gap-1.5">
                <button class="btn-secondary !min-h-[30px] !px-3 text-xs" @click="exportDict(dict.type, dict.label)">📤 导出</button>
                <button class="btn-secondary !min-h-[30px] !px-3 text-xs" @click="triggerImport(dict.type)">📥 导入</button>
                <input type="file" :ref="el => { if (el) importRefs[dict.type] = el }" accept=".csv,.txt"
                  class="hidden" @change="importDict($event, dict.type)" />
              </div>
            </div>
            <div class="bg-white rounded-lg border border-gray-200">
              <div class="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                <div v-for="item in dictData[dict.type]" :key="item.id" class="flex justify-between items-center px-4 py-2.5">
                  <span class="text-base">{{ item.name }}</span>
                  <button class="text-red-500 text-sm hover:underline" @click="deleteItem(dict.type, item.id)">删除</button>
                </div>
                <div v-if="!dictData[dict.type]?.length" class="px-4 py-3 text-sm text-gray-400">暂无数据</div>
              </div>
              <div class="flex border-t border-gray-200 p-2 gap-2">
                <input v-model="newItems[dict.type]" type="text" class="input-field flex-1 !py-2 !min-h-[40px] text-sm"
                  :placeholder="'添加' + dict.label" @keyup.enter="addItem(dict.type)" />
                <button class="btn-secondary !min-h-[40px] text-sm" @click="addItem(dict.type)">添加</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 提示消息 -->
    <div v-if="message" class="fixed top-4 left-4 right-4 z-50 rounded-lg px-4 py-3 text-center font-medium shadow-lg"
      :class="messageType === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip } from 'chart.js'
import { usePrintStore } from '../stores/print.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

const printStore = usePrintStore()
const MANAGE_PASSWORD = '123456'

// 密码门
const unlocked = ref(false)
const password = ref('')
const error = ref('')

function checkPassword() {
  if (password.value === MANAGE_PASSWORD) {
    unlocked.value = true
    error.value = ''
    loadHistory()
    loadStats()
    dictTypes.forEach(d => loadDict(d.type))
    loadAiSettings()
  } else {
    error.value = '密码错误'
  }
}

// Tab
const tabs = [
  { key: 'history', label: '历史补打' },
  { key: 'stats', label: '数据统计' },
  { key: 'settings', label: '系统设置' }
]
const activeTab = ref('history')

// === 历史 ===
const today = new Date()
const selectedDate = ref(today.toISOString().slice(0, 10))
const historyTasks = ref([])
const historyLoading = ref(false)
const reprinting = ref(null)
const message = ref('')
const messageType = ref('success')

function formatDateTime(str) {
  const d = new Date(str)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const { data } = await axios.get('/api/print/history', { params: { date: selectedDate.value } })
    historyTasks.value = data
  } catch (e) { console.error(e) }
  finally { historyLoading.value = false }
}

async function reprint(id) {
  reprinting.value = id
  try {
    const { data } = await axios.post(`/api/print/reprint/${id}`)
    message.value = data.message || '补打已下发'
    messageType.value = data.agentConnected ? 'success' : 'warning'
  } catch (e) {
    message.value = '补打失败'
    messageType.value = 'error'
  } finally {
    reprinting.value = null
    setTimeout(() => { message.value = '' }, 3000)
  }
}

// === 统计 ===
const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 30)
const startDate = ref(weekAgo.toISOString().slice(0, 10))
const endDate = ref(today.toISOString().slice(0, 10))
const stats = ref(null)

const instrumentChartData = computed(() => {
  if (!stats.value || !stats.value.instruments.length) return null
  return {
    labels: stats.value.instruments.map(i => i.name),
    datasets: [{ label: '消毒次数', data: stats.value.instruments.map(i => i.count), backgroundColor: '#3b82f6', borderRadius: 4 }]
  }
})
const chartOptions = { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }

async function loadStats() {
  try {
    const { data } = await axios.get('/api/stats/overview', { params: { startDate: startDate.value, endDate: endDate.value } })
    stats.value = data
  } catch (e) { console.error(e) }
}

async function exportExcel() {
  try {
    const response = await axios.get('/api/stats/export', {
      params: { startDate: startDate.value, endDate: endDate.value }, responseType: 'blob'
    })
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `消毒记录_${startDate.value}_${endDate.value}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) { console.error(e) }
}

// === AI 模型设置 ===
const aiSettings = reactive({
  stt: { apiKey: '', apiBase: 'https://api.openai.com/v1', model: '', format: 'openai', hasApiKey: false },
  ext: { apiKey: '', apiBase: 'https://api.openai.com/v1', model: '', format: 'openai', hasApiKey: false },
  logging: { enabled: false, logDir: '' }
})
const showSttKey = ref(false)
const showExtKey = ref(false)
const sttTesting = ref(false)
const extTesting = ref(false)
const sttTestResult = ref(null)
const extTestResult = ref(null)
const sttSaveStatus = ref('')
const extSaveStatus = ref('')
const logSaveStatus = ref('')
const logFiles = ref([])
const logViewContent = ref('')
const logViewFilename = ref('')

async function loadAiSettings() {
  try {
    const { data } = await axios.get('/api/ai-settings')
    aiSettings.stt.apiBase = data.stt?.apiBase || 'https://api.openai.com/v1'
    aiSettings.stt.model = data.stt?.model || ''
    aiSettings.stt.format = data.stt?.format || 'openai'
    aiSettings.stt.hasApiKey = !!data.stt?.hasApiKey
    aiSettings.ext.apiBase = data.ext?.apiBase || 'https://api.openai.com/v1'
    aiSettings.ext.model = data.ext?.model || ''
    aiSettings.ext.format = data.ext?.format || 'openai'
    aiSettings.ext.hasApiKey = !!data.ext?.hasApiKey
    aiSettings.logging.enabled = data.logging?.enabled ?? false
    aiSettings.logging.logDir = data.logging?.logDir || ''
  } catch (e) { console.error('Load AI settings failed:', e) }
}

async function saveModel(which) {
  const isStt = which === 'stt'
  const cfg = isStt ? aiSettings.stt : aiSettings.ext
  const saveStatus = isStt ? sttSaveStatus : extSaveStatus

  saveStatus.value = ''
  try {
    const body = {
      saveWhich: which,
      [which]: {
        apiBase: cfg.apiBase,
        model: cfg.model,
        format: cfg.format
      }
    }
    if (cfg.apiKey) body[which].apiKey = cfg.apiKey
    await axios.post('/api/ai-settings', body)
    saveStatus.value = '✓ 已保存'
    cfg.apiKey = ''
    cfg.hasApiKey = true
    setTimeout(() => { saveStatus.value = '' }, 3000)
  } catch (e) {
    saveStatus.value = e.response?.data?.error || '保存失败'
  }
}

async function testModel(which) {
  const isStt = which === 'stt'
  const testing = isStt ? sttTesting : extTesting
  const testResult = isStt ? sttTestResult : extTestResult
  const cfg = isStt ? aiSettings.stt : aiSettings.ext

  testing.value = true
  testResult.value = null
  try {
    const body = {
      stt: { apiBase: aiSettings.stt.apiBase, model: aiSettings.stt.model, format: aiSettings.stt.format },
      ext: { apiBase: aiSettings.ext.apiBase, model: aiSettings.ext.model, format: aiSettings.ext.format },
      testWhich: which
    }
    if (aiSettings.stt.apiKey) body.stt.apiKey = aiSettings.stt.apiKey
    if (aiSettings.ext.apiKey) body.ext.apiKey = aiSettings.ext.apiKey
    const { data } = await axios.post('/api/ai-settings/test', body)
    testResult.value = data
  } catch (e) {
    testResult.value = { success: false, error: e.response?.data?.error || '请求失败' }
  } finally {
    testing.value = false
  }
}

// === 设置 ===
const dictTypes = [
  { type: 'INSTRUMENT', label: '器械名称' },
  { type: 'STERILIZER', label: '消毒人员' },
  { type: 'CHECKER', label: '核对人员' },
  { type: 'FURNACE', label: '炉次/炉号' }
]
const dictData = reactive({})
const newItems = reactive({})
const importRefs = reactive({})

function exportDict(type, label) {
  const a = document.createElement('a')
  a.href = `/api/dict/${type}/export`
  a.download = `${label}.csv`
  a.click()
}

function triggerImport(type) {
  importRefs[type]?.click()
}

async function importDict(event, type) {
  const file = event.target.files?.[0]
  if (!file) return
  event.target.value = '' // reset
  try {
    const text = await file.text()
    // 支持 CSV 和纯文本，每行一个名称，跳过表头“名称”
    const names = text.split(/[\r\n,]+/)
      .map(s => s.trim())
      .filter(s => s && s !== '名称' && s !== 'name')
    if (names.length === 0) {
      message.value = '文件中无有效数据'
      messageType.value = 'error'
      setTimeout(() => { message.value = '' }, 3000)
      return
    }
    const { data } = await axios.post('/api/dict/batch', { type, names })
    await loadDict(type)
    message.value = `成功导入 ${data.imported} 条${names.length - data.imported > 0 ? `，跳过 ${names.length - data.imported} 条重复项` : ''}`
    messageType.value = 'success'
    setTimeout(() => { message.value = '' }, 3000)
  } catch (e) {
    message.value = '导入失败: ' + (e.response?.data?.error || e.message)
    messageType.value = 'error'
    setTimeout(() => { message.value = '' }, 3000)
  }
}

async function loadDict(type) {
  try { const { data } = await axios.get(`/api/dict/${type}`); dictData[type] = data } catch (e) { console.error(e) }
}

async function addItem(type) {
  const name = newItems[type]?.trim()
  if (!name) return
  try { await axios.post('/api/dict', { type, name }); newItems[type] = ''; await loadDict(type) }
  catch (e) { alert(e.response?.data?.error || '添加失败') }
}

async function saveLogSettings() {
  logSaveStatus.value = ''
  try {
    await axios.post('/api/ai-settings', {
      logging: { enabled: aiSettings.logging.enabled, logDir: aiSettings.logging.logDir }
    })
    logSaveStatus.value = '✓ 已保存'
    setTimeout(() => { logSaveStatus.value = '' }, 3000)
  } catch (e) {
    logSaveStatus.value = e.response?.data?.error || '保存失败'
  }
}

async function loadLogFiles() {
  try {
    const { data } = await axios.get('/api/ai-settings/logs')
    logFiles.value = data.files || []
  } catch (e) {
    console.error('Load log files failed:', e)
  }
}

async function viewLog(filename) {
  try {
    const { data } = await axios.get(`/api/ai-settings/logs/${filename}`)
    logViewFilename.value = filename
    logViewContent.value = data.content || '(空文件)'
  } catch (e) {
    logViewContent.value = '读取失败: ' + (e.response?.data?.error || e.message)
    logViewFilename.value = filename
  }
}

async function deleteItem(type, id) {
  if (!confirm('确定删除此项？')) return
  try { await axios.delete(`/api/dict/${id}`); await loadDict(type) } catch (e) { alert('删除失败') }
}
</script>
