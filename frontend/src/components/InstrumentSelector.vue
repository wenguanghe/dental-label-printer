<template>
  <div>
    <label class="label-text required">器械名称</label>

    <!-- 搜索框 + 语音按钮 -->
    <div class="relative flex gap-2">
      <div class="relative flex-1">
        <input v-model="searchQuery" type="text" class="input-field pr-10"
          placeholder="搜索器械（支持拼音首字母）" @focus="showDropdown = true" />
        <svg v-if="searchQuery" class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 cursor-pointer"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" @click="searchQuery = ''">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </div>
      <!-- 语音输入按钮 -->
      <button
        class="flex items-center justify-center w-12 min-h-[44px] rounded-lg transition-all duration-200 shrink-0"
        :class="isRecording
          ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
          : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'"
        :disabled="isTranscribing"
        @click="toggleRecording"
        :title="isRecording ? '点击停止录音' : '点击开始语音输入'">
        <!-- 录音中的图标 -->
        <svg v-if="isRecording" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
        <!-- 转写中的 spinner -->
        <svg v-else-if="isTranscribing" class="w-6 h-6 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <!-- 麦克风图标 -->
        <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M19 10v2a7 7 0 01-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    </div>

    <!-- 语音状态提示 -->
    <div v-if="voiceStatus" class="mt-1.5 text-xs px-1"
      :class="voiceStatusType === 'error' ? 'text-red-500' : voiceStatusType === 'success' ? 'text-green-600' : 'text-blue-500'">
      {{ voiceStatus }}
    </div>

    <!-- 语音识别批量添加弹窗 -->
    <div v-if="voiceInstruments.length > 0" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="voiceInstruments = []">
      <div class="bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900">语音识别结果</h3>
          <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100" @click="voiceInstruments = []">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <p class="text-sm text-gray-500">识别到 {{ voiceInstruments.length }} 个器械：</p>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div v-for="(item, idx) in voiceInstruments" :key="idx"
            class="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
            <span class="text-base font-medium text-blue-800">{{ item.name }}</span>
            <span class="text-sm text-blue-600">×{{ item.quantity }}</span>
          </div>
        </div>
        <div class="flex gap-3">
          <button class="btn-secondary flex-1" @click="voiceInstruments = []">取消</button>
          <button class="btn-primary flex-1" @click="confirmBatchAdd">全部添加</button>
        </div>
      </div>
    </div>

    <!-- 搜索结果下拉 -->
    <div v-if="showDropdown && searchQuery.length > 0"
      class="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10 relative">
      <div v-for="item in filteredItems" :key="item.id"
        class="px-4 py-3 hover:bg-blue-50 active:bg-blue-100 cursor-pointer border-b border-gray-100 last:border-0"
        @click="selectItem(item)">
        <span class="text-base">{{ item.name }}</span>
        <span class="text-xs text-gray-400 ml-2">{{ item.pinyin }}</span>
      </div>

      <!-- 无匹配结果时显示手动输入 -->
      <div v-if="filteredItems.length === 0" class="p-3">
        <div class="text-sm text-gray-500 mb-2">未找到匹配器械</div>
        <div class="flex gap-2">
          <input v-model="manualInput" type="text" class="input-field flex-1 !py-2 !min-h-[40px]"
            placeholder="手动输入器械名称" @keyup.enter="addManual" />
          <button class="btn-secondary whitespace-nowrap !min-h-[40px]" @click="addManual">添加</button>
        </div>
      </div>
    </div>

    <!-- 空白搜索时显示全部 -->
    <div v-if="showDropdown && searchQuery.length === 0 && instruments.length > 0"
      class="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10 relative">
      <div v-for="item in instruments" :key="item.id"
        class="px-4 py-3 hover:bg-blue-50 active:bg-blue-100 cursor-pointer border-b border-gray-100 last:border-0"
        @click="selectItem(item)">
        <span class="text-base">{{ item.name }}</span>
      </div>
    </div>

    <!-- 点击外部关闭 -->
    <div v-if="showDropdown" class="fixed inset-0 z-0" @click="showDropdown = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'

const emit = defineEmits(['select', 'batch-select'])

