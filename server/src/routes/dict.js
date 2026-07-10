import { Router } from 'express';
import { pinyin } from 'pinyin-pro';
import { prisma } from '../index.js';

const router = Router();

function getPinyin(name) {
  return pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' })
    .join('')
    .toLowerCase();
}

// 获取字典列表
router.get('/:type', async (req, res) => {
  try {
    const items = await prisma.dictionary.findMany({
      where: { type: req.params.type, isActive: true },
      select: { id: true, name: true, pinyin: true },
      orderBy: { name: 'asc' }
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增字典项
router.post('/', async (req, res) => {
  try {
    const { type, name } = req.body;
    if (!type || !name) return res.status(400).json({ error: '缺少 type 或 name' });

    const item = await prisma.dictionary.create({
      data: { type, name: name.trim(), pinyin: getPinyin(name.trim()) }
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: '该字典项已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 删除字典项（软删除）
router.delete('/:id', async (req, res) => {
  try {
    await prisma.dictionary.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV 导出
router.get('/:type/export', async (req, res) => {
  try {
    const items = await prisma.dictionary.findMany({
      where: { type: req.params.type, isActive: true },
      select: { name: true },
      orderBy: { name: 'asc' }
    });
    const header = '\uFEFF名称\n'; // UTF-8 BOM
    const csv = header + items.map(i => i.name).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 批量导入字典项
router.post('/batch', async (req, res) => {
  try {
    const { type, names } = req.body;
    if (!type || !Array.isArray(names)) return res.status(400).json({ error: '参数错误' });

    const results = [];
    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      try {
        const item = await prisma.dictionary.create({
          data: { type, name: trimmed, pinyin: getPinyin(trimmed) }
        });
        results.push(item);
      } catch (e) {
        if (e.code !== 'P2002') throw e;
      }
    }
    res.json({ imported: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
