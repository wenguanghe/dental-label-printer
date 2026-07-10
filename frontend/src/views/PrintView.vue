<template>
  <div class="page-container">
    <PrinterStatus />
    <h1 class="page-title">消毒标签打印</h1>

    <el-form label-position="top" :model="store.form">
      <!-- 消毒人员 -->
      <el-form-item label="消毒人员" required>
        <el-select v-model="store.form.sterilizerName" filterable allow-create
          placeholder="搜索或输入消毒人员姓名" style="width: 100%;"
          @update:model-value="onSterilizerChange">
          <el-option v-for="s in sterilizers" :key="s.id" :label="s.name" :value="s.name" />
        </el-select>
      </el-form-item>

      <!-- 核对人员 -->
      <el-form-item label="核对人员" required>
        <el-select v-model="store.form.checkerName" filterable allow-create
          placeholder="搜索或输入核对人员姓名" style="width: 100%;"
          @update:model-value="onCheckerChange">
          <el-option v-for="c in checkers" :key="c.id" :label="c.name" :value="c.name" />
        </el-select>
      </el-form-item>

      <!-- 炉号 / 炉次 -->
      <el-form-item>
        <template #label>
          <span>炉号 / 炉次</span>
          <el-button link type="primary" size="small" @click="showFurnaceEditPopup = true" style="margin-left: 8px;">手动编辑</el-button>
        </template>
        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
          <el-select v-model="store.form.furnaceNo" placeholder="选择炉号" style="flex: 1;"
            @change="onFurnaceChange">
            <el-option v-for="f in furnaces" :key="f.id" :label="f.name" :value="f.name" />
          </el-select>
          <el-tag type="warning" effect="dark" size="large" style="white-space: nowrap; min-width: 80px; text-align: center;">
            炉次: {{ batchToLetter(furnaceBatchNo) }}
          </el-tag>
        </div>
      </el-form-item>

      <!-- 消毒时间 -->
      <el-form-item label="消毒时间" required>
        <el-date-picker v-model="store.form.sterilizeTime" type="datetime"
          placeholder="选择消毒时间" format="YYYY-MM-DD HH:mm" value-format="YYYY-MM-DDTHH:mm"
          style="width: 100%;" />
        <div style="display: flex; justify-content: space-between; margin-top: 4px; padding: 0 4px;">
          <span style="font-size: 12px; color: #909399;">失效时间：</span>
          <el-button link type="primary" size="small" @click="showExpirePopup = true">
            {{ store.form.expireTime ? formatExpireTime(store.form.expireTime) : '点击设置' }}
          </el-button>
        </div>
      </el-form-item>

      <!-- 器械选择 -->
      <InstrumentSelector @select="store.addInstrument" @batch-select="store.batchAddInstruments" />
    </el-form>

    <!-- 待打印列表 -->
    <div v-if="store.form.instruments.length > 0" style="margin-bottom: 16px;">
      <div style="font-size: 14px; font-weight: 500; color: #606266; margin-bottom: 8px;">
        待打印列表 ({{ totalQuantity }} 张)
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div v-for="(item, idx) in store.form.instruments" :key="idx"
          style="display: flex; align-items: center; justify-content: space-between; background: #fff; border-radius: 8px; padding: 12px 16px; border: 1px solid #e4e7ed;">
          <span style="font-size: 16px; font-weight: 500;">{{ item.name }}</span>
          <div style="display: flex; align-items: center; gap: 12px;">
            <QuantityControl :quantity="item.quantity" @change="(d) => store.updateQuantity(idx, d)" />
            <el-button type="danger" :icon="Delete" circle size="small" @click="store.removeInstrument(idx)" />
          </div>
        </div>
      </div>
    </div>

    <!-- 打印按钮 -->
    <el-button v-if="store.form.instruments.length > 0"
      type="primary" size="large" style="width: 100%; font-size: 16px; margin-bottom: 12px;"
      :disabled="!canSubmit || store.printing"
      :loading="store.printing"
      @click="submitPrint">
      {{ store.printing ? '打印中...' : `开始打印 (${totalQuantity} 张)` }}
    </el-button>

    <!-- 继续添加器械 -->
    <el-button style="width: 100%; border-style: dashed;" size="large" @click="showAddInstrumentPopup = true">
      + 继续添加器械
    </el-button>

    <!-- 炉号/炉次编辑弹窗 -->
    <el-dialog v-model="showFurnaceEditPopup" title="编辑炉号 / 炉次" width="90%" :max-width="400">
      <el-form label-position="top">
        <el-form-item label="炉号">
          <el-input v-model="furnaceEditNo" placeholder="如: 1号炉" />
        </el-form-item>
        <el-form-item label="炉次（英文字母，如 A）">
          <el-input v-model="furnaceEditBatchLetter" maxlength="3" placeholder="A" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFurnaceEditPopup = false">取消</el-button>
        <el-button type="primary" @click="confirmFurnaceEdit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 失效时间弹窗 -->
    <el-dialog v-model="showExpirePopup" title="设置失效时间" width="90%" :max-width="400">
      <el-date-picker v-model="expireTimeTemp" type="datetime"
        placeholder="选择失效时间" format="YYYY-MM-DD HH:mm" value-format="YYYY-MM-DDTHH:mm"
        style="width: 100%; margin-bottom: 12px;" />
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
        <el-button size="small" @click="setExpireDays(7)">+7天</el-button>
        <el-button size="small" @click="setExpireDays(14)">+14天</el-button>
        <el-button size="small" @click="setExpireDays(180)">+180天</el-button>
        <el-button size="small" @click="setExpireMonths(3)">+3个月</el-button>
      </div>
      <template #footer>
        <el-button @click="showExpirePopup = false">取消</el-button>
        <el-button type="primary" @click="confirmExpireTime">确定</el-button>
      </template>
    </el-dialog>

    <!-- 添加器械弹窗 -->
    <el-dialog v-model="showAddInstrumentPopup" title="添加器械" width="90%" :max-width="500">
      <InstrumentSelector
        @select="(name) => { store.addInstrument(name); showAddInstrumentPopup = false }"
        @batch-select="(items) => { store.batchAddInstruments(items); showAddInstrumentPopup = false }" />
      <div v-if="store.form.instruments.length > 0" style="border-top: 1px solid #f0f0f0; padding-top: 12px; margin-top: 12px;">
        <div style="font-size: 12px; color: #909399; margin-bottom: 8px;">已添加 ({{ totalQuantity }} 张)</div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          <el-tag v-for="(item, idx) in store.form.instruments" :key="idx" type="primary" size="small" effect="light">
            {{ item.name }} ×{{ item.quantity }}
          </el-tag>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { usePrintStore } from '../stores/print.js'