const searchQuery = ref('')
const manualInput = ref('')
const showDropdown = ref(false)
const instruments = ref([])

// 语音输入相关
const isRecording = ref(false)
const isTranscribing = ref(false)
const voiceStatus = ref('')
const voiceStatusType = ref('info')
let mediaRecorder = null
let audioChunks = []

// 语音识别批量结果
const voiceInstruments = ref([])

const filteredItems = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return instruments.value
  return instruments.value.filter(item =>
    item.name.toLowerCase().includes(q) ||
    (item.pinyin && item.pinyin.toLowerCase().includes(q))
  )
})

function selectItem(item) {
  emit('select', item.name)
  searchQuery.value = ''
  showDropdown.value = false
}

function addManual() {
  const name = manualInput.value.trim()
  if (name) {
    emit('select', name)
    manualInput.value = ''
    searchQuery.value = ''
    showDropdown.value = false
  }
}

function setVoiceStatus(msg, type = 'info') {
  voiceStatus.value = msg
  voiceStatusType.value = type
  if (msg && type !== 'success') {
    setTimeout(() => { voiceStatus.value = '' }, 5000)
  }
}

function confirmBatchAdd() {
  if (voiceInstruments.value.length > 0) {
    emit('batch-select', voiceInstruments.value)
    setVoiceStatus(`已添加 ${voiceInstruments.value.length} 个器械`, 'success')
    voiceInstruments.value = []
  }
}

async function toggleRecording() {
  if (isRecording.value) {
    stopRecording()
  } else {
    await startRecording()
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []
    mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() })

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      // 停止所有音轨
      stream.getTracks().forEach(t => t.stop())
      if (audioChunks.length === 0) {
        setVoiceStatus('未录制到音频', 'error')
        return
      }
      await sendAudioForTranscription()
    }

    mediaRecorder.start(500) // 每500ms收集一次数据
    isRecording.value = true
    setVoiceStatus('正在录音，请说话...')
  } catch (e) {
    console.error('Microphone access error:', e)
    if (e.name === 'NotAllowedError') {
      setVoiceStatus('请允许麦克风权限后重试', 'error')
    } else {
      setVoiceStatus('无法访问麦克风: ' + e.message, 'error')
    }
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
    isRecording.value = false
    setVoiceStatus('正在识别中...')
  }
}

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

async function sendAudioForTranscription() {
  isTranscribing.value = true
  try {
    const mimeType = mediaRecorder.mimeType || 'audio/webm'
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
    const audioBlob = new Blob(audioChunks, { type: mimeType })

    const formData = new FormData()
    formData.append('audio', audioBlob, `recording.${ext}`)

    const { data } = await axios.post('/api/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    if (data.instruments && data.instruments.length > 0) {
      // LLM 智能解析返回了结构化器械列表
      voiceInstruments.value = data.instruments
      setVoiceStatus(`识别到 ${data.instruments.length} 个器械，请确认`, 'success')
    } else if (data.text) {
      // 有转写文本但没有器械
      const reason = data.filteredOut
        ? `识别到语音内容，但提取的器械未在字典中匹配（已过滤: ${data.filteredOut.join('、')}）`
        : data.cancelled
          ? `语音识别成功: "${data.text.slice(0, 50)}${data.text.length > 50 ? '...' : ''}"，用户取消了所有器械`
          : `语音转写: "${data.text.slice(0, 50)}${data.text.length > 50 ? '...' : ''}"，未提取到器械`
      setVoiceStatus(reason, 'error')
    } else {
      setVoiceStatus('未识别到语音内容，请重试', 'error')
    }
  } catch (e) {
    console.error('Transcription error:', e)
    const errData = e.response?.data
    const errMsg = errData?.error || '语音识别失败'
    const detail = errData?.detail ? `\n详情: ${errData.detail.slice(0, 200)}` : ''
    setVoiceStatus(errMsg + detail, 'error')
  } finally {
    isTranscribing.value = false
  }
}

// 组件卸载时清理
onBeforeUnmount(() => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
})

onMounted(async () => {
  try {
    const { data } = await axios.get('/api/dict/INSTRUMENT')
    instruments.value = data
  } catch (e) {
    console.error('Failed to load instruments:', e)
  }
})
</script>
