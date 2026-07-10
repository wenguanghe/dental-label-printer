import { io } from 'socket.io-client'
import { writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { exec, execSync } from 'child_process'
import { join } from 'path'
import { tmpdir, platform } from 'os'

// ============ 配置 ============
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'
const IS_MOCK = process.env.IS_MOCK === 'true'
let currentPrinter = process.env.PRINTER_NAME || ''

// 确保临时目录存在
const printDir = join(tmpdir(), 'dental-print-agent')
try { mkdirSync(printDir, { recursive: true }) } catch {}

// ============ 获取本机打印机列表 ============
function getLocalPrinters() {
  try {
    if (platform() === 'win32') {
      // Windows: PowerShell 获取打印机列表
      const cmd = 'powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"'
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 })
      return output.split('\n').map(s => s.trim()).filter(Boolean)
    } else {
      // macOS/Linux: lpstat
      const output = execSync('lpstat -a 2>/dev/null', { encoding: 'utf-8', timeout: 5000 })
      return output.split('\n').map(s => s.split(' ')[0].trim()).filter(Boolean)
    }
  } catch (e) {
    console.error('[Agent] 获取打印机列表失败:', e.message)
    // 返回空列表或默认
    return IS_MOCK ? ['Mac Mock 打印机', 'System Default'] : []
  }
}

// 获取默认打印机
function getDefaultPrinter() {
  try {
    if (platform() === 'win32') {
      const cmd = 'powershell -Command "(Get-WmiObject -Query \\"SELECT * FROM Win32_Printer WHERE Default=True\\").Name"'
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim()
      return output || ''
    } else {
      const output = execSync('lpstat -d 2>/dev/null', { encoding: 'utf-8', timeout: 5000 })
      const match = output.match(/:\s*(.+)/)
      return match ? match[1].trim() : ''
    }
  } catch {
    return ''
  }
}

// 初始化打印机
if (!currentPrinter) {
  currentPrinter = getDefaultPrinter() || 'Default Printer'
}

const printers = getLocalPrinters()
console.log('========================================')
console.log('  口腔门诊消毒标签打印 Agent')
console.log('========================================')
console.log(`  服务器: ${SERVER_URL}`)
console.log(`  模式: ${IS_MOCK ? 'Mock (Mac 开发预览)' : '真实打印'}`)
console.log(`  当前打印机: ${currentPrinter}`)
console.log(`  可用打印机: ${printers.length} 台`)
printers.forEach(p => console.log(`    - ${p}`))
console.log('========================================\n')

// 连接服务端
const socket = io(SERVER_URL, {
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: Infinity
})

socket.on('connect', () => {
  console.log('[Agent] 已连接到服务端:', SERVER_URL)

  // 注册为 Agent，附带打印机列表
  socket.emit('agent_register', {
    printerName: currentPrinter,
    printerOnline: true,
    printers: printers
  })
})

socket.on('disconnect', (reason) => {
  console.log('[Agent] 与服务端断开连接:', reason)
})

socket.on('connect_error', (err) => {
  console.log('[Agent] 连接失败，将自动重试...', err.message)
})

// 服务端请求刷新打印机列表
socket.on('refresh_printers', () => {
  const updatedPrinters = getLocalPrinters()
  console.log('[Agent] 刷新打印机列表:', updatedPrinters.length, '台')
  socket.emit('printers_list', { printers: updatedPrinters })
})

// 服务端切换打印机
socket.on('set_printer', (data) => {
  console.log(`[Agent] 切换打印机: ${currentPrinter} → ${data.printerName}`)
  currentPrinter = data.printerName
  socket.emit('agent_status_update', { printerName: currentPrinter })
})

// 监听打印任务
socket.on('print_task', async (data) => {
  const { taskId, pdfBase64, totalQuantity, isReprint, printerName } = data
  const targetPrinter = printerName || currentPrinter
  console.log(`[Agent] 收到打印任务 #${taskId}${isReprint ? ' (补打)' : ''}，共 ${totalQuantity} 张，打印机: ${targetPrinter}`)

  try {
    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    const pdfPath = join(printDir, `label_task_${taskId}_${Date.now()}.pdf`)
    writeFileSync(pdfPath, pdfBuffer)
    console.log(`[Agent] PDF 已保存: ${pdfPath}`)

    if (IS_MOCK) {
      console.log('[Agent] Mock 模式 - 打开 PDF 预览...')
      exec(`open "${pdfPath}"`, (err) => {
        if (err) console.error('[Agent] 打开预览失败:', err.message)
        else console.log('[Agent] PDF 预览已打开')
        socket.emit('print_success', { taskId })
      })
    } else {
      // 真实打印模式 (Windows)
      try {
        const { print } = await import('pdf-to-printer')
        await print(pdfPath, { printer: targetPrinter })
        console.log(`[Agent] 打印完成: task #${taskId} → ${targetPrinter}`)
        socket.emit('print_success', { taskId })
        try { unlinkSync(pdfPath) } catch {}
      } catch (printErr) {
        console.error('[Agent] 打印失败:', printErr.message)
        socket.emit('print_error', { taskId, error: printErr.message })
      }
    }
  } catch (err) {
    console.error('[Agent] 处理打印任务失败:', err.message)
    socket.emit('print_error', { taskId, error: err.message })
  }
})

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[Agent] 正在退出...')
  socket.disconnect()
  process.exit(0)
})

process.on('SIGTERM', () => {
  socket.disconnect()
  process.exit(0)
})
