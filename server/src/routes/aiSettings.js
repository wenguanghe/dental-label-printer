import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logTestConnection } from '../services/aiLogger.js';
import { listLogFiles, readLogFile } from '../services/aiLogger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'ai-settings.json');

const router = express.Router();

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 加载设置（内部使用）
export function loadRawSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

// 脱敏设置
function maskSettings(settings) {
  const masked = { stt: {}, ext: {}, logging: {} };
  for (const key of ['stt', 'ext']) {
    const cfg = settings[key] || {};
    masked[key] = {
      apiBase: cfg.apiBase || 'https://api.openai.com/v1',
      model: cfg.model || '',
      format: cfg.format || 'openai',
      hasApiKey: !!cfg.apiKey
    };
  }
  masked.logging = {
    enabled: settings.logging?.enabled ?? false,
    logDir: settings.logging?.logDir || ''
  };
  return masked;
}

// GET /api/ai-settings
router.get('/', (_req, res) => {
  res.json(maskSettings(loadRawSettings()));
});

// POST /api/ai-settings
router.post('/', (req, res) => {
  try {
    const existing = loadRawSettings();
    const { stt, ext, saveWhich } = req.body;

    // 如果指定了 saveWhich，只保存该模型的配置
    const keys = saveWhich ? [saveWhich] : ['stt', 'ext'];

    for (const key of keys) {
      const input = key === 'stt' ? stt : ext;
      if (!input) continue;
      if (!existing[key]) existing[key] = {};

      if (input.apiKey !== undefined) existing[key].apiKey = input.apiKey.trim() || undefined;
      if (input.apiBase !== undefined) existing[key].apiBase = input.apiBase.trim() || 'https://api.openai.com/v1';
      if (input.model !== undefined) existing[key].model = input.model.trim() || '';
      if (input.format !== undefined) existing[key].format = input.format.trim() || 'openai';
    }

    // 日志设置
    const { logging } = req.body;
    if (logging) {
      if (!existing.logging) existing.logging = {};
      if (logging.enabled !== undefined) existing.logging.enabled = !!logging.enabled;
      if (logging.logDir !== undefined) existing.logging.logDir = logging.logDir.trim() || '';
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(existing, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    console.error('Save AI settings error:', e);
    res.status(500).json({ error: '保存设置失败: ' + e.message });
  }
});

// POST /api/ai-settings/test — 单独测试某个模型
router.post('/test', async (req, res) => {
  try {
    const existing = loadRawSettings();
    const { stt: sttInput, ext: extInput, testWhich } = req.body;

    function getConfig(input, savedKey) {
      const saved = existing[savedKey] || {};
      return {
        apiKey: input?.apiKey?.trim() || saved.apiKey,
        apiBase: (input?.apiBase?.trim() || saved.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, ''),
        model: input?.model?.trim() || saved.model
      };
    }

    const cfg = getConfig(testWhich === 'ext' ? extInput : sttInput, testWhich === 'ext' ? 'ext' : 'stt');
    const label = testWhich === 'ext' ? '语义提取模型' : '语音识别模型';

    if (!cfg.apiKey) return res.json({ success: false, error: `${label}未配置 API Key` });
    if (!cfg.model) return res.json({ success: false, error: `${label}未配置模型名称` });

    const body = {
      model: cfg.model,
      messages: [{ role: 'user', content: '请回复"连接成功"' }],
      max_tokens: 20, temperature: 0,
      stream: true, stream_options: { include_usage: true },
      modalities: ['text']
    };

    const t0 = Date.now();
    const response = await fetch(`${cfg.apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errText = await response.text();
      logTestConnection({ label, model: cfg.model, apiBase: cfg.apiBase, apiKey: cfg.apiKey, requestBody: body, response: null, error: `${response.status}: ${errText.slice(0, 200)}`, durationMs: Date.now() - t0 });
      return res.json({ success: false, error: `${label} (${cfg.model}) 失败: ${response.status}`, detail: errText.slice(0, 200) });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        const t = line.trim();
        if (!t.startsWith('data: ') || t === 'data: [DONE]') continue;
        try { const j = JSON.parse(t.slice(6)); if (j.choices?.[0]?.delta?.content) content += j.choices[0].delta.content; } catch (e) {}
      }
    }

    logTestConnection({ label, model: cfg.model, apiBase: cfg.apiBase, apiKey: cfg.apiKey, requestBody: body, response: content, durationMs: Date.now() - t0 });
    res.json({ success: true, message: `${label} (${cfg.model}) 响应: ${content.slice(0, 80)}` });
  } catch (e) {
    console.error('Model test error:', e);
    const msg = e.name === 'TimeoutError' ? '连接超时（15秒）' : e.message;
    logTestConnection({ label: '模型测试', model: '?', apiBase: '?', apiKey: '?', requestBody: {}, response: null, error: msg, durationMs: 0 });
    res.json({ success: false, error: `测试失败: ${msg}` });
  }
});

// GET /api/ai-settings/logs — 列出日志文件
router.get('/logs', (_req, res) => {
  try {
    const files = listLogFiles();
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: '读取日志列表失败: ' + e.message });
  }
});

// GET /api/ai-settings/logs/:filename — 读取日志内容
router.get('/logs/:filename', (req, res) => {
  try {
    const content = readLogFile(req.params.filename);
    if (content === null) return res.status(404).json({ error: '日志文件不存在' });
    res.json({ filename: req.params.filename, content });
  } catch (e) {
    res.status(500).json({ error: '读取日志失败: ' + e.message });
  }
});

export default router;
