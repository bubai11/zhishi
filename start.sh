#!/bin/bash
# 植物科普系统 - 一键启动脚本（Unix/Linux/Mac）
# 同时启动后端和前端

echo ""
echo "========================================"
echo "植物科普学习与知识可视化系统"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误：未找到 Node.js，请先安装：https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js 已安装"
echo ""

# 获取项目目录
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 启动后端
echo "启动后端服务器..."
cd "$PROJECT_DIR/backend"

if [ ! -d "node_modules" ]; then
    echo "正在安装后端依赖..."
    npm install
fi

npm run dev &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端
echo ""
echo "启动前端开发服务器..."
cd "$PROJECT_DIR/frontend-aistudio"

if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "启动完成！"
echo "========================================"
echo ""
echo "后端：http://localhost:3001"
echo "前端：http://localhost:3000"
echo ""
echo "请在浏览器中打开：http://localhost:3000"
echo ""
echo "停止服务："
echo "  kill $BACKEND_PID   # 停止后端"
echo "  kill $FRONTEND_PID  # 停止前端"
echo ""
echo "或按 Ctrl+C 停止"
echo "========================================"
echo ""

wait
