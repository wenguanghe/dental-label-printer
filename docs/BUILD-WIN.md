# Windows EXE 打包指南

## 环境要求

- **Node.js 20+**: https://nodejs.org/
- **Git**: https://git-scm.com/

## 打包步骤

### 1. 克隆项目

```powershell
git clone https://github.com/wenguanghe/Qoder-Agent-IDE-Printing-System.git
cd Qoder-Agent-IDE-Printing-System
```

### 2. 安装依赖

```powershell
npm install
```

### 3. 构建 Windows 安装包

```powershell
npm run build:win
```

构建完成后，安装包在 `dist-electron/` 目录下，文件名为 `口腔门诊消毒标签打印系统 Setup x.x.x.exe`。

### 4. 安装使用

双击生成的 `.exe` 安装包，按提示安装。安装完成后：
- 桌面出现「消毒标签打印系统」快捷方式
- 双击启动，自动运行服务端 + 打印 Agent + 打开界面
- 系统托盘有图标，右键可操作

## 开发模式测试

```powershell
npm run electron:dev
```

## 注意事项

- 打包必须在 **Windows** 系统上执行（不支持交叉编译）
- 首次 `npm install` 会下载 Electron 运行时（约 200MB）
- 生成的安装包约 200-300MB（包含 Node.js 运行时）
- 如需自定义图标，替换 `electron/icon.ico`（256x256 像素）
