<template>
  <div class="page-container">
    <!-- 密码门 -->
    <div v-if="!unlocked" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh;">
      <h1 class="page-title">管理入口</h1>
      <el-input v-model="password" type="password" placeholder="请输入管理密码"
        style="width: 240px; text-align: center;" @keyup.enter="checkPassword" show-password />
      <el-button type="primary" style="margin-top: 16px; width: 240px;" @click="checkPassword">进入</el-button>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-top: 12px; width: 240px;" />
    </div>

    <!-- 管理内容 -->
    <div v-else>
      <el-tabs v-model="activeTab" type="border-card" style="border-radius: 8px;">
        <!-- 历史 -->
        <el-tab-pane label="历史补打" name="history">
          <el-date-picker v-model="selectedDate" type="date" placeholder="选择日期"
            value-format="YYYY-MM-DD" style="width: 100%; margin-bottom: 16px;" @change="loadHistory" />
          <div v-if="historyLoading" style="text-align: center; padding: 32px; color: #909399;">
            <el-icon class="is-loading" :size="24"><Loading /></el-icon> 加载中...
          </div>
          <el-empty v-else-if="historyTasks.length === 0" description="当日无打印记录" />
          <div v-else style="display: flex; flex-direction: column; gap: 12px;">
            <el-card v-for="task in historyTasks" :key="task.id" shadow="hover" :body-style="{ padding: '16px' }">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div>
                  <div style="font-size: 12px; color: #909399;">{{ formatDateTime(task.createdAt) }}</div>
                  <div style="font-size: 16px; font-weight: 500; margin-top: 4px;">{{ task.sterilizerName }} / {{ task.checkerName }}</div>
                </div>
                <el-button size="small" :loading="reprinting === task.id" @click="reprint(task.id)">
                  {{ reprinting === task.id ? '打印中...' : '补打' }}
                </el-button>
              </div>
              <div style="font-size: 14px; color: #606266;">
                消毒: {{ formatDateTime(task.sterilizeTime) }} → 失效: {{ formatDateTime(task.expireTime) }}
              </div>
              <div v-if="task.furnaceNo" style="font-size: 12px; color: #909399; margin-top: 4px;">炉号: {{ task.furnaceNo }}</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                <el-tag v-for="item in task.items" :key="item.id" size="small" type="primary" effect="light">
                  {{ item.instrumentName }} ×{{ item.quantity }}
                </el-tag>
                <span style="font-size: 12px; color: #909399; margin-left: auto;">共 {{ task.totalQuantity }} 张</span>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <!-- 统计 -->
        <el-tab-pane label="数据统计" name="stats">
          <div style="display: flex; gap: 8px; margin-bottom: 16px; align-items: center;">
            <el-date-picker v-model="startDate" type="date" placeholder="开始日期" value-format="YYYY-MM-DD" style="flex: 1;" />
            <span style="color: #909399;">~</span>
            <el-date-picker v-model="endDate" type="date" placeholder="结束日期" value-format="YYYY-MM-DD" style="flex: 1;" />
            <el-button @click="loadStats">查询</el-button>
          </div>
          <div v-if="stats" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <el-statistic title="总任务数" :value="stats.summary.totalTasks">
              <template #prefix><el-icon><Document /></el-icon></template>
            </el-statistic>
            <el-statistic title="总标签数" :value="stats.summary.totalQuantity">
              <template #prefix><el-icon><Tickets /></el-icon></template>
            </el-statistic>
          </div>
          <div v-if="stats && stats.instruments.length" style="margin-bottom: 16px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #606266; margin-bottom: 8px;">器械消毒 Top 10</h3>
            <Bar :data="instrumentChartData" :options="chartOptions" />
          </div>
          <div v-if="stats && stats.sterilizers.length" style="margin-bottom: 16px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #606266; margin-bottom: 8px;">消毒人员工作量</h3>
            <div v-for="s in stats.sterilizers" :key="s.name" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
              <span>{{ s.name }}</span>
              <span style="color: #909399;">{{ s.taskCount }} 次 / {{ s.totalQuantity }} 张</span>
            </div>
          </div>
          <div v-if="stats && stats.checkers.length">
            <h3 style="font-size: 14px; font-weight: 600; color: #606266; margin-bottom: 8px;">核对人员工作量</h3>
            <div v-for="c in stats.checkers" :key="c.name" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
              <span>{{ c.name }}</span>
              <span style="color: #909399;">{{ c.taskCount }} 次 / {{ c.totalQuantity }} 张</span>
            </div>
          </div>
          <el-button type="primary" style="width: 100%; margin-top: 24px;" @click="exportExcel">导出 Excel 报表</el-button>
        </el-tab-pane>

        <!-- 设置 -->
        <el-tab-pane label="系统设置" name="settings">
          <!-- 硬件状态 -->
          <div class="setting-card">
            <div class="setting-card-title">硬件状态</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span class="status-dot" :class="printStore.agentStatus.connected ? 'online' : 'offline'" />
              <span style="font-size: 14px;">Agent 连接:</span>
              <el-tag :type="printStore.agentStatus.connected ? 'success' : 'danger'" size="small">
                {{ printStore.agentStatus.connected ? '已连接' : '未连接' }}
              </el-tag>
            </div>
            <div v-if="printStore.agentStatus.connected" style="display: flex; align-items: center; gap: 8px;">
              <span class="status-dot" :class="printStore.agentStatus.printerOnline ? 'online' : 'warning'" />
              <span style="font-size: 14px;">打印机:</span>
              <span style="font-weight: 500;">{{ printStore.agentStatus.printerName || '未知' }}</span>
            </div>
          </div>

          <!-- 语音识别模型 -->
          <div class="setting-card">
            <div class="setting-card-title">🎤 语音识别模型 <span style="color: #909399; font-weight: normal;">（多模态，语音转文字）</span></div>
            <el-form label-position="top" size="small">
              <el-form-item label="API Key">
                <el-input v-model="aiSettings.stt.apiKey" :type="showSttKey ? 'text' : 'password'" placeholder="输入 API Key" show-password />
                <div v-if="aiSettings.stt.hasApiKey && !aiSettings.stt.apiKey" style="font-size: 12px; color: #67c23a; margin-top: 4px;">✓ 已配置（留空保持不变）</div>
              </el-form-item>
              <el-form-item label="API 地址">
                <el-input v-model="aiSettings.stt.apiBase" placeholder="https://api.openai.com/v1" />
              </el-form-item>
              <el-form-item label="模型名称">
                <el-input v-model="aiSettings.stt.model" placeholder="如 qwen3-omni-flash、gpt-4o" />
              </el-form-item>
              <el-form-item label="接口格式">
                <el-select v-model="aiSettings.stt.format" style="width: 100%;">
                  <el-option value="openai" label="OpenAI 兼容格式" />
                  <el-option value="custom" label="自定义格式" />
                </el-select>
              </el-form-item>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <el-button size="small" :loading="sttTesting" @click="testModel('stt')">
                  {{ sttTesting ? '测试中...' : '🔗 测试连接' }}
                </el-button>
                <el-button type="primary" size="small" @click="saveModel('stt')">保存语音识别</el-button>
                <span v-if="sttSaveStatus" style="font-size: 12px;" :style="{ color: sttSaveStatus === '✓ 已保存' ? '#67c23a' : '#f56c6c' }">{{ sttSaveStatus }}</span>
              </div>
              <el-alert v-if="sttTestResult" :title="(sttTestResult.success ? '✓ ' : '✗ ') + (sttTestResult.message || sttTestResult.error)"
                :type="sttTestResult.success ? 'success' : 'error'" show-icon :closable="true" style="margin-top: 8px;" />
            </el-form>
          </div>

          <!-- 语义提取模型 -->
          <div class="setting-card">
            <div class="setting-card-title">🧠 语义提取模型 <span style="color: #909399; font-weight: normal;">（文本模型，理解语义提取器械）</span></div>
            <el-form label-position="top" size="small">
              <el-form-item label="API Key">
                <el-input v-model="aiSettings.ext.apiKey" :type="showExtKey ? 'text' : 'password'" placeholder="输入 API Key" show-password />
                <div v-if="aiSettings.ext.hasApiKey && !aiSettings.ext.apiKey" style="font-size: 12px; color: #67c23a; margin-top: 4px;">✓ 已配置（留空保持不变）</div>
              </el-form-item>
              <el-form-item label="API 地址">
                <el-input v-model="aiSettings.ext.apiBase" placeholder="https://api.openai.com/v1" />
              </el-form-item>
              <el-form-item label="模型名称">
                <el-input v-model="aiSettings.ext.model" placeholder="如 qwen-plus、qwen-max、gpt-4o" />
              </el-form-item>
              <el-form-item label="接口格式">
                <el-select v-model="aiSettings.ext.format" style="width: 100%;">
                  <el-option value="openai" label="OpenAI 兼容格式" />
                  <el-option value="custom" label="自定义格式" />
                </el-select>
              </el-form-item>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <el-button size="small" :loading="extTesting" @click="testModel('ext')">
                  {{ extTesting ? '测试中...' : '🔗 测试连接' }}
                </el-button>
                <el-button type="primary" size="small" @click="saveModel('ext')">保存语义提取</el-button>
                <span v-if="extSaveStatus" style="font-size: 12px;" :style="{ color: extSaveStatus === '✓ 已保存' ? '#67c23a' : '#f56c6c' }">{{ extSaveStatus }}</span>
              </div>
              <el-alert v-if="extTestResult" :title="(extTestResult.success ? '✓ ' : '✗ ') + (extTestResult.message || extTestResult.error)"
                :type="extTestResult.success ? 'success' : 'error'" show-icon :closable="true" style="margin-top: 8px;" />
            </el-form>
          </div>

          <!-- 日志设置 -->
          <div class="setting-card">
            <div class="setting-card-title">📝 日志设置</div>
            <el-form label-position="top" size="small">
              <el-form-item>
                <el-checkbox v-model="aiSettings.logging.enabled">开启模型交互日志记录</el-checkbox>
              </el-form-item>
              <el-form-item>
                <template #label>日志保存目录 <span style="color: #909399; font-weight: normal;">（留空使用默认路径）</span></template>
                <el-input v-model="aiSettings.logging.logDir" placeholder="如 /path/to/logs" />
              </el-form-item>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <el-button type="primary" size="small" @click="saveLogSettings">保存日志设置</el-button>
                <span v-if="logSaveStatus" style="font-size: 12px;" :style="{ color: logSaveStatus === '✓ 已保存' ? '#67c23a' : '#f56c6c' }">{{ logSaveStatus }}</span>
                <el-button size="small" @click="loadLogFiles">📂 查看日志</el-button>
              </div>
            </el-form>
            <div v-if="logFiles.length > 0" style="margin-top: 12px; border-top: 1px solid #f0f0f0; padding-top: 12px;">
              <div style="font-size: 12px; color: #909399; margin-bottom: 8px;">日志文件：</div>
              <div style="max-height: 128px; overflow-y: auto;">
                <div v-for="file in logFiles" :key="file.name"
                  style="display: flex; justify-content: space-between; padding: 4px 8px; cursor: pointer; border-radius: 4px;"
                  @click="viewLog(file.name)" class="log-file-item">
                  <span style="color: #409eff;">{{ file.name }}</span>
                  <span style="color: #909399;">{{ (file.size / 1024).toFixed(1) }}KB</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 日志查看弹窗 -->
          <el-dialog v-model="showLogDialog" :title="'📝 ' + logViewFilename" width="90%" top="5vh">
            <pre style="font-size: 12px; color: #303133; white-space: pre-wrap; font-family: monospace; line-height: 1.6; max-height: 60vh; overflow-y: auto;">{{ logViewContent }}</pre>
          </el-dialog>

          <!-- 字典管理 -->
          <div v-for="dict in dictTypes" :key="dict.type" class="setting-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div class="setting-card-title" style="margin-bottom: 0;">{{ dict.label }}</div>
              <div style="display: flex; gap: 6px;">
                <el-button size="small" @click="exportDict(dict.type, dict.label)">📤 导出</el-button>
                <el-button size="small" @click="triggerImport(dict.type)">📥 导入</el-button>
                <input type="file" :ref="el => { if (el) importRefs[dict.type] = el }" accept=".csv,.txt"
                  style="display: none;" @change="importDict($event, dict.type)" />
              </div>
            </div>
            <div style="border: 1px solid #e4e7ed; border-radius: 6px; overflow: hidden;">
              <div style="max-height: 192px; overflow-y: auto;">
                <div v-for="item in dictData[dict.type]" :key="item.id"
                  style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid #f5f5f5;">
                  <span>{{ item.name }}</span>
                  <el-popconfirm title="确定删除此项？" @confirm="deleteItem(dict.type, item.id)">
                    <template #reference>
                      <el-button type="danger" link size="small">删除</el-button>
                    </template>
                  </el-popconfirm>
                </div>
                <div v-if="!dictData[dict.type]?.length" style="padding: 12px 16px; font-size: 14px; color: #909399;">暂无数据</div>
              </div>
              <div style="display: flex; border-top: 1px solid #e4e7ed; padding: 8px; gap: 8px;">
                <el-input v-model="newItems[dict.type]" :placeholder="'添加' + dict.label" size="small"
                  @keyup.enter="addItem(dict.type)" />
                <el-button size="small" @click="addItem(dict.type)">添加</el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Loading, Document, Tickets } from '@element-plus/icons-vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip } from 'chart.js'
