<template>
  <div class="max-w-lg mx-auto px-4 py-4 space-y-5">
    <PrinterStatus />

    <h1 class="text-xl font-bold text-gray-900">消毒标签打印</h1>

    <!-- 消毒人员 -->
    <div>
      <label class="label-text required">消毒人员</label>
      <div class="relative">
        <input v-model="sterilizerSearch" type="text" class="input-field"
          placeholder="搜索或输入消毒人员姓名"
          @focus="showSterilizerDropdown = true" />
        <div v-if="showSterilizerDropdown" class="fixed inset-0 z-0" @click="showSterilizerDropdown = false" />
        <div v-if="showSterilizerDropdown && (sterilizerSearch || sterilizers.length)"
          class="absolute mt-1 bg-white border rounded-lg shadow-lg max-h-36 overflow-y-auto z-10 w-full">
          <div v-for="s in filteredSterilizers" :key="s.id"
            class="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-base"
            @click="selectSterilizer(s.name)">{{ s.name }}</div>
          <div v-if="filteredSterilizers.length === 0 && sterilizerSearch" class="p-3">
            <button class="btn-secondary !min-h-[36px] w-full text-sm" @click="selectSterilizer(sterilizerSearch)">
              使用 "{{ sterilizerSearch }}"
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 核对人员 -->
    <div>
      <label class="label-text required">核对人员</label>
      <div class="relative">
        <input v-model="checkerSearch" type="text" class="input-field"
          placeholder="搜索或输入核对人员姓名"
          @focus="showCheckerDropdown = true" />
        <div v-if="showCheckerDropdown" class="fixed inset-0 z-0" @click="showCheckerDropdown = false" />
        <div v-if="showCheckerDropdown && (checkerSearch || checkers.length)"
          class="absolute mt-1 bg-white border rounded-lg shadow-lg max-h-36 overflow-y-auto z-10 w-full">
          <div v-for="c in filteredCheckers" :key="c.id"
            class="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-base"
            @click="selectChecker(c.name)">{{ c.name }}</div>
          <div v-if="filteredCheckers.length === 0 && checkerSearch" class="p-3">
            <button class="btn-secondary !min-h-[36px] w-full text-sm" @click="selectChecker(checkerSearch)">
              使用 "{{ checkerSearch }}"
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 炉号 + 炉次 -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="label-text !mb-0">炉号 / 炉次</label>
        <button class="text-xs text-blue-500 underline" @click="openFurnaceEditPopup">手动编辑</button>
      </div>
      <div class="flex items-center gap-3">
        <!-- 炉号选择 -->
        <div class="relative flex-1">
          <button class="input-field text-left flex items-center justify-between"
            @click="showFurnaceDropdown = !showFurnaceDropdown">
            <span>{{ store.form.furnaceNo || '选择炉号' }}</span>
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div v-if="showFurnaceDropdown" class="fixed inset-0 z-0" @click="showFurnaceDropdown = false" />
          <div v-if="showFurnaceDropdown && furnaces.length"
            class="absolute mt-1 bg-white border rounded-lg shadow-lg max-h-36 overflow-y-auto z-10 w-full">
            <div v-for="f in furnaces" :key="f.id"
              class="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-base"
              :class="{ 'bg-blue-50 text-blue-700 font-medium': store.form.furnaceNo === f.name }"
              @click="selectFurnace(f.name)">{{ f.name }}</div>
          </div>
        </div>
        <!-- 炉次显示 -->
        <div class="bg-orange-50 text-orange-700 font-semibold px-4 py-3 rounded-lg text-base whitespace-nowrap min-w-[90px] text-center">
          炉次: {{ batchToLetter(furnaceBatchNo) }}
        </div>
      </div>
    </div>

    <!-- 炉号/炉次手动编辑弹窗 -->
    <div v-if="showFurnaceEditPopup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showFurnaceEditPopup = false">
      <div class="bg-white rounded-xl shadow-2xl w-[90%] max-w-sm p-5 space-y-4">
        <h3 class="text-lg font-bold text-gray-900">编辑炉号 / 炉次</h3>
        <div>
          <label class="label-text">炉号</label>
          <input v-model="furnaceEditNo" type="text" class="input-field" placeholder="如: 1号炉" />
        </div>
        <div>
          <label class="label-text">炉次（英文字母，如 A）</label>
          <input v-model="furnaceEditBatchLetter" type="text" maxlength="3" class="input-field" placeholder="A" />
        </div>
        <div class="flex gap-3">
          <button class="btn-secondary flex-1" @click="showFurnaceEditPopup = false">取消</button>
          <button class="btn-primary flex-1" @click="confirmFurnaceEdit">确定</button>
        </div>
      </div>
    </div>

    <!-- 消毒时间 + 失效时间(小链接) -->
    <div>
      <label class="label-text required">消毒时间</label>
      <input v-model="store.form.sterilizeTime" type="datetime-local" class="input-field" />
      <div class="flex items-center justify-between mt-1 px-1">
        <span class="text-xs text-gray-400">失效时间：</span>
        <button class="text-xs text-blue-500 underline" @click="showExpirePopup = true">
          {{ store.form.expireTime ? formatExpireTime(store.form.expireTime) : '点击设置' }}
        </button>
      </div>
    </div>

    <!-- 失效时间弹窗 -->
    <div v-if="showExpirePopup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showExpirePopup = false">
      <div class="bg-white rounded-xl shadow-2xl w-[90%] max-w-sm p-5 space-y-4">
        <h3 class="text-lg font-bold text-gray-900">设置失效时间</h3>
        <input v-model="expireTimeTemp" type="datetime-local" class="input-field" />
        <!-- 快捷按钮 -->
        <div class="flex flex-wrap gap-2">
          <button class="btn-secondary !py-1.5 !px-3 !min-h-[36px] text-xs" @click="setExpireDays(7)">+7天</button>
          <button class="btn-secondary !py-1.5 !px-3 !min-h-[36px] text-xs" @click="setExpireDays(14)">+14天</button>
          <button class="btn-secondary !py-1.5 !px-3 !min-h-[36px] text-xs" @click="setExpireDays(180)">+180天</button>
          <button class="btn-secondary !py-1.5 !px-3 !min-h-[36px] text-xs" @click="setExpireMonths(3)">+3个月</button>
        </div>
        <div class="flex gap-3">
          <button class="btn-secondary flex-1" @click="showExpirePopup = false">取消</button>
          <button class="btn-primary flex-1" @click="confirmExpireTime">确定</button>
        </div>
      </div>
    </div>

    <!-- 器械选择 -->
    <div>
      <InstrumentSelector @select="store.addInstrument" @batch-select="store.batchAddInstruments" />
    </div>

    <!-- 待打印列表 -->
    <div v-if="store.form.instruments.length > 0">
      <label class="label-text">待打印列表 ({{ totalQuantity }} 张)</label>
      <div class="space-y-2">
        <div v-for="(item, idx) in store.form.instruments" :key="idx"
          class="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-200">
          <div class="flex-1">
            <span class="text-base font-medium">{{ item.name }}</span>
          </div>
          <div class="flex items-center gap-3">
            <QuantityControl :quantity="item.quantity" @change="(d) => store.updateQuantity(idx, d)" />
            <button class="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
              @click="store.removeInstrument(idx)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 打印按钮（上移到列表下方） -->
    <button v-if="store.form.instruments.length > 0"
      class="btn-primary w-full text-lg" :disabled="!canSubmit || store.printing" @click="submitPrint">
      <span v-if="store.printing" class="flex items-center justify-center gap-2">
        <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        打印中...
      </span>
      <span v-else>开始打印 ({{ totalQuantity }} 张)</span>
    </button>

    <!-- 底部：继续添加器械（弹窗） -->
    <button class="w-full bg-blue-50 text-blue-600 font-semibold py-3 px-6 rounded-lg text-base
      active:bg-blue-100 transition-colors min-h-[48px] border-2 border-dashed border-blue-300"
      @click="showAddInstrumentPopup = true">
      + 继续添加器械
    </button>

    <!-- 添加器械弹窗 -->
    <div v-if="showAddInstrumentPopup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showAddInstrumentPopup = false">
      <div class="bg-white rounded-2xl shadow-2xl w-[90%] max-w-lg p-5 space-y-4 max-h-[70vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900">添加器械</h3>
          <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100" @click="showAddInstrumentPopup = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <InstrumentSelector @select="(name) => { store.addInstrument(name); showAddInstrumentPopup = false }" @batch-select="(items) => { store.batchAddInstruments(items); showAddInstrumentPopup = false }" />
        <!-- 当前已添加的器械快捷查看 -->
        <div v-if="store.form.instruments.length > 0" class="border-t border-gray-100 pt-3">
          <p class="text-xs text-gray-400 mb-2">已添加 ({{ totalQuantity }} 张)</p>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="(item, idx) in store.form.instruments" :key="idx"
              class="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
              {{ item.name }} ×{{ item.quantity }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 打印结果提示 -->
    <div v-if="store.printResult"
      class="fixed top-4 left-4 right-4 z-50 rounded-lg px-4 py-3 text-center font-medium shadow-lg"
      :class="store.printResult.success ? 'bg-green-500 text-white' : 'bg-red-500 text-white'">
      {{ store.printResult.success ? '打印成功！' : '打印失败: ' + (store.printResult.error || '未知错误') }}
    </div>

    <!-- 校验错误提示 -->
    <div v-if="errorMsg"
      class="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-yellow-800 text-sm">
      {{ errorMsg }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { usePrintStore } from '../stores/print.js'
import InstrumentSelector from '../components/InstrumentSelector.vue'
import QuantityControl from '../components/QuantityControl.vue'
import PrinterStatus from '../components/PrinterStatus.vue'

const store = usePrintStore()

const sterilizerSearch = ref('')
const checkerSearch = ref('')
const furnaceSearch = ref('')
const showSterilizerDropdown = ref(false)
const showCheckerDropdown = ref(false)
const showFurnaceDropdown = ref(false)
const sterilizers = ref([])
const checkers = ref([])
const furnaces = ref([])
const errorMsg = ref('')

// 炉次（今日第几次）
const furnaceBatchNo = ref(1)
const showFurnaceEditPopup = ref(false)
const furnaceEditNo = ref('')
const furnaceEditBatchLetter = ref('A')
const furnaceBatchManual = ref(false) // 是否手动覆盖

// 添加器械弹窗
const showAddInstrumentPopup = ref(false)

// 数字转字母: 1→A, 2→B, ... 26→Z, 27→AA
function batchToLetter(n) {
  let result = ''
  while (n > 0) {
    n--
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return result
}

// 字母转数字: A→1, B→2, ... Z→26, AA→27
function letterToNumber(s) {
  let result = 0
  for (let i = 0; i < s.length; i++) {
    result = result * 26 + (s.charCodeAt(i) - 64)
  }
  return result || 1
}

// 失效时间弹窗
const showExpirePopup = ref(false)
const expireTimeTemp = ref(store.form.expireTime || '')

function formatExpireTime(val) {
  if (!val) return '未设置'
  const d = new Date(val)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}.${m}.${day} ${h}:${min}`
}

function setExpireDays(days) {
  const base = store.form.sterilizeTime ? new Date(store.form.sterilizeTime) : new Date()
  const expire = new Date(base)
  expire.setDate(expire.getDate() + days)
  expireTimeTemp.value = toLocalISOString(expire)
}

function setExpireMonths(months) {
  const base = store.form.sterilizeTime ? new Date(store.form.sterilizeTime) : new Date()
  const expire = new Date(base)
  expire.setMonth(expire.getMonth() + months)
  expireTimeTemp.value = toLocalISOString(expire)
}

function toLocalISOString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}

function confirmExpireTime() {
  if (expireTimeTemp.value) {
    store.form.expireTime = expireTimeTemp.value
  }
  showExpirePopup.value = false
}

const filteredSterilizers = computed(() => {
  const q = sterilizerSearch.value.toLowerCase()
  if (!q) return sterilizers.value
  return sterilizers.value.filter(s =>
    s.name.includes(q) || (s.pinyin && s.pinyin.includes(q))
  )
})

const filteredCheckers = computed(() => {
  const q = checkerSearch.value.toLowerCase()
  if (!q) return checkers.value
  return checkers.value.filter(c =>
    c.name.includes(q) || (c.pinyin && c.pinyin.includes(q))
  )
})

const filteredFurnaces = computed(() => furnaces.value)

const totalQuantity = computed(() =>
  store.form.instruments.reduce((sum, i) => sum + i.quantity, 0)
)

const canSubmit = computed(() =>
  store.form.sterilizerName && store.form.checkerName &&
  store.form.sterilizeTime && store.form.expireTime &&
  store.form.instruments.length > 0
)

function selectSterilizer(name) {
  store.form.sterilizerName = name
  sterilizerSearch.value = name
  showSterilizerDropdown.value = false
}

function selectChecker(name) {
  store.form.checkerName = name
  checkerSearch.value = name
  showCheckerDropdown.value = false
}

async function selectFurnace(name) {
  store.form.furnaceNo = name
  showFurnaceDropdown.value = false
  furnaceBatchManual.value = false
  await fetchFurnaceBatchNo(name)
}

// 获取某炉号今日使用次数，炉次 = count + 1
async function fetchFurnaceBatchNo(furnaceName) {
  try {
    const { data } = await axios.get('/api/print/furnace-today-count', { params: { furnaceNo: furnaceName } })
    furnaceBatchNo.value = data.count + 1
  } catch (e) {
    furnaceBatchNo.value = 1
  }
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

// 同步表单与搜索框
watch(() => store.form.sterilizerName, (v) => { if (v) sterilizerSearch.value = v })
watch(() => store.form.checkerName, (v) => { if (v) checkerSearch.value = v })

async function submitPrint() {
  errorMsg.value = ''

  if (!store.form.sterilizerName) { errorMsg.value = '请选择或输入消毒人员'; return }
  if (!store.form.checkerName) { errorMsg.value = '请选择或输入核对人员'; return }
  if (!store.form.sterilizeTime) { errorMsg.value = '请选择消毒时间'; return }
  if (!store.form.expireTime) { errorMsg.value = '请设置失效时间'; return }
  if (new Date(store.form.expireTime) <= new Date(store.form.sterilizeTime)) {
    errorMsg.value = '失效时间不能早于消毒时间'; return
  }
  if (store.form.instruments.length === 0) { errorMsg.value = '请至少添加一个器械'; return }

  store.rememberFurnace()
  store.printing = true

  try {
    const { data } = await axios.post('/api/print/submit', {
      sterilizerName: store.form.sterilizerName,
      checkerName: store.form.checkerName,
      furnaceNo: store.form.furnaceNo ? `${store.form.furnaceNo}|${batchToLetter(furnaceBatchNo.value)}` : '',
      sterilizeTime: store.form.sterilizeTime,
      expireTime: store.form.expireTime,
      instruments: store.form.instruments,
      printerName: localStorage.getItem('selectedPrinter') || undefined
    })

    if (!data.agentConnected) {
      errorMsg.value = data.message || '打印 Agent 未连接，任务已保存'
    }

    // 成功后重置器械列表
    store.form.instruments = []
  } catch (e) {
    errorMsg.value = e.response?.data?.error || '提交失败'
  } finally {
    store.printing = false
  }
}

onMounted(async () => {
  try {
    const [sRes, cRes, fRes] = await Promise.all([
      axios.get('/api/dict/STERILIZER'),
      axios.get('/api/dict/CHECKER'),
      axios.get('/api/dict/FURNACE')
    ])
    sterilizers.value = sRes.data
    checkers.value = cRes.data
    furnaces.value = fRes.data
    // 默认选择第一个炉号并获取炉次
    if (fRes.data.length > 0) {
      await selectFurnace(fRes.data[0].name)
    }
  } catch (e) {
    console.error('Failed to load dictionaries:', e)
  }
})
</script>
