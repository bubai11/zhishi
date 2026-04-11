@echo off
REM 植物科普系统 - 一键启动脚本（Windows）
REM 同时启动后端和前端

echo.
echo ========================================
echo 植物科普学习与知识可视化系统
echo ========================================
echo.

REM 检查 Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误：未找到 Node.js，请先安装：https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js 已安装
echo.

REM 启动后端
echo 启动后端服务器...
cd backend
if not exist "node_modules" (
    echo 正在安装后端依赖...
    call npm install
)
start cmd /k "npm run dev"
cd ..

REM 等待后端启动
echo 等待后端启动...
timeout /t 3 /nobreak

REM 启动前端
echo.
echo 启动前端开发服务器...
cd frontend-aistudio
if not exist "node_modules" (
    echo 正在安装前端依赖...
    call npm install
)
start cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo 启动完成！
echo ========================================
echo.
echo 后端：http://localhost:3001
echo 前端：http://localhost:3000
echo.
echo 请在浏览器中打开：http://localhost:3000
echo.
echo 关闭此窗口不会影响服务运行
echo ========================================
echo.

pause
