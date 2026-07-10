import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export const usePrintStore = defineStore('print', () => {
  // Socket
  const socket = ref(null)
  const initialized = ref(false)

  // Agent 状态
  const agentStatus = reactive({
    connected: false,
    printerName: null,
    printerOnline: false,
    printers: []
  })

  // 打印状态
  const printing = ref(false)
  const printResult = ref(null)

  // 表单数据
  const form = reactive({
    sterilizerName: '',
    checkerName: '',
    furnaceNo: localStorage.getItem('lastFurnace') || '',
    sterilizeTime: '',
    expireTime: '',
    instruments: [] // [{name, quantity}]
  })

  // 设置默认时间
  function setDefaultTimes() {
    const now = new Date()
    form.sterilizeTime = formatForInput(now)

    const expire = new Date(now)
    expire.setMonth(expire.getMonth() + 3)
    form.expireTime = formatForInput(expire)
  }

  function formatForInput(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d}T${h}:${min}`
  }

  function addInstrument(name) {
    const existing = form.instruments.find(i => i.name === name)
    if (existing) {
      existing.quantity++
    } else {
      form.instruments.push({ name, quantity: 1 })
    }
  }

  function batchAddInstruments(items) {
    for (const item of items) {
      const existing = form.instruments.find(i => i.name === item.name)
      if (existing) {
        existing.quantity += (item.quantity || 1)
      } else {
        form.instruments.push({ name: item.name, quantity: item.quantity || 1 })
      }
    }
  }

  function removeInstrument(index) {
    form.instruments.splice(index, 1)
  }

  function updateQuantity(index, delta) {
    const item = form.instruments[index]
    const newQty = item.quantity + delta
    if (newQty <= 0) {
      form.instruments.splice(index, 1)
    } else {
      item.quantity = newQty
    }
  }

  function setExpireTime(days) {
    const base = form.sterilizeTime ? new Date(form.sterilizeTime) : new Date()
    const expire = new Date(base)
    expire.setDate(expire.getDate() + days)
    form.expireTime = formatForInput(expire)
  }

  function setExpireTimeMonths(months) {
    const base = form.sterilizeTime ? new Date(form.sterilizeTime) : new Date()
    const expire = new Date(base)
    expire.setMonth(expire.getMonth() + months)
    form.expireTime = formatForInput(expire)
  }

  function rememberFurnace() {
    if (form.furnaceNo) {
      localStorage.setItem('lastFurnace', form.furnaceNo)
    }
  }

  function setAgentStatus(status) {
    agentStatus.connected = status.connected
    agentStatus.printerName = status.printerName
    agentStatus.printerOnline = status.printerOnline
    if (status.printers) agentStatus.printers = status.printers
  }

  function setSocket(s) {
    socket.value = s
  }

  function handlePrintResult(result) {
    printing.value = false
    printResult.value = result
    setTimeout(() => { printResult.value = null }, 3000)
  }

  function resetForm() {
    form.sterilizerName = ''
    form.checkerName = ''
    form.instruments = []
    setDefaultTimes()
  }

  // 初始化默认时间
  setDefaultTimes()

  return {
    socket, initialized, agentStatus, printing, printResult, form,
    addInstrument, batchAddInstruments, removeInstrument, updateQuantity,
    setExpireTime, setExpireTimeMonths, rememberFurnace,
    setAgentStatus, setSocket, handlePrintResult, resetForm, setDefaultTimes
  }
})