import { usePrintStore } from '../stores/print.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

const printStore = usePrintStore()
const MANAGE_PASSWORD = '123456'

const unlocked = ref(false)
const password = ref('')
const error = ref('')

function checkPassword() {
  if (password.value === MANAGE_PASSWORD) {
    unlocked.value = true; error.value = ''
    loadHistory(); loadStats()
    dictTypes.forEach(d => loadDict(d.type))
    loadAiSettings()
  } else { error.value = '密码错误' }
}

const activeTab = ref('history')

// === 历史 ===
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const historyTasks = ref([])
const historyLoading = ref(false)
const reprinting = ref(null)

function formatDateTime(str) {
  const d = new Date(str)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

async function loadHistory() {
  historyLoading.value = true
  try { const { data } = await axios.get('/api/print/history', { params: { date: selectedDate.value } }); historyTasks.value = data }
  catch (e) { console.error(e) }
  finally { historyLoading.value = false }
}

async function reprint(id) {
  reprinting.value = id
  try {
    const { data } = await axios.post(`/api/print/reprint/${id}`)
    ElMessage[data.agentConnected ? 'success' : 'warning'](data.message || '补打已下发')
  } catch (e) { ElMessage.error('补打失败') }
  finally { reprinting.value = null }
}

// === 统计 ===
const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 30)
const startDate = ref(weekAgo.toISOString().slice(0, 10))
const endDate = ref(new Date().toISOString().slice(0, 10))
const stats = ref(null)

