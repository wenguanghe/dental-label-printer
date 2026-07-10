import fs from 'fs';
import path from 'path';

const DEFAULT_LOG_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'data', 'logs');

// API Key 脱敏
function maskKey(key) {
  if (!key || typeof key !== 'string') return '(未配置)';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

// 截断长文本（如 base64 音频）
function truncate(text, maxLen = 500) {
  if (!text || typeof text !== 'string') return String(text);
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + `\n... (共 ${text.length} 字符，已截断)`;
}

// 格式化时间
function now() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

// 加载日志设置
function loadLogSettings() {
  try {
    const settingsFile = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'data', 'ai-settings.json');
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      return {
        enabled: settings.logging?.enabled ?? false,
        logDir: settings.logging?.logDir || DEFAULT_LOG_DIR
      };
    }
  } catch (e) { /* ignore */ }
  return { enabled: false, logDir: DEFAULT_LOG_DIR };
}

// 获取当天日志文件路径
function getLogFilePath() {
  const { logDir } = loadLogSettings();
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }); // YYYY-MM-DD
  return path.join(logDir, `ai-model-${date}.md`);
}

// 追加写入日志
function appendLog(content) {
  const { enabled } = loadLogSettings();
  if (!enabled) return;
  const filePath = getLogFilePath();
  // 如果是新文件，写标题
  if (!fs.existsSync(filePath)) {
    const date = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    fs.writeFileSync(filePath, `# AI 模型交互日志 — ${date}\n\n`, 'utf-8');
  }
  fs.appendFileSync(filePath, content, 'utf-8');
}

// ========== 日志记录函数 ==========

/** 记录语音识别模型调用（Step1） */
export function logTranscription({ model, apiBase, apiKey, audioFormat, audioSize, prompt, response, usage, error, durationMs }) {
  const status = error ? '❌ 失败' : '✅ 成功';
  const content = `
---

## 🎤 语音识别（Step1） ${status}

| 项目 | 值 |
|------|------|
| 时间 | ${now()} |
| 模型 | ${model} |
| API 地址 | ${apiBase} |
| API Key | ${maskKey(apiKey)} |
| 音频格式 | ${audioFormat} |
| 音频大小 | ${audioSize} |
| 耗时 | ${durationMs}ms |

### 输入 Prompt

\`\`\`
${prompt}
\`\`\`

### 模型输出

${error ? `**错误:** ${error}` : `\`\`\`\n${truncate(response, 2000)}\n\`\`\``}

${usage ? `### Token 用量\n\n| 输入 | 输出 | 总计 |\n|------|------|------|\n| ${usage.prompt_tokens || '-'} | ${usage.completion_tokens || '-'} | ${usage.total_tokens || '-'} |` : ''}
`;
  appendLog(content);
}

/** 记录语义提取模型调用（Step2 / Retry） */
export function logExtraction({ step, model, apiBase, apiKey, systemPrompt, userPrompt, response, usage, error, durationMs }) {
  const status = error ? '❌ 失败' : '✅ 成功';
  const label = step === 'retry' ? 'Step2-Retry' : 'Step2';
  const content = `
---

## 🧠 语义提取（${label}） ${status}

| 项目 | 值 |
|------|------|
| 时间 | ${now()} |
| 模型 | ${model} |
| API 地址 | ${apiBase} |
| API Key | ${maskKey(apiKey)} |
| 耗时 | ${durationMs}ms |

### System Prompt

\`\`\`
${truncate(systemPrompt, 1000)}
\`\`\`

### User Prompt

\`\`\`
${truncate(userPrompt, 2000)}
\`\`\`

### 模型输出

${error ? `**错误:** ${error}` : `\`\`\`\n${truncate(response, 2000)}\n\`\`\``}

${usage ? `### Token 用量\n\n| 输入 | 输出 | 总计 |\n|------|------|------|\n| ${usage.prompt_tokens || '-'} | ${usage.completion_tokens || '-'} | ${usage.total_tokens || '-'} |` : ''}
`;
  appendLog(content);
}

/** 记录字典过滤（Step3） */
export function logDictionaryFilter({ before, kept, filteredOut }) {
  const content = `
---

## 📋 字典过滤（Step3）

| 项目 | 值 |
|------|------|
| 时间 | ${now()} |
| 提取器械数 | ${before.length} |
| 保留数 | ${kept.length} |
| 过滤数 | ${filteredOut.length} |

### 提取结果

\`\`\`json
${JSON.stringify(before, null, 2)}
\`\`\`

### 过滤后

- 保留: ${kept.length > 0 ? kept.map(i => `${i.name}×${i.quantity}`).join('、') : '(无)'}
- 过滤掉: ${filteredOut.length > 0 ? filteredOut.join('、') : '(无)'}
`;
  appendLog(content);
}

/** 记录测试连接 */
export function logTestConnection({ label, model, apiBase, apiKey, requestBody, response, error, durationMs }) {
  const status = error ? '❌ 失败' : '✅ 成功';
  const content = `
---

## 🔗 测试连接 ${status}

| 项目 | 值 |
|------|------|
| 时间 | ${now()} |
| 模型标签 | ${label} |
| 模型名称 | ${model} |
| API 地址 | ${apiBase} |
| API Key | ${maskKey(apiKey)} |
| 耗时 | ${durationMs}ms |

### 请求 Body

\`\`\`json
${JSON.stringify(requestBody, null, 2)}
\`\`\`

### 响应

${error ? `**错误:** ${error}` : `\`\`\`\n${truncate(response, 1000)}\n\`\`\``}
`;
  appendLog(content);
}

/** 记录一次完整的语音会话摘要 */
export function logVoiceSession({ transcript, finalInstruments, filteredOut, cancelled }) {
  const content = `
---

## 📝 语音会话结果

| 项目 | 值 |
|------|------|
| 时间 | ${now()} |

### 转写文本

> ${transcript || '(空)'}

### 最终器械列表

${finalInstruments.length > 0 ? '```json\n' + JSON.stringify(finalInstruments, null, 2) + '\n```' : (cancelled ? '**用户取消了所有器械**' : '(无器械)')}

${filteredOut && filteredOut.length > 0 ? `### 字典过滤掉的器械\n\n${filteredOut.join('、')}` : ''}
`;
  appendLog(content);
}

/** 列出所有日志文件 */
export function listLogFiles() {
  const { logDir } = loadLogSettings();
  if (!fs.existsSync(logDir)) return [];
  return fs.readdirSync(logDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .map(f => ({ name: f, size: fs.statSync(path.join(logDir, f)).size }));
}

/** 读取某个日志文件内容 */
export function readLogFile(filename) {
  const { logDir } = loadLogSettings();
  const filePath = path.join(logDir, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

export default {
  logTranscription,
  logExtraction,
  logDictionaryFilter,
  logTestConnection,
  logVoiceSession,
  listLogFiles,
  readLogFile
};
