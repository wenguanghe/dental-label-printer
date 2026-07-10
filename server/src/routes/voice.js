import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { prisma } from '../index.js';
import { logTranscription, logExtraction, logDictionaryFilter, logVoiceSession } from '../services/aiLogger.js';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'ai-settings.json');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = express.Router();

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return { stt: {}, ext: {} };
}

function getConfig(settings, key) {
  const cfg = settings[key] || {};
  return {
    apiKey: cfg.apiKey,
    apiBase: (cfg.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: cfg.model
  };
}

// 将 webm 音频转换为 wav（通过 ffmpeg 临时文件）
async function convertToWav(audioBuffer) {
  const tmpInput = path.join(os.tmpdir(), `voice_input_${Date.now()}.webm`);
  const tmpOutput = path.join(os.tmpdir(), `voice_output_${Date.now()}.wav`);
  try {
    fs.writeFileSync(tmpInput, audioBuffer);
    await execFileAsync('ffmpeg', ['-y', '-i', tmpInput, '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', '-f', 'wav', tmpOutput]);
    return fs.readFileSync(tmpOutput);
  } finally {
    try { fs.unlinkSync(tmpInput); } catch (e) {}
    try { fs.unlinkSync(tmpOutput); } catch (e) {}
  }
}

let ffmpegAvailable = null;
async function checkFfmpeg() {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  try { await execFileAsync('ffmpeg', ['-version']); ffmpegAvailable = true; } catch (e) { ffmpegAvailable = false; }
  return ffmpegAvailable;
}

// 读取流式 SSE 响应
async function readStreamResponse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let usage = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta;
        if (delta?.content) fullContent += delta.content;
        if (json.usage) usage = json.usage;
      } catch (e) { /* ignore */ }
    }
  }
  return { content: fullContent, usage };
}

// 调用 chat completions API（流式），带计时
async function callChat(apiBase, apiKey, model, messages, maxTokens = 500) {
  const body = {
    model, messages,
    temperature: 0,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    modalities: ['text']
  };
  const t0 = Date.now();
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`API ${response.status}: ${errText.slice(0, 300)}`);
    err.durationMs = Date.now() - t0;
    err.responseBody = errText;
    throw err;
  }
  const result = await readStreamResponse(response);
  result.durationMs = Date.now() - t0;
  result.requestBody = body;
  return result;
}

// ========== Step 1: 语音转文字（多模态模型） ==========
async function transcribeAudio(apiBase, apiKey, sttModel, audioBuffer, audioFormat) {
  const audioBase64 = audioBuffer.toString('base64');
  const audioDataUri = `data:audio/${audioFormat};base64,${audioBase64}`;
  const promptText = '请仔细听这段语音，将用户说的内容完整转写为文字。只返回转写的文字内容，不要添加任何解释、标注或额外信息。';

  console.log(`[Voice][Step1] Transcribing with model=${sttModel}, format=${audioFormat}, size=${(audioBuffer.length/1024).toFixed(1)}KB`);

  const t0 = Date.now();
  let result;
  try {
    result = await callChat(apiBase, apiKey, sttModel, [
      {
        role: 'user',
        content: [
          { type: 'input_audio', input_audio: { data: audioDataUri, format: audioFormat } },
          { type: 'text', text: promptText }
        ]
      }
    ], 500);

    logTranscription({
      model: sttModel, apiBase, apiKey, audioFormat,
      audioSize: `${(audioBuffer.length / 1024).toFixed(1)}KB`,
      prompt: promptText,
      response: result.content, usage: result.usage,
      durationMs: result.durationMs
    });
  } catch (e) {
    logTranscription({
      model: sttModel, apiBase, apiKey, audioFormat,
      audioSize: `${(audioBuffer.length / 1024).toFixed(1)}KB`,
      prompt: promptText,
      response: null, error: e.message,
      durationMs: e.durationMs || Date.now() - t0
    });
    throw e;
  }

  console.log(`[Voice][Step1] Transcript: "${result.content}"`);
  return result.content.trim();
}

