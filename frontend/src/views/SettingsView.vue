<template>
  <div class="max-w-lg mx-auto px-4 py-4">
    <h1 class="text-xl font-bold text-gray-900 mb-4">系统设置</h1>

    <!-- 打印机设置 -->
    <div class="mb-6">
      <h2 class="text-base font-semibold text-gray-700 mb-2">打印机设置</h2>
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <!-- Agent 连接状态 -->
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full"
            :class="printStore.agentStatus.connected ? 'bg-green-500' : 'bg-red-500'" />
          <span class="text-sm">Agent 连接:</span>
          <span class="text-sm font-medium"
            :class="printStore.agentStatus.connected ? 'text-green-700' : 'text-red-700'">
            {{ printStore.agentStatus.connected ? '已连接' : '未连接' }}
          </span>
        </div>

        <!-- 打印机选择 -->
        <div v-if="printStore.agentStatus.connected">
          <label class="label-text">选择打印机</label>
          <div class="flex gap-2">
            <select v-model="selectedPrinter" class="input-field flex-1 !min-h-[42px]">
              <option v-if="!printers.length" value="" disabled>未检测到打印机</option>
              <option v-for="p in printers" :key="p" :value="p">{{ p }}</option>
            </select>
            <button class="btn-secondary !min-h-[42px] whitespace-nowrap" @click="refreshPrinters">
              刷新
            </button>
          </div>
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-gray-400">当前: {{ printStore.agentStatus.printerName || '未选择' }}</span>
            <button v-if="selectedPrinter && selectedPrinter !== printStore.agentStatus.printerName"
              class="btn-primary text-sm !min-h-[36px] !px-4" @click="applyPrinter">
              应用
            </button>
          </div>
        </div>
        <div v-else class="text-sm text-gray-400 py-2">
          Agent 未连接，请先启动本地 Agent 程序
        </div>
      </div>
    </div>

    <!-- 标签模板设置 -->
    <div class="mb-6">
      <h2 class="text-base font-semibold text-gray-700 mb-2">标签模板设置</h2>
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label-text">标签宽度 (mm)</label>
            <input v-model.number="labelConfig.width" type="number" min="20" max="100"
              class="input-field !py-2 !min-h-[40px]" @change="saveLabelConfig" />
          </div>
          <div>
            <label class="label-text">标签高度 (mm)</label>
            <input v-model.number="labelConfig.height" type="number" min="15" max="80"
              class="input-field !py-2 !min-h-[40px]" @change="saveLabelConfig" />
          </div>
        </div>
        <div class="text-xs text-gray-400">当前尺寸: {{ labelConfig.width }}mm × {{ labelConfig.height }}mm</div>
      </div>
    </div>

    <!-- AI 模型设置 -->
    <div class="mb-6">
      <h2 class="text-base font-semibold text-gray-700 mb-2">AI 模型设置（语音识别）</h2>
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div>
          <label class="label-text">API Key</label>
          <div class="relative">
            <input v-model="aiSettings.apiKey" :type="showApiKey ? 'text' : 'password'"
              class="input-field pr-20 !py-2 !min-h-[42px]"
              placeholder="sk-... 或您的 API Key" />
            <button class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-500 hover:underline px-2 py-1"
              @click="showApiKey = !showApiKey">
              {{ showApiKey ? '隐藏' : '显示' }}
            </button>
          </div>
          <div v-if="aiSettings.hasApiKey && !aiSettings.apiKey" class="text-xs text-green-600 mt-1">
            ✓ 已配置（留空则保持原有 Key 不变）
          </div>
        </div>

        <div>
          <label class="label-text">API 地址</label>
          <input v-model="aiSettings.apiBase" type="text"
            class="input-field !py-2 !min-h-[42px]"
            placeholder="https://api.openai.com/v1" />
          <div class="text-xs text-gray-400 mt-1">支持 OpenAI 兼容接口，如阿里云百炼、DeepSeek 等</div>
        </div>

        <div>
          <label class="label-text">语音识别模型</label>
          <select v-model="aiSettings.sttModel" class="input-field !py-2 !min-h-[42px]">
            <option value="whisper-1">whisper-1（OpenAI 标准）</option>
            <option value="paraformer-v2">paraformer-v2（阿里云）</option>
            <option value="sensevoice-v1">sensevoice-v1（阿里云）</option>
            <option value="__custom__">自定义...</option>
          </select>
          <input v-if="aiSettings.sttModel === '__custom__'" v-model="customSttModel"
            type="text" class="input-field !py-2 !min-h-[42px] mt-2"
            placeholder="输入自定义模型名称" />
        </div>

        <div class="flex items-center justify-between pt-1">
          <span v-if="aiSaveStatus" class="text-xs"
            :class="aiSaveStatusType === 'success' ? 'text-green-600' : 'text-red-500'">
            {{ aiSaveStatus }}
          </span>
          <button class="btn-primary !min-h-[38px] !px-6 text-sm ml-auto" @click="saveAiSettings">
            保存设置
          </button>
        </div>
      </div>
    </div>

    <!-- 字典管理 -->
    <div class="space-y-4 mb-6">
      <div v-for="dict in dictTypes" :key="dict.type">
        <h2 class="text-base font-semibold text-gray-700 mb-2">{{ dict.label }}</h2>
        <div class="bg-white rounded-lg border border-gray-200">
          <!-- 列表 -->
          <div class="divide-y divide-gray-100 max-h-48 overflow-y-auto">
            <div v-for="item in dictData[dict.type]" :key="item.id"
              class="flex justify-between items-center px-4 py-2.5">
              <span class="text-base">{{ item.name }}</span>
              <button class="text-red-500 text-sm hover:underline"
                @click="deleteItem(dict.type, item.id)">删除</button>
            </div>
            <div v-if="!dictData[dict.type]?.length" class="px-4 py-3 text-sm text-gray-400">暂无数据</div>
          </div>

          <!-- 新增 -->
          <div class="flex border-t border-gray-200 p-2 gap-2">
            <input v-model="newItems[dict.type]" type="text"
              class="input-field flex-1 !py-2 !min-h-[40px] text-sm"
              :placeholder="'添加' + dict.label"
              @keyup.enter="addItem(dict.type)" />
            <button class="btn-secondary !min-h-[40px] text-sm" @click="addItem(dict.type)">添加</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { usePrintStore } from '../stores/print.js'

