<template>
  <div class="max-w-lg mx-auto px-4 py-4">
    <h1 class="text-xl font-bold text-gray-900 mb-4">数据统计</h1>

    <!-- 时间范围 -->
    <div class="flex gap-2 mb-4">
      <input v-model="startDate" type="date" class="input-field !py-2 !min-h-[40px] text-sm" />
      <span class="self-center text-gray-400">~</span>
      <input v-model="endDate" type="date" class="input-field !py-2 !min-h-[40px] text-sm" />
      <button class="btn-secondary !min-h-[40px] whitespace-nowrap text-sm" @click="loadStats">查询</button>
    </div>

    <!-- 汇总 -->
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

    <!-- Tab 切换 -->
    <div class="flex border-b border-gray-200 mb-4">
      <button v-for="tab in tabs" :key="tab.key"
        class="flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors"
        :class="activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'"
        @click="activeTab = tab.key">
        {{ tab.label }}
      </button>
    </div>

    <!-- 器械统计 -->
    <div v-if="activeTab === 'instruments' && stats">
      <Bar :data="instrumentChartData" :options="chartOptions" v-if="instrumentChartData" />
      <div v-if="stats.instruments.length === 0" class="text-center py-8 text-gray-400">暂无数据</div>
    </div>

    <!-- 人员统计 -->
    <div v-if="activeTab === 'personnel' && stats">
      <div class="space-y-3">
        <div v-if="stats.sterilizers.length">
          <h3 class="text-sm font-semibold text-gray-600 mb-2">消毒人员工作量</h3>
          <div v-for="s in stats.sterilizers" :key="s.name"
            class="flex justify-between items-center py-2 border-b border-gray-100">
            <span class="text-base">{{ s.name }}</span>
            <span class="text-sm text-gray-500">{{ s.taskCount }} 次 / {{ s.totalQuantity }} 张</span>
          </div>
        </div>
        <div v-if="stats.checkers.length">
          <h3 class="text-sm font-semibold text-gray-600 mb-2 mt-4">核对人员工作量</h3>
          <div v-for="c in stats.checkers" :key="c.name"
            class="flex justify-between items-center py-2 border-b border-gray-100">
            <span class="text-base">{{ c.name }}</span>
            <span class="text-sm text-gray-500">{{ c.taskCount }} 次 / {{ c.totalQuantity }} 张</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 炉号统计 -->
    <div v-if="activeTab === 'furnace' && stats">
      <div v-for="f in stats.furnaces" :key="f.name"
        class="flex justify-between items-center py-2 border-b border-gray-100">
        <span class="text-base">{{ f.name }}</span>
        <span class="text-sm text-gray-500">{{ f.count }} 次</span>
      </div>
      <div v-if="!stats.furnaces.length" class="text-center py-8 text-gray-400">暂无数据</div>
    </div>

    <!-- 导出 -->
    <button class="btn-primary w-full mt-6" @click="exportCsv">下载 CSV 报表</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

const tabs = [
  { key: 'instruments', label: '器械统计' },
  { key: 'personnel', label: '人员统计' },
  { key: 'furnace', label: '炉号统计' }
]

const activeTab = ref('instruments')
const stats = ref(null)

const today = new Date()
const weekAgo = new Date(today)
weekAgo.setDate(weekAgo.getDate() - 30)
const startDate = ref(weekAgo.toISOString().slice(0, 10))
const endDate = ref(today.toISOString().slice(0, 10))

const instrumentChartData = computed(() => {
  if (!stats.value || !stats.value.instruments.length) return null
  return {
    labels: stats.value.instruments.map(i => i.name),
    datasets: [{
      label: '消毒次数',
      data: stats.value.instruments.map(i => i.count),
      backgroundColor: '#3b82f6',
      borderRadius: 4
    }]
  }
})

const chartOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
}

async function loadStats() {
  try {
    const { data } = await axios.get('/api/stats/overview', {
      params: { startDate: startDate.value, endDate: endDate.value }
    })
    stats.value = data
  } catch (e) {
    console.error('Load stats failed:', e)
  }
}

async function exportCsv() {
  try {
    const response = await axios.get('/api/stats/export-csv', {
      params: { startDate: startDate.value, endDate: endDate.value },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `消毒记录_${startDate.value}_${endDate.value}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Export failed:', e)
  }
}

onMounted(loadStats)
</script>
