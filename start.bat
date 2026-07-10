@echo off
chcp 65001 >nul
echo.
echo =========================================
echo   口腔门诊消毒标签打印系统 - Docker 启动
echo =========================================
echo.

REM Check Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop！
    pause
    exit /b 1
)

echo [1/2] 构建镜像...
docker compose build

echo.
echo [2/2] 启动服务...
docker compose up -d

echo.
echo =========================================
echo   启动成功！
echo   访问地址: http://localhost:3000
echo   管理页面: http://localhost:3000/manage
echo   管理密码: 123456
echo =========================================
echo.
echo 停止服务: docker compose down
echo 查看日志: docker compose logs -f
echo.
pause
