@echo off
chcp 65001 >nul
echo ========================================
echo   消毒标签打印 Agent (Windows)
echo ========================================

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未检测到 Node.js，请先安装: https://nodejs.org/
    pause
    exit /b 1
)

REM 安装依赖
if not exist "node_modules" (
    echo [INFO] 正在安装依赖...
    call npm install --production
)

echo [INFO] 启动 Agent...
echo   服务器: http://localhost:3000
echo   模式: 真实打印
echo ========================================

set SERVER_URL=http://localhost:3000
set IS_MOCK=false
node index.js

pause
