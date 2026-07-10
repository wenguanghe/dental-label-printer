import { Router } from 'express';
import { prisma } from '../index.js';

const router = Router();

// 综合统计
router.get('/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let where = {};
    if (startDate && endDate) {
      where = {
        createdAt: {
          gte: new Date(startDate),
          lt: new Date(new Date(endDate).getTime() + 86400000)
        }
      };
    }

    // 器械统计（Top 10）
    const instrumentStats = await prisma.printItem.groupBy({
      by: ['instrumentName'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
      where: {
        task: where
      }
    });

    // 消毒人员工作量
    const sterilizerStats = await prisma.printTask.groupBy({
      by: ['sterilizerName'],
      _count: { id: true },
      _sum: { totalQuantity: true },
      orderBy: { _count: { id: 'desc' } },
      where
    });

    // 核对人员工作量
    const checkerStats = await prisma.printTask.groupBy({
      by: ['checkerName'],
      _count: { id: true },
      _sum: { totalQuantity: true },
      orderBy: { _count: { id: 'desc' } },
      where
    });

    // 炉号频率
    const furnaceStats = await prisma.printTask.groupBy({
      by: ['furnaceNo'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      where: { ...where, furnaceNo: { not: null } }
    });

    // 总计
    const totalTasks = await prisma.printTask.count({ where });
    const totalItems = await prisma.printTask.aggregate({
      where,
      _sum: { totalQuantity: true }
    });

    res.json({
      instruments: instrumentStats.map(i => ({
        name: i.instrumentName,
        count: i._sum.quantity || 0
      })),
      sterilizers: sterilizerStats.map(s => ({
        name: s.sterilizerName,
        taskCount: s._count.id,
        totalQuantity: s._sum.totalQuantity || 0
      })),
      checkers: checkerStats.map(c => ({
        name: c.checkerName,
        taskCount: c._count.id,
        totalQuantity: c._sum.totalQuantity || 0
      })),
      furnaces: furnaceStats.map(f => ({
        name: f.furnaceNo || '未记录',
        count: f._count.id
      })),
      summary: {
        totalTasks,
        totalQuantity: totalItems._sum.totalQuantity || 0
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CSV 导出
router.get('/export-csv', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let where = {};
    if (startDate && endDate) {
      where = {
        createdAt: {
          gte: new Date(startDate),
          lt: new Date(new Date(endDate).getTime() + 86400000)
        }
      };
    }

    const tasks = await prisma.printTask.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    // BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const header = '序号,消毒时间,失效时间,消毒人员,核对人员,炉号/炉次,器械名称,数量';
    const rows = [];
    let idx = 1;
    for (const task of tasks) {
      for (const item of task.items) {
        const furnaceDisplay = task.furnaceNo ? task.furnaceNo.replace('|', ' ') : '-';
        rows.push([
          idx++,
          formatDateTime(task.sterilizeTime),
          formatDateTime(task.expireTime),
          csvEscape(task.sterilizerName),
          csvEscape(task.checkerName),
          csvEscape(furnaceDisplay),
          csvEscape(item.instrumentName),
          item.quantity
        ].join(','));
      }
    }

    const csv = BOM + header + '\n' + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=sterilization_report_${startDate || ''}_${endDate || ''}.csv`);
    res.send(csv);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function csvEscape(val) {
  if (!val) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Excel 导出
router.get('/export', async (req, res) => {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const { startDate, endDate } = req.query;

    let where = {};
    if (startDate && endDate) {
      where = {
        createdAt: {
          gte: new Date(startDate),
          lt: new Date(new Date(endDate).getTime() + 86400000)
        }
      };
    }

    const tasks = await prisma.printTask.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('消毒记录');

    sheet.columns = [
      { header: '序号', key: 'index', width: 8 },
      { header: '消毒时间', key: 'sterilizeTime', width: 20 },
      { header: '失效时间', key: 'expireTime', width: 20 },
      { header: '消毒人员', key: 'sterilizerName', width: 12 },
      { header: '核对人员', key: 'checkerName', width: 12 },
      { header: '炉号', key: 'furnaceNo', width: 10 },
      { header: '器械名称', key: 'instrumentName', width: 20 },
      { header: '数量', key: 'quantity', width: 8 },
    ];

    // 表头样式
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    let idx = 1;
    for (const task of tasks) {
      for (const item of task.items) {
        sheet.addRow({
          index: idx++,
          sterilizeTime: formatDateTime(task.sterilizeTime),
          expireTime: formatDateTime(task.expireTime),
          sterilizerName: task.sterilizerName,
          checkerName: task.checkerName,
          furnaceNo: task.furnaceNo || '-',
          instrumentName: item.instrumentName,
          quantity: item.quantity
        });
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sterilization_report_${new Date().toISOString().slice(0, 10)}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatDateTime(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default router;
