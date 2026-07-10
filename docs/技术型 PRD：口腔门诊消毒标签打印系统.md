## 🤖 Assistant

这是一份专门为您使用 **Qoder（或类似 AI 辅助编程工具）** 进行开发而深度优化的**技术型 PRD（产品需求文档）**。

为了让 AI 编码工具能更精准地生成代码，这份 PRD 削弱了业务废话，**强化了技术栈定义、数据模型（表结构）、API 接口契约以及前后端交互逻辑**。您可以直接将本文档作为 Context（上下文）喂给 Qoder。

---

# 📄 技术型 PRD：口腔门诊消毒标签打印系统

## 一、 技术栈定义与项目初始化
*请 Qoder 基于以下技术栈进行项目脚手架搭建和代码生成：*

*   **前端 (Web UI)**：`Vue 3` (Composition API) + `Vite` + `Tailwind CSS` (移动端优先) + `Pinia` (状态管理) + `Vue Router`。
*   **后端 (Docker 内 Web 服务)**：`Node.js` + `Express` (或 `NestJS`) + `Prisma` (ORM) + `SQLite` (轻量级本地数据库，无需额外部署数据库容器)。
*   **本地打印 Agent (Windows 宿主机)**：独立 `Node.js` 脚本 + `Socket.io-client` + `pdf-to-printer` (或 `node-printer`)。
*   **实时通信**：`Socket.io` (用于 Web 端与本地 Agent 的 WebSocket 通信及状态同步)。
*   **二维码生成**：前端使用 `qrcode.vue` 或后端使用 `qrcode` 库生成 Base64。

---

## 二、 系统架构与部署拓扑
系统分为两个物理隔离但逻辑互通的部分：

1.  **Web 服务端 (运行在 Docker 容器内)**
    *   包含前端静态资源与后端 API。
    *   通过 Docker 暴露 HTTP (如 8080) 和 WebSocket (如 8081) 端口。
    *   负责业务逻辑、数据持久化、标签排版渲染（生成 PDF 或图片）。
2.  **本地打印 Agent (运行在 Windows 宿主机)**
    *   开机自启的后台 Node.js 进程。
    *   通过 WebSocket 连接到 Docker 内的 Web 服务端。
    *   接收渲染好的打印文件（PDF），调用 Windows 本地打印驱动发送给物理标签打印机。
    *   **Mac 开发 Mock 模式**：通过环境变量 `IS_MOCK=true` 开启，收到打印任务时不调用真实打印机，而是使用 `open` 命令在 Mac 上预览生成的 PDF。

---

## 三、 数据库设计 (Prisma Schema 参考)
*请 Qoder 基于以下数据模型生成 ORM 代码：*

```prisma
// 1. 数据字典表 (器械、人员、炉号等)
model Dictionary {
  id        Int      @id @default(autoincrement())
  type      String   // 枚举: 'INSTRUMENT'(器械), 'STERILIZER'(消毒人员), 'CHECKER'(核对人员), 'FURNACE'(炉次/炉号)
  name      String   // 显示名称
  pinyin    String?  // 拼音首字母(用于前端模糊搜索)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  
  @@unique([type, name])
}

// 2. 打印任务主表 (用于历史记录和统计)
model PrintTask {
  id             Int      @id @default(autoincrement())
  sterilizerName String   // 消毒人员姓名
  checkerName    String   // 核对人员姓名
  furnaceNo      String?  // 炉次/炉号
  sterilizeTime  DateTime // 消毒时间
  expireTime     DateTime // 失效时间
  totalQuantity  Int      // 总打印份数
  createdAt      DateTime @default(now())
  
  items          PrintItem[]
}

// 3. 打印任务详情表 (关联具体器械)
model PrintItem {
  id             Int      @id @default(autoincrement())
  taskId         Int
  instrumentName String   // 器械名称 (允许手动输入，不强制关联字典)
  quantity       Int      // 打印数量
  
  task           PrintTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
}
```

---

## 四、 API 接口契约 (RESTful)
*请 Qoder 实现以下后端路由及 Controller：*

| 模块 | 方法 | 路由 | 描述 | 核心参数/返回 |
| :--- | :--- | :--- | :--- | :--- |
| **字典** | GET | `/api/dict/:type` | 获取指定类型的字典列表 | 返回 `[{id, name, pinyin}]` |
| **字典** | POST | `/api/dict` | 新增字典项(管理员用) | Body: `{type, name}` |
| **打印** | POST | `/api/print/submit` | 提交打印任务并触发打印 | Body: 包含人员、时间、器械列表。返回 `taskId` |
| **历史** | GET | `/api/print/history` | 获取今日打印历史(用于补打) | Query: `?date=YYYY-MM-DD` |
| **补打** | POST | `/api/print/reprint/:id`| 一键补打历史任务 | 重新生成文件并下发Agent |
| **统计** | GET | `/api/stats/overview` | 获取综合统计数据 | 返回器械次数、人员工作量、炉号频率 |