import InstrumentSelector from '../components/InstrumentSelector.vue'
import QuantityControl from '../components/QuantityControl.vue'
import PrinterStatus from '../components/PrinterStatus.vue'

const store = usePrintStore()
const sterilizers = ref([])
const checkers = ref([])
const furnaces = ref([])

const furnaceBatchNo = ref(1)
const showFurnaceEditPopup = ref(false)
const furnaceEditNo = ref('')
const furnaceEditBatchLetter = ref('A')
const furnaceBatchManual = ref(false)
const showAddInstrumentPopup = ref(false)
const showExpirePopup = ref(false)
const expireTimeTemp = ref(store.form.expireTime || '')

function batchToLetter(n) {
  let result = ''
  while (n > 0) { n--; result = String.fromCharCode(65 + (n % 26)) + result; n = Math.floor(n / 26) }
  return result
}
function letterToNumber(s) {
  let result = 0
  for (let i = 0; i < s.length; i++) { result = result * 26 + (s.charCodeAt(i) - 64) }
  return result || 1
}

function formatExpireTime(val) {
  if (!val) return '未设置'
  const d = new Date(val)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function setExpireDays(days) {
  const base = store.form.sterilizeTime ? new Date(store.form.sterilizeTime) : new Date()
  const expire = new Date(base); expire.setDate(expire.getDate() + days)
  expireTimeTemp.value = toLocalISOString(expire)
}
function setExpireMonths(months) {
  const base = store.form.sterilizeTime ? new Date(store.form.sterilizeTime) : new Date()
  const expire = new Date(base); expire.setMonth(expire.getMonth() + months)
  expireTimeTemp.value = toLocalISOString(expire)
}
function toLocalISOString(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}
function confirmExpireTime() {
  if (expireTimeTemp.value) store.form.expireTime = expireTimeTemp.value
  showExpirePopup.value = false
}

function onSterilizerChange() {}
function onCheckerChange() {}
async function onFurnaceChange(name) {
  furnaceBatchManual.value = false
  await fetchFurnaceBatchNo(name)
}

const totalQuantity = computed(() => store.form.instruments.reduce((sum, i) => sum + i.quantity, 0))
const canSubmit = computed(() =>
  store.form.sterilizerName && store.form.checkerName &&
  store.form.sterilizeTime && store.form.expireTime && store.form.instruments.length > 0
)

async function fetchFurnaceBatchNo(furnaceName) {
  try {
    const { data } = await axios.get('/api/print/furnace-today-count', { params: { furnaceNo: furnaceName } })
    furnaceBatchNo.value = data.count + 1
  } catch (e) { furnaceBatchNo.value = 1 }
}

function openFurnaceEditPopup() {
  furnaceEditNo.value = store.form.furnaceNo || ''
  furnaceEditBatchLetter.value = batchToLetter(furnaceBatchNo.value)
  showFurnaceEditPopup.value = true
}
function confirmFurnaceEdit() {
  store.form.furnaceNo = furnaceEditNo.value
  furnaceBatchNo.value = letterToNumber(furnaceEditBatchLetter.value || 'A')
  furnaceBatchManual.value = true
  showFurnaceEditPopup.value = false
}

async function submitPrint() {
  if (!store.form.sterilizerName) { ElMessage.warning('请选择或输入消毒人员'); return }
  if (!store.form.checkerName) { ElMessage.warning('请选择或输入核对人员'); return }
  if (!store.form.sterilizeTime) { ElMessage.warning('请选择消毒时间'); return }
  if (!store.form.expireTime) { ElMessage.warning('请设置失效时间'); return }
  if (new Date(store.form.expireTime) <= new Date(store.form.sterilizeTime)) {
    ElMessage.warning('失效时间不能早于消毒时间'); return
  }
  if (store.form.instruments.length === 0) { ElMessage.warning('请至少添加一个器械'); return }

  store.rememberFurnace()
  store.printing = true
  try {
    const { data } = await axios.post('/api/print/submit', {
      sterilizerName: store.form.sterilizerName, checkerName: store.form.checkerName,
      furnaceNo: store.form.furnaceNo ? `${store.form.furnaceNo}|${batchToLetter(furnaceBatchNo.value)}` : '',
      sterilizeTime: store.form.sterilizeTime, expireTime: store.form.expireTime,
      instruments: store.form.instruments,
      printerName: localStorage.getItem('selectedPrinter') || undefined
    })
    if (!data.agentConnected) ElMessage.warning(data.message || '打印 Agent 未连接，任务已保存')
    else ElMessage.success('打印任务已下发')
    store.form.instruments = []
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '提交失败')
  } finally { store.printing = false }
}

onMounted(async () => {
  try {
    const [sRes, cRes, fRes] = await Promise.all([
      axios.get('/api/dict/STERILIZER'), axios.get('/api/dict/CHECKER'), axios.get('/api/dict/FURNACE')
    ])
    sterilizers.value = sRes.data; checkers.value = cRes.data; furnaces.value = fRes.data
    if (fRes.data.length > 0) { store.form.furnaceNo = fRes.data[0].name; await fetchFurnaceBatchNo(fRes.data[0].name) }
  } catch (e) { console.error('Failed to load dictionaries:', e) }
})
</script>
