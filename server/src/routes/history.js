import { Router } from 'express';
import { prisma } from '../index.js';

const router = Router();

// 获取打印历史
router.get('/history', async (req, res) => {
  try {
    const { date } = req.query;
    let where = {};

    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where = { createdAt: { gte: start, lt: end } };
    } else {
      // 默认今天
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where = { createdAt: { gte: start, lt: end } };
    }

    const tasks = await prisma.printTask.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取某炉号今日使用次数
router.get('/furnace-today-count', async (req, res) => {
  try {
    const { furnaceNo } = req.query;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const count = await prisma.printTask.count({
      where: {
        furnaceNo: furnaceNo || '',
        createdAt: { gte: start, lt: end }
      }
    });

    res.json({ furnaceNo: furnaceNo || '', count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