const printStore = usePrintStore()

// 打印机选择
const printers = ref([])
const selectedPrinter = ref('')

async function loadPrinters() {
  try {
    const { data } = await axios.get('/api/print/printers')
    printers.value = data.printers || []
    if (data.currentPrinter) {
      selectedPrinter.value = data.currentPrinter
    }
  } catch (e) {
    console.error('Load printers failed:', e)
  }
}

async function refreshPrinters() {
  // 通过 socket 请求 Agent 刷新打印机列表
  if (printStore.socket) {
    printStore.socket.emit('refresh_printers')
  }
  // 等一下再加载
  setTimeout(loadPrinters, 1000)
}

function applyPrinter() {
  if (selectedPrinter.value && printStore.socket) {
    printStore.socket.emit('set_printer', { printerName: selectedPrinter.value })
    localStorage.setItem('selectedPrinter', selectedPrinter.value)
  }
}

const dictTypes = [
  { type: 'INSTRUMENT', label: '器械名称' },
  { type: 'STERILIZER', label: '消毒人员' },
  { type: 'CHECKER', label: '核对人员' },
  { type: 'FURNACE', label: '炉次/炉号' }
]

const dictData = reactive({})
const newItems = reactive({})

// 标签模板设置（localStorage 持久化）
const defaultLabelConfig = { width: 40, height: 30 }
const savedConfig = JSON.parse(localStorage.getItem('labelConfig') || 'null')
const labelConfig = reactive({ ...defaultLabelConfig, ...savedConfig })

// AI 模型设置
const aiSettings = reactive({
  apiKey: '',
  apiBase: 'https://api.openai.com/v1',
  sttModel: 'whisper-1',
  hasApiKey: false
})
const showApiKey = ref(false)
const customSttModel = ref('')
const aiSaveStatus = ref('')
const aiSaveStatusType = ref('success')

async function loadAiSettings() {
  try {
    const { data } = await axios.get('/api/ai-settings')
    aiSettings.apiBase = data.apiBase || 'https://api.openai.com/v1'
    aiSettings.hasApiKey = !!data.hasApiKey
    // 设置模型
    const model = data.sttModel || 'whisper-1'
    const knownModels = ['whisper-1', 'paraformer-v2', 'sensevoice-v1']
    if (knownModels.includes(model)) {
      aiSettings.sttModel = model
    } else {
      aiSettings.sttModel = '__custom__'
      customSttModel.value = model
    }
  } catch (e) {
    console.error('Load AI settings failed:', e)
  }
}

async function saveAiSettings() {
  aiSaveStatus.value = ''
  try {
    const model = aiSettings.sttModel === '__custom__' ? customSttModel.value : aiSettings.sttModel
    const body = {
      apiBase: aiSettings.apiBase,
      sttModel: model
    }
    // 只有填了才传 apiKey，空字符串表示清除
    if (aiSettings.apiKey !== '') {
      body.apiKey = aiSettings.apiKey
    }
    await axios.post('/api/ai-settings', body)
    aiSaveStatus.value = '✓ 保存成功'
    aiSaveStatusType.value = 'success'
    aiSettings.apiKey = '' // 清空输入框
    aiSettings.hasApiKey = true
    setTimeout(() => { aiSaveStatus.value = '' }, 3000)
  } catch (e) {
    aiSaveStatus.value = e.response?.data?.error || '保存失败'
    aiSaveStatusType.value = 'error'
  }
}

function saveLabelConfig() {
  localStorage.setItem('labelConfig', JSON.stringify({ width: labelConfig.width, height: labelConfig.height }))
}

async function loadDict(type) {
  try {
    const { data } = await axios.get(`/api/dict/${type}`)
    dictData[type] = data
  } catch (e) {
    console.error(`Load ${type} failed:`, e)
  }
}

async function addItem(type) {
  const name = newItems[type]?.trim()
  if (!name) return
  try {
    await axios.post('/api/dict', { type, name })
    newItems[type] = ''
    await loadDict(type)
  } catch (e) {
    alert(e.response?.data?.error || '添加失败')
  }
}

async function deleteItem(type, id) {
  if (!confirm('确定删除此项？')) return
  try {
    await axios.delete(`/api/dict/${id}`)
    await loadDict(type)
  } catch (e) {
    alert('删除失败')
  }
}

onMounted(() => {
  dictTypes.forEach(d => loadDict(d.type))
  loadPrinters()
  loadAiSettings()
})
</script>
