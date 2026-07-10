<template>
  <div>
    <el-form-item label="器械名称" required>
      <div style="display: flex; gap: 8px; width: 100%;">
        <el-autocomplete
          v-model="searchQuery"
          :fetch-suggestions="querySearch"
          placeholder="搜索器械（支持拼音首字母）"
          style="flex: 1;"
          clearable
          @select="handleSelect"
          @focus="showDropdown = true"
          @clear="searchQuery = ''"
        >
          <template #default="{ item }">
            <span>{{ item.value }}</span>
            <span v-if="item.pinyin" style="color: #909399; font-size: 12px; margin-left: 8px;">{{ item.pinyin }}</span>
          </template>
          <template #suffix>
            <el-icon v-if="searchQuery" style="cursor: pointer;" @click.stop="searchQuery = ''"><Close /></el-icon>
          </template>
        </el-autocomplete>

        <!-- 语音输入按钮 -->
        <el-button
          :type="isRecording ? 'danger' : 'primary'"
          :plain="!isRecording"
          :loading="isTranscribing"
          :disabled="isTranscribing"
          style="width: 48px; min-height: 44px;"
          @click="toggleRecording"
          :title="isRecording ? '点击停止录音' : '点击开始语音输入'"
        >
          <template #icon>
            <el-icon v-if="isRecording"><VideoPause /></el-icon>
            <el-icon v-else><Microphone /></el-icon>
          </template>
        </el-button>
      </div>
    </el-form-item>

    <!-- 语音状态提示 -->
    <div v-if="voiceStatus" style="margin-top: 4px; font-size: 12px; padding: 0 4px;"
      :style="{ color: voiceStatusType === 'error' ? '#f56c6c' : voiceStatusType === 'success' ? '#67c23a' : '#409eff' }">
      {{ voiceStatus }}
    </div>

    <!-- 语音识别批量添加弹窗 -->
    <el-dialog
      v-model="showVoiceDialog"
      title="语音识别结果"
      width="90%"
      :max-width="400"
      :close-on-click-modal="true"
    >
      <p style="color: #909399; font-size: 14px;">识别到 {{ voiceInstruments.length }} 个器械：</p>
      <div style="max-height: 200px; overflow-y: auto; margin: 12px 0;">
        <div v-for="(item, idx) in voiceInstruments" :key="idx"
          style="display: flex; justify-content: space-between; align-items: center; background: #ecf5ff; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px;">
          <span style="font-weight: 500; color: #1a4b8c;">{{ item.name }}</span>
          <span style="color: #409eff;">×{{ item.quantity }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="voiceInstruments = []">取消</el-button>
        <el-button type="primary" @click="confirmBatchAdd">全部添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Close, Microphone, VideoPause } from '@element-plus/icons-vue'
import axios from 'axios'

const emit = defineEmits(['select', 'batch-select'])

const searchQuery = ref('')
const showDropdown = ref(false)
const instruments = ref([])

// 语音输入相关
const isRecording = ref(false)
const isTranscribing = ref(false)
const voiceStatus = ref('')
const voiceStatusType = ref('info')
let mediaRecorder = null
let audioChunks = []

const voiceInstruments = ref([])
const showVoiceDialog = computed({
  get: () => voiceInstruments.value.length > 0,
  set: (val) => { if (!val) voiceInstruments.value = [] }
})

function querySearch(queryString, cb) {
  const q = queryString.toLowerCase().trim()
  if (!q) {
    cb(instruments.value.map(i => ({ value: i.name, pinyin: i.pinyin, id: i.id })))
    return
  }
  const results = instruments.value.filter(item =>
    item.name.toLowerCase().includes(q) ||
    (item.pinyin && item.pinyin.toLowerCase().includes(q))
  )
  if (results.length === 0) {
    cb([{ value: `使用 "${queryString}"`, isManual: true, rawName: queryString }])
  } else {
    cb(results.map(i => ({ value: i.name, pinyin: i.pinyin, id: i.id })))
  }
}

function handleSelect(item) {
  if (item.isManual) {
    emit('select', item.rawName)
  } else {
    emit('select', item.value)
  }
  searchQuery.value = ''
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
  if (isRecording.value) { stopRecording() } else { await startRecording() }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioChunks = []
    mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() })
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      if (audioChunks.length === 0) { setVoiceStatus('未录制到音频', 'error'); return }
      await sendAudioForTranscription()
    }
    mediaRecorder.start(500)
    isRecording.value = true
    setVoiceStatus('正在录音，请说话...')
  } catch (e) {
    if (e.name === 'NotAllowedError') { setVoiceStatus('请允许麦克风权限后重试', 'error') }
    else { setVoiceStatus('无法访问麦克风: ' + e.message, 'error') }
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
  for (const type of types) { if (MediaRecorder.isTypeSupported(type)) return type }
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
    const { data } = await axios.post('/api/voice/transcribe', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    if (data.instruments && data.instruments.length > 0) {
      voiceInstruments.value = data.instruments
      setVoiceStatus(`识别到 ${data.instruments.length} 个器械，请确认`, 'success')
    } else if (data.text) {
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
    const errData = e.response?.data
    const errMsg = errData?.error || '语音识别失败'
    const detail = errData?.detail ? `\n详情: ${errData.detail.slice(0, 200)}` : ''
    setVoiceStatus(errMsg + detail, 'error')
  } finally { isTranscribing.value = false }
}

onBeforeUnmount(() => { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop() })

onMounted(async () => {
  try { const { data } = await axios.get('/api/dict/INSTRUMENT'); instruments.value = data }
  catch (e) { console.error('Failed to load instruments:', e) }
})
</script>