// ========== Step 2: 语义提取器械信息（文本模型） ==========
async function extractInstruments(apiBase, apiKey, extractModel, transcript) {
  console.log(`[Voice][Step2] Extracting instruments with model=${extractModel}`);

  const systemContent = `你是一个口腔门诊器械管理的语义解析引擎。你的唯一任务是：从用户语音转写文本中提取最终确认需要的器械，并以严格 JSON 格式输出。

绝对规则：
1. 只返回 JSON，不允许有任何其他文字、解释、说明
2. JSON 格式固定为：{"instruments": [{"name": "器械名称", "quantity": 数量}]}
3. 如果用户最终取消了所有器械，返回 {"instruments": []}`;

  const userContent = `请分析以下语音转写文本，理解用户真实意图，提取最终确认需要的器械。

核心语义规则：

【数量纠正】
用户说"不对""不是""改成""还是""不"等纠正词时，以纠正后的值为准。
- "冲牙器两个，不对，六个" → 冲牙器×6
- "探针3个，嗯还是两个吧" → 探针×2

【单个取消】
"不要了""算了""取消""去掉""没有了"跟在某个器械后面，该器械被取消。
- "冲牙器3个，算了不要了" → 冲牙器被取消

【全局取消】最重要！
"全部都不要了""都不要了""全算了""一个都不要""取消全部""都不要了算了"等全局否定词，表示取消之前提到的所有器械，返回空数组。
- "冲牙器六个，洗牙器三个，呃全部都不要了" → {"instruments": []}
- "算了算了，都不要了" → {"instruments": []}
- "一个都不要了" → {"instruments": []}

【填充词忽略】
"呃""嗯""那个""这个""就是"等直接忽略。

【最终确认原则】
同一器械多次提及，以最终确认的为准。最终以用户最后表达的意图为准。

示例：

输入："拔牙挺有两个，呃，不对，还有一个。冲牙器有3个，算了一个都不要了"
输出：{"instruments": [{"name": "拔牙挺", "quantity": 1}]}

输入："加两把止血钳和一个口镜"
输出：{"instruments": [{"name": "止血钳", "quantity": 2}, {"name": "口镜", "quantity": 1}]}

输入："冲牙器两个，不对，六个。洗牙器三个。呃，洗牙器少一个。算了，全部都不要了"
输出：{"instruments": []}

输入："止血钳三个，探针两把，嗯探针还是三把吧"
输出：{"instruments": [{"name": "止血钳", "quantity": 3}, {"name": "探针", "quantity": 3}]}

输入："牙廷一个，冲牙器四个，算了冲牙器不要了"
输出：{"instruments": [{"name": "牙廷", "quantity": 1}]}

现在请解析以下文本（只返回 JSON）：

${transcript}`;

  const t0 = Date.now();
  let result;
  try {
    result = await callChat(apiBase, apiKey, extractModel, [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ], 300);

    logExtraction({
      step: 'main', model: extractModel, apiBase, apiKey,
      systemPrompt: systemContent, userPrompt: userContent,
      response: result.content, usage: result.usage,
      durationMs: result.durationMs
    });
  } catch (e) {
    logExtraction({
      step: 'main', model: extractModel, apiBase, apiKey,
      systemPrompt: systemContent, userPrompt: userContent,
      response: null, error: e.message,
      durationMs: e.durationMs || Date.now() - t0
    });
    throw e;
  }

  console.log(`[Voice][Step2] Raw response: "${result.content}"`);

  // 解析 JSON（从可能的混合内容中提取）
  let jsonStr = result.content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  const jsonStart = jsonStr.indexOf('{');
  const jsonEnd = jsonStr.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
  }

  const parsed = JSON.parse(jsonStr);
  return (parsed.instruments || []).filter(i => i.name && typeof i.name === 'string');
}

