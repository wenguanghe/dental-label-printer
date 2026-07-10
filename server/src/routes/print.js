import { Router } from 'express';
import { prisma, io } from '../index.js';
import { generateLabelPdf } from '../services/labelPdf.js';
import { sendPrintTask, getAgentStatus } from '../socket.js';

const router = Router();

// 获取打印机列表（从 Agent 缓存）
router.get('/printers', (_req, res) => {
  const agentStatus = getAgentStatus();
  res.json({
    printers: agentStatus.printers || [],
    currentPrinter: agentStatus.printerName || '',
    connected: agentStatus.connected
  });
});

// 提交打印任务
router.post('/submit', async (req, res) => {
  try {
    const { sterilizerName, checkerName, furnaceNo, sterilizeTime, expireTime, instruments, printerName } = req.body;

    // 校验
    if (!sterilizerName || !checkerName || !sterilizeTime || !expireTime) {
      return res.status(400).json({ error: '必填项缺失' });
    }
    if (!instruments || !instruments.length) {
      return res.status(400).json({ error: '请至少选择一个器械' });
    }

    const totalQuantity = instruments.reduce((sum, i) => sum + i.quantity, 0);

    // 保存任务到数据库
    const task = await prisma.printTask.create({
      data: {
        sterilizerName,
        checkerName,
        furnaceNo: furnaceNo || null,
        sterilizeTime: new Date(sterilizeTime),
        expireTime: new Date(expireTime),
        totalQuantity,
        items: {
          create: instruments.map(i => ({
            instrumentName: i.name,
            quantity: i.quantity
          }))
        }
      },
      include: { items: true }
    });

    // 生成 PDF
    const pdfBase64 = await generateLabelPdf(task);

    // 检查 Agent 状态
    const agentStatus = getAgentStatus();
    if (!agentStatus.connected) {
      // Agent 未连接时仍然保存任务，但不执行打印
      return res.json({
        taskId: task.id,
        message: '任务已保存，但打印 Agent 未连接',
        agentConnected: false
      });
    }

    // 下发给 Agent
    sendPrintTask(io, {
      taskId: task.id,
      pdfBase64,
      totalQuantity,
      printerName: printerName || undefined
    });

    res.json({
      taskId: task.id,
      message: '打印任务已下发',
      agentConnected: true
    });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 补打
router.post('/reprint/:id', async (req, res) => {
  try {
    const task = await prisma.printTask.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { items: true }
    });

    if (!task) return res.status(404).json({ error: '任务不存在' });

    const pdfBase64 = await generateLabelPdf(task);

    const agentStatus = getAgentStatus();
    if (!agentStatus.connected) {
      return res.json({ taskId: task.id, message: '任务已获取，但打印 Agent 未连接', agentConnected: false });
    }

    sendPrintTask(io, {
      taskId: task.id,
      pdfBase64,
      totalQuantity: task.totalQuantity,
      isReprint: true
    });

    res.json({ taskId: task.id, message: '补打任务已下发', agentConnected: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