const instrumentChartData = computed(() => {
  if (!stats.value || !stats.value.instruments.length) return null
  return {
    labels: stats.value.instruments.map(i => i.name),
    datasets: [{ label: '消毒次数', data: stats.value.instruments.map(i => i.count), backgroundColor: '#409eff', borderRadius: 4 }]
  }
})
const chartOptions = { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }

async function loadStats() {
  try { const { data } = await axios.get('/api/stats/overview', { params: { startDate: startDate.value, endDate: endDate.value } }); stats.value = data }
  catch (e) { console.error(e) }
}

async function exportExcel() {
  try {
    const response = await axios.get('/api/stats/export', { params: { startDate: startDate.value, endDate: endDate.value }, responseType: 'blob' })
    const url = URL.createObjectURL(response.data); const a = document.createElement('a')
    a.href = url; a.download = `消毒记录_${startDate.value}_${endDate.value}.xlsx`; a.click(); URL.revokeObjectURL(url)
  } catch (e) { ElMessage.error('导出失败') }
}

// === AI 设置 ===
const aiSettings = reactive({
  stt: { apiKey: '', apiBase: 'https://api.openai.com/v1', model: '', format: 'openai', hasApiKey: false },
  ext: { apiKey: '', apiBase: 'https://api.openai.com/v1', model: '', format: 'openai', hasApiKey: false },
  logging: { enabled: false, logDir: '' }
})
const showSttKey = ref(false); const showExtKey = ref(false)
const sttTesting = ref(false); const extTesting = ref(false)
const sttTestResult = ref(null); const extTestResult = ref(null)
const sttSaveStatus = ref(''); const extSaveStatus = ref('')
const logSaveStatus = ref(''); const logFiles = ref([])
const logViewContent = ref(''); const logViewFilename = ref('')
const showLogDialog = ref(false)

