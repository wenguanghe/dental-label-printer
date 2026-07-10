# 口腔门诊消毒标签打印系统

面向口腔门诊的消毒器械标签打印系统。支持表单录入与 AI 语音输入，自动生成 PDF 消毒标签，通过 Socket.io 下发到本地打印机。

## 功能

- 消毒标签打印（含二维码 PDF）
- AI 语音输入（多模态 STT → 文本模型语义提取）
- 口语理解（自我纠正、取消、全局否定）
- 器械字典匹配过滤
- 字典 CSV 导入/导出
- 历史补打 + 数据统计 + Excel 导出
- AI 模型全链路 Markdown 日志

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Tailwind CSS + Pinia |
| 后端 | Express + Socket.io + Prisma + SQLite |
| 打印 | PDFKit + QRCode |
| 桌面 | Electron（可选） |

## 项目结构

```
├── frontend/         Vue 3 前端
│   └── src/
│       ├── components/   InstrumentSelector, PrinterStatus, QuantityControl, TimePicker
│       ├── views/        PrintView, ManageView, HistoryView, StatsView, SettingsView
│       ├── stores/       Pinia 状态管理
│       └── router/       Vue Router
├── server/           Express 后端
│   ├── src/routes/       dict, print, history, stats, voice, aiSettings
│   ├── src/services/     labelPdf, aiLogger
│   ├── prisma/           Schema + SQLite + 迁移
│   └── fonts/            NotoSansSC 中文字体
├── agent/            本地打印 Agent（Socket.io Client）
├── electron/         Electron 桌面打包（可选）
├── docs/             PRD 文档 + 构建指南
├── docker-compose.yml
└── start.bat / stop.bat
```

## 部署方式

### 方式一：Docker（推荐）

适用于服务器部署，需安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。

```bash
docker compose up -d --build
```

访问 http://localhost:3000

### 方式二：Windows 一键启动

适用于 Win11 本地使用，需安装 Docker Desktop。

双击 `start.bat` 启动，`stop.bat` 停止。

### 方式三：Windows EXE 安装包

适用于无需 Docker 的纯 Windows 环境。需在 Windows 上构建，详见 [docs/BUILD-WIN.md](docs/BUILD-WIN.md)。

```powershell
npm install
npm run build:win
```

生成的安装包在 `dist-electron/` 目录。

### 方式四：本地开发

```bash
# 终端1: 后端
cd server && npm install && npx prisma migrate deploy && npm run seed && npm run dev

# 终端2: 前端
cd frontend && npm install && npm run dev

# 终端3: 打印Agent（可选）
cd agent && npm install && npm run start
```

前端 http://localhost:5174 | 后端 http://localhost:3000

## AI 语音输入

```
语音 → [语音识别模型] → 转写文本 → [语义提取模型] → 器械列表
       (多模态模型)                (文本模型)
```

在管理页面 → 系统设置中分别配置两个模型（支持不同服务商）：

| 模型 | 用途 | 推荐 |
|------|------|------|
| 语音识别模型 | 语音转文字 | qwen3-omni-flash、gpt-4o |
| 语义提取模型 | 语义理解提取器械 | qwen-plus、qwen-max、gpt-4o |

> 语音识别需要 ffmpeg（`brew install ffmpeg` / `choco install ffmpeg`）

## 管理页面

访问 `/manage`（默认密码：`123456`）

- **历史补打** — 按日期查询并补打
- **数据统计** — 工作量统计、图表、Excel 导出
- **系统设置** — AI 模型配置、日志设置、字典管理

## API 接口

<details>
<summary>展开查看完整 API 列表</summary>

| 路径 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/dict/:type` | 获取字典 |
| `POST /api/dict` | 新增字典项 |
| `DELETE /api/dict/:id` | 删除字典项 |
| `POST /api/dict/batch` | 批量导入 |
| `GET /api/dict/:type/export` | CSV 导出 |
| `POST /api/print/submit` | 提交打印任务 |
| `GET /api/print/history` | 打印历史 |
| `POST /api/print/reprint/:id` | 补打 |
| `GET /api/stats/overview` | 统计概览 |
| `GET /api/stats/export` | 导出 Excel |
| `POST /api/voice/transcribe` | 语音识别 |
| `GET /api/ai-settings` | 获取 AI 设置 |
| `POST /api/ai-settings` | 保存 AI 设置 |
| `POST /api/ai-settings/test` | 测试模型连接 |
| `GET /api/ai-settings/logs` | 日志文件列表 |
| `GET /api/ai-settings/logs/:filename` | 读取日志 |

</details>

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 后端端口 |
| `DATABASE_URL` | `file:./dev.db` | SQLite 路径 |

## 文档

- [技术型 PRD](docs/技术型%20PRD：口腔门诊消毒标签打印系统.md)
- [最终版 PRD](docs/最终版%20PRD：口腔门诊器械消毒标签打印系统.md)
- [Windows EXE 打包指南](docs/BUILD-WIN.md)

## 许可证

MIT
