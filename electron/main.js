const { app, BrowserWindow, Tray, Menu, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let serverProcess = null;
let agentProcess = null;

const PORT = 3000;
const SERVER_URL = `http://localhost:${PORT}`;

// 获取资源路径（兼容开发模式和打包模式）
function getResourcePath(relativePath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, '..', relativePath);
}

// 启动 Express 服务器
function startServer() {
  const serverDir = getResourcePath('server');
  const nodeExe = process.execPath;

  console.log('[Electron] Starting server from:', serverDir);

  serverProcess = spawn(nodeExe, ['src/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      DATABASE_URL: `file:${path.join(serverDir, 'data', 'prod.db')}`
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`[Server] Exited with code ${code}`);
  });
}

// 启动打印 Agent
function startAgent() {
  const agentDir = getResourcePath('agent');
  const nodeExe = process.execPath;

  console.log('[Electron] Starting agent from:', agentDir);

  agentProcess = spawn(nodeExe, ['index.js'], {
    cwd: agentDir,
    env: {
      ...process.env,
      SERVER_URL: SERVER_URL,
      IS_MOCK: 'false'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  agentProcess.stdout.on('data', (data) => {
    console.log(`[Agent] ${data.toString().trim()}`);
  });

  agentProcess.stderr.on('data', (data) => {
    console.error(`[Agent] ${data.toString().trim()}`);
  });
}

// 等待服务器就绪
function waitForServer(maxWait = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const http = require('http');
      http.get(`${SERVER_URL}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (Date.now() - start < maxWait) {
          setTimeout(check, 500);
        } else {
          reject(new Error('Server start timeout'));
        }
      }).on('error', () => {
        if (Date.now() - start < maxWait) {
          setTimeout(check, 500);
        } else {
          reject(new Error('Server start timeout'));
        }
      });
    };
    check();
  });
}

// 创建系统托盘
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(iconPath)) {
    tray = new Tray(iconPath);
  } else {
    // 如果没有图标，跳过托盘
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开应用',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '在浏览器中打开',
      click: () => {
        shell.openExternal(SERVER_URL);
      }
    },
    { type: 'separator' },
    {
      label: '重启服务',
      click: () => {
        stopAll();
        startServer();
        startAgent();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        stopAll();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('口腔门诊消毒标签打印系统');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    title: '口腔门诊消毒标签打印系统',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// 停止所有子进程
function stopAll() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  if (agentProcess) {
    agentProcess.kill('SIGTERM');
    agentProcess = null;
  }
}

// App 生命周期
app.whenReady().then(async () => {
  // 确保数据目录存在
  const dataDir = path.join(getResourcePath('server'), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 运行数据库迁移和种子数据
  const serverDir = getResourcePath('server');
  const { execSync } = require('child_process');
  try {
    console.log('[Electron] Running database migration...');
    execSync('npx prisma db push --accept-data-loss', {
      cwd: serverDir,
      env: { ...process.env, DATABASE_URL: `file:${path.join(dataDir, 'prod.db')}` },
      stdio: 'pipe'
    });
    console.log('[Electron] Running seed check...');
    execSync(`${process.execPath} src/seed-check.js`, {
      cwd: serverDir,
      env: { ...process.env, DATABASE_URL: `file:${path.join(dataDir, 'prod.db')}` },
      stdio: 'pipe'
    });
  } catch (e) {
    console.error('[Electron] DB init error:', e.message);
  }

  // 启动服务
  startServer();
  startAgent();

  // 等待服务器就绪
  try {
    await waitForServer();
    console.log('[Electron] Server is ready');
  } catch (e) {
    dialog.showErrorBox('启动失败', '服务器启动超时，请检查日志。');
    app.quit();
    return;
  }

  // 创建窗口和托盘
  createTray();
  createWindow();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopAll();
});

app.on('window-all-closed', () => {
  // Windows 下不退出，依赖托盘
});