async function loadAiSettings() {
  try {
    const { data } = await axios.get('/api/ai-settings')
    aiSettings.stt.apiBase = data.stt?.apiBase || 'https://api.openai.com/v1'
    aiSettings.stt.model = data.stt?.model || ''; aiSettings.stt.format = data.stt?.format || 'openai'
    aiSettings.stt.hasApiKey = !!data.stt?.hasApiKey
    aiSettings.ext.apiBase = data.ext?.apiBase || 'https://api.openai.com/v1'
    aiSettings.ext.model = data.ext?.model || ''; aiSettings.ext.format = data.ext?.format || 'openai'
    aiSettings.ext.hasApiKey = !!data.ext?.hasApiKey
    aiSettings.logging.enabled = data.logging?.enabled ?? false
    aiSettings.logging.logDir = data.logging?.logDir || ''
  } catch (e) { console.error('Load AI settings failed:', e) }
}

async function saveModel(which) {
  const cfg = which === 'stt' ? aiSettings.stt : aiSettings.ext
  const saveStatus = which === 'stt' ? sttSaveStatus : extSaveStatus
  saveStatus.value = ''
  try {
    const body = { saveWhich: which, [which]: { apiBase: cfg.apiBase, model: cfg.model, format: cfg.format } }
    if (cfg.apiKey) body[which].apiKey = cfg.apiKey
    await axios.post('/api/ai-settings', body)
    saveStatus.value = '✓ 已保存'; cfg.apiKey = ''; cfg.hasApiKey = true
    setTimeout(() => { saveStatus.value = '' }, 3000)
  } catch (e) { saveStatus.value = e.response?.data?.error || '保存失败' }
}