---

## 五、 核心前端页面与业务逻辑 (UI/UX)
*前端采用 Mobile First (移动端优先) 设计，底部 Tab 导航分为：[打印]、[历史]、[统计]、[设置]。*

### 5.1 打印页 (核心工作台)
*   **表单布局**：
    *   **必填项 (带红星)**：消毒人员、核对人员、消毒时间、失效时间。
    *   **选填项**：炉次/炉号（默认记忆上一次选择的值，存入 `localStorage`）。
*   **时间选择器优化**：
    *   失效时间提供快捷按钮：`[+7天]`、`[+14天]`、`[+180天]`、`[+3个月]`。点击自动计算并填入。
*   **器械选择器 (核心交互)**：
    *   提供搜索框，支持输入中文或拼音首字母实时过滤字典。
    *   若搜索无结果，显示“手动输入”按钮，点击后出现文本框允许自定义输入。
    *   选中器械后加入“待打印列表”，每个器械右侧显示数量控制器 (`- 1 +`)。
*   **执行打印**：
    *   点击“开始打印”，前端校验必填项。
    *   生成包含所有标签排版的 PDF（每个标签包含：器械名、消毒/失效时间、人员、炉号、**追溯二维码**）。
    *   通过 WebSocket 发送给 Agent，页面显示“打印中”遮罩，收到 Agent 成功回执后提示“打印成功”。

### 5.2 历史与补打页
*   列表展示 `PrintTask` 记录，按时间倒序。
*   每条记录显示：时间、人员、包含的器械摘要。
*   右侧提供 **[补打]** 按钮，点击直接调用 `/api/print/reprint/:id`。

### 5.3 统计页
*   使用 `ECharts` 或 `Chart.js` 渲染图表。
*   **Tab 1 器械统计**：柱状图展示各器械消毒次数 Top 10。
*   **Tab 2 人员统计**：饼图/列表展示各消毒/核对人员的工作量占比。
*   **Tab 3 导出**：提供“导出 Excel”按钮（后端使用 `exceljs` 生成文件流）。

---

## 六、 本地打印 Agent 逻辑 (Windows 端)
*这是一个独立的 Node.js 项目，不在 Docker 内。请 Qoder 生成独立的 `agent/` 目录代码。*

1.  **连接管理**：启动时通过 `socket.io-client` 连接 Web 服务端的 WebSocket。支持断线自动重连。
2.  **状态上报**：连接成功后，获取 Windows 默认打印机名称及状态，上报给 Web 服务端。
3.  **接收打印指令**：
    *   监听 `print_task` 事件。
    *   接收 Base64 格式的 PDF 数据或文件 URL。
    *   将数据保存为本地临时 `.pdf` 文件。
4.  **调用打印**：
    *   使用 `pdf-to-printer` 库，调用 `print(pdfPath, { printer: printerName })`。
    *   打印完成后，删除临时文件，并向 Web 服务端发送 `print_success` 事件。
5.  **Mock 模式 (Mac 开发用)**：
    *   读取环境变量 `process.env.IS_MOCK`。
    *   若为 `true`，则不调用 `print` 方法，而是使用 `child_process.exec('open ' + pdfPath)` (Mac) 打开预览。

---

## 七、 💡 给 Qoder 的开发 Prompt 建议 (使用指南)

在您使用 Qoder 开发时，建议分步骤输入以下 Prompt，以保证代码质量：

**Prompt 1 (初始化与数据库):**
> "请根据 PRD 第一部分和第三部分，初始化一个 Node.js + Express + Prisma + SQLite 的后端项目，并生成 Prisma schema 和基础的 CRUD 路由。"

**Prompt 2 (前端脚手架与UI):**
> "请初始化一个 Vue3 + Vite + TailwindCSS 的前端项目。配置移动端优先的响应式布局，实现底部 Tab 导航，并根据 PRD 5.1 节完成『打印页』的表单 UI 和状态管理（Pinia）。"

**Prompt 3 (核心业务逻辑):**
> "请实现前端的『器械选择器』组件，要求支持拼音首字母搜索和手动输入。并实现『失效时间』的快捷计算按钮逻辑。最后对接后端的 `/api/print/submit` 接口。"

**Prompt 4 (本地 Agent 开发):**
> "请在项目根目录创建一个 `agent` 文件夹，编写一个独立的 Node.js 脚本。使用 socket.io-client 连接后端，使用 pdf-to-printer 实现接收 Base64 PDF 并调用本地打印机打印的功能。必须包含 `IS_MOCK` 环境变量判断，在 Mac 下使用 `open` 命令预览 PDF。"

**Prompt 5 (WebSocket 与状态同步):**
> "请在后端集成 Socket.io，实现与前端和 Agent 的实时通信。当前端提交打印任务时，通过 Socket 转发给 Agent；当 Agent 打印完成或检测到打印机离线时，通过 Socket 通知前端更新 UI 状态。"