// POST /api/voice/transcribe
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未收到音频文件' });
    }

    const settings = loadSettings();
    const stt = getConfig(settings, 'stt');
    const ext = getConfig(settings, 'ext');

    // 语义提取模型回退到语音识别模型
    const extCfg = ext.model ? ext : { ...stt };

    if (!stt.apiKey) {
      return res.status(400).json({ error: '请先在系统设置中配置语音识别模型的 API Key' });
    }
    if (!stt.model) {
      return res.status(400).json({ error: '请先在系统设置中配置语音识别模型' });
    }

    const mimeType = req.file.mimetype || 'audio/webm';
    console.log(`[Voice] Audio: ${(req.file.size / 1024).toFixed(1)}KB, type=${mimeType}`);

    // 音频格式转换
    let audioBuffer = req.file.buffer;
    let audioFormat = getAudioFormat(mimeType);
    if (audioFormat === 'webm' && await checkFfmpeg()) {
      try {
        console.log('[Voice] Converting webm → wav...');
        audioBuffer = await convertToWav(req.file.buffer);
        audioFormat = 'wav';
        console.log(`[Voice] Converted: ${(audioBuffer.length / 1024).toFixed(1)}KB wav`);
      } catch (e) {
        console.error('[Voice] Conversion failed:', e.message);
      }
    }

    // ========== Step 1: 语音转文字 ==========
    let transcript = '';
    try {
      transcript = await transcribeAudio(stt.apiBase, stt.apiKey, stt.model, audioBuffer, audioFormat);
    } catch (e) {
      console.error('[Voice][Step1] Error:', e.message);
      return res.status(502).json({ error: `语音转写失败: ${e.message}` });
    }

    if (!transcript) {
      return res.json({ text: '', instruments: [] });
    }

    // ========== Step 2: 语义提取器械 ==========
    let instruments = [];
    let extractOk = false;
    try {
      instruments = await extractInstruments(extCfg.apiBase, extCfg.apiKey, extCfg.model, transcript);
      extractOk = true;
    } catch (e) {
      console.error('[Voice][Step2] JSON parse failed, raw response:', e.message);
      // 二次尝试：用更简单的提示再提取一次
      try {
        instruments = await retryExtractInstruments(extCfg.apiBase, extCfg.apiKey, extCfg.model, transcript);
        extractOk = true;
      } catch (e2) {
        console.error('[Voice][Step2] Retry also failed:', e2.message);
      }
    }

    // ========== Step 3: 器械名称匹配过滤 ==========
    let filteredOut = [];
    if (instruments.length > 0) {
      try {
        const result = await filterInstrumentsByDictionary(instruments);
        filteredOut = result.filteredOut;
        instruments = result.kept;
        logDictionaryFilter({ before: result.kept.concat(result.filteredOut.map(n => ({ name: n, quantity: '?' }))), kept: result.kept, filteredOut: result.filteredOut });
      } catch (e) {
        console.error('[Voice][Step3] Dictionary filter error:', e.message);
      }
    }

    // 构建响应
    const response = { text: transcript, instruments };
    if (filteredOut.length > 0) response.filteredOut = filteredOut;
    if (extractOk && instruments.length === 0 && filteredOut.length === 0) response.cancelled = true;

    // 记录会话结果
    logVoiceSession({ transcript, finalInstruments: instruments, filteredOut, cancelled: response.cancelled });

    console.log(`[Voice] Final: instruments=${JSON.stringify(instruments)}, filteredOut=${JSON.stringify(filteredOut)}, cancelled=${response.cancelled}`);
    res.json(response);
  } catch (e) {
    console.error('[Voice] Error:', e);
    res.status(500).json({ error: '语音识别处理失败: ' + e.message });
  }
});

function getAudioFormat(mimeType) {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('webm')) return 'webm';
  return 'wav';
}

// ========== Step 2 retry: 简化提示再次提取 ==========
async function retryExtractInstruments(apiBase, apiKey, model, transcript) {
  console.log('[Voice][Step2] Retrying with simplified prompt...');
  const systemContent = '你是一个 JSON 输出工具。只返回 JSON，不要有任何其他文字。';
  const userContent = `从以下文本中提取口腔器械名称和数量，返回 {"instruments": [{"name": "器械名", "quantity": 数量}]}。\n如果用户取消了所有器械，返回 {"instruments": []}。\n只返回 JSON。\n\n文本: ${transcript}`;

  const t0 = Date.now();
  let result;
  try {
    result = await callChat(apiBase, apiKey, model, [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ], 200);

    logExtraction({
      step: 'retry', model, apiBase, apiKey,
      systemPrompt: systemContent, userPrompt: userContent,
      response: result.content, usage: result.usage,
      durationMs: result.durationMs
    });
  } catch (e) {
    logExtraction({
      step: 'retry', model, apiBase, apiKey,
      systemPrompt: systemContent, userPrompt: userContent,
      response: null, error: e.message,
      durationMs: e.durationMs || Date.now() - t0
    });
    throw e;
  }

  let jsonStr = result.content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  // 尝试提取 JSON 部分
  const jsonStart = jsonStr.indexOf('{');
  const jsonEnd = jsonStr.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
  }

  const parsed = JSON.parse(jsonStr);
  return (parsed.instruments || []).filter(i => i.name && typeof i.name === 'string');
}

// ========== Step 3: 器械名称匹配字典过滤 ==========
async function filterInstrumentsByDictionary(instruments) {
  const dictItems = await prisma.dictionary.findMany({
    where: { type: 'INSTRUMENT', isActive: true },
    select: { name: true }
  });
  const validNames = dictItems.map(d => d.name);
  console.log(`[Voice][Step3] Dictionary instruments: ${validNames.join(', ')}`);

  const kept = [];
  const filteredOut = [];
  for (const inst of instruments) {
    // 精确匹配
    if (validNames.includes(inst.name)) {
      kept.push(inst);
      continue;
    }
    // 模糊匹配
    const match = validNames.find(
      vn => vn.includes(inst.name) || inst.name.includes(vn)
    );
    if (match) {
      console.log(`[Voice][Step3] Fuzzy match: "${inst.name}" → "${match}"`);
      kept.push({ name: match, quantity: inst.quantity });
    } else {
      console.log(`[Voice][Step3] Discarded: "${inst.name}" (not in dictionary)`);
      filteredOut.push(inst.name);
    }
  }

  return { kept, filteredOut };
}

export default router;