async function testModel(which) {
  const testing = which === 'stt' ? sttTesting : extTesting
  const testResult = which === 'stt' ? sttTestResult : extTestResult
  testing.value = true; testResult.value = null
  try {
    const body = {
      stt: { apiBase: aiSettings.stt.apiBase, model: aiSettings.stt.model, format: aiSettings.stt.format },
      ext: { apiBase: aiSettings.ext.apiBase, model: aiSettings.ext.model, format: aiSettings.ext.format },
      testWhich: which
    }
    if (aiSettings.stt.apiKey) body.stt.apiKey = aiSettings.stt.apiKey
    if (aiSettings.ext.apiKey) body.ext.apiKey = aiSettings.ext.apiKey
    const { data } = await axios.post('/api/ai-settings/test', body); testResult.value = data
  } catch (e) { testResult.value = { success: false, error: e.response?.data?.error || '请求失败' } }
  finally { testing.value = false }
}

async function saveLogSettings() {
  logSaveStatus.value = ''
  try {
    await axios.post('/api/ai-settings', { logging: { enabled: aiSettings.logging.enabled, logDir: aiSettings.logging.logDir } })
    logSaveStatus.value = '✓ 已保存'; setTimeout(() => { logSaveStatus.value = '' }, 3000)
  } catch (e) { logSaveStatus.value = e.response?.data?.error || '保存失败' }
}

async function loadLogFiles() {
  try { const { data } = await axios.get('/api/ai-settings/logs'); logFiles.value = data.files || [] }
  catch (e) { ElMessage.error('加载日志文件失败') }
}

async function viewLog(filename) {
  try {
    const { data } = await axios.get(`/api/ai-settings/logs/${filename}`)
    logViewFilename.value = filename; logViewContent.value = data.content || '(空文件)'; showLogDialog.value = true
  } catch (e) { logViewContent.value = '读取失败: ' + (e.response?.data?.error || e.message); logViewFilename.value = filename; showLogDialog.value = true }
}

// === 字典 ===
const dictTypes = [
  { type: 'INSTRUMENT', label: '器械名称' }, { type: 'STERILIZER', label: '消毒人员' },
  { type: 'CHECKER', label: '核对人员' }, { type: 'FURNACE', label: '炉次/炉号' }
]
const dictData = reactive({}); const newItems = reactive({}); const importRefs = reactive({})

function exportDict(type, label) {
  const a = document.createElement('a'); a.href = `/api/dict/${type}/export`; a.download = `${label}.csv`; a.click()
}
function triggerImport(type) { importRefs[type]?.click() }

async function importDict(event, type) {
  const file = event.target.files?.[0]; if (!file) return; event.target.value = ''
  try {
    const text = await file.text()
    const names = text.split(/[\r\n,]+/).map(s => s.trim()).filter(s => s && s !== '名称' && s !== 'name')
    if (names.length === 0) { ElMessage.error('文件中无有效数据'); return }
    const { data } = await axios.post('/api/dict/batch', { type, names })
    await loadDict(type)
    ElMessage.success(`成功导入 ${data.imported} 条${names.length - data.imported > 0 ? `，跳过 ${names.length - data.imported} 条重复项` : ''}`)
  } catch (e) { ElMessage.error('导入失败: ' + (e.response?.data?.error || e.message)) }
}

async function loadDict(type) {
  try { const { data } = await axios.get(`/api/dict/${type}`); dictData[type] = data } catch (e) { console.error(e) }
}

async function addItem(type) {
  const name = newItems[type]?.trim(); if (!name) return
  try { await axios.post('/api/dict', { type, name }); newItems[type] = ''; await loadDict(type) }
  catch (e) { ElMessage.error(e.response?.data?.error || '添加失败') }
}

async function deleteItem(type, id) {
  try { await axios.delete(`/api/dict/${id}`); await loadDict(type) } catch (e) { ElMessage.error('删除失败') }
}
</script>

<style scoped>
.log-file-item:hover { background: #f5f7fa; }
</style>
