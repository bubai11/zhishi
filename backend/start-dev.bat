@echo off
REM 植物科普系统 - 后端启动脚本（Windows）

echo.
echo ========================================
echo 植物科普学习与知识可视化系统 - 后端
echo ========================================
echo.

REM 检查 Node.js 是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查 npm 是否安装
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：未找到 npm，请先安装 npm
    pause
    exit /b 1
)

REM 检查依赖是否已安装
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo 错误：依赖安装失败
        pause
        exit /b 1
    )
)

echo.
echo 检查数据库配置...
if not exist ".env" (
    echo 警告：未找到 .env 文件，使用默认配置
    echo.
    echo 【重要】请检查 config/config.js 中的数据库配置：
    echo   - username: MySQL 用户名（默认 root）
    echo   - password: MySQL 密码
    echo   - database: 数据库名称（默认 plant_knowledge）
    echo   - host: MySQL 主机（默认 127.0.0.1）
    echo.
    pause
)

echo.
echo ✓ 环境检查完成
echo.
echo 启动服务器...
echo 服务器地址：http://localhost:3001
echo 按 Ctrl+C 停止服务
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo 错误：服务启动失败，请检查日志信息
    pause
    exit /b 1
)
