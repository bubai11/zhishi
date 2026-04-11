# 🚀 快速启动指南

> 5分钟快速启动植物科普系统

## 前提条件

✅ **必需**：
- Node.js 14.0+ ([下载](https://nodejs.org/))
- MySQL 8.0+ ([下载](https://www.mysql.com/downloads/))
- Git

✅ **已安装情况检查**：
```bash
node --version    # 应显示 v14.0.0 或更高
npm --version     # 应显示 6.0.0 或更高
mysql --version   # 应显示 8.0.0 或更高
```

## 一键启动（推荐）

### Windows 用户

**方式 1：双击启动**
```
zhishi-plant-system/start.bat
```

**方式 2：在项目根目录打开 PowerShell/CMD，运行**
```bash
.\start.bat
```

### Mac / Linux 用户

```bash
cd zhishi-plant-system
chmod +x start.sh
./start.sh
```

或直接运行：
```bash
bash start.sh
```

## 分别启动（手动方式）

如果一键启动脚本出现问题，可手动启动：

### 启动后端

**Windows**:
```bash
cd backend
start-dev.bat
```

**Mac/Linux**:
```bash
cd backend
bash start-dev.sh
```

或通用方式：
```bash
cd backend
npm install
npm run dev
```

### 启动前端（新终端/CMD）

**Windows**:
```bash
cd frontend-aistudio
npm install
npm run dev
```

**Mac/Linux**:
```bash
cd frontend-aistudio
npm install
npm run dev
```

或通用方式：
```bash
cd frontend-aistudio
npm install
npm run dev
```

## 首次运行（重要）

如果是第一次运行，需要先准备数据库：

### 1️⃣ 创建数据库

打开 MySQL 命令行：
```bash
mysql -u root -p
```

执行：
```sql
CREATE DATABASE plant_knowledge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 2️⃣ 导入表结构

```bash
mysql -u root -p plant_knowledge < plant_system.sql
```

### 3️⃣ 配置数据库连接

编辑 `backend/config/config.js`：
```javascript
development: {
  username: 'root',           // 改成你的 MySQL 用户名
  password: '0529',  // 改成你的 MySQL 密码
  database: 'plant_knowledge',
  host: '127.0.0.1',
  dialect: 'mysql'
}
```

### 4️⃣ 导入测试数据（可选）

```bash
mysql -u root -p plant_knowledge < INSERT_DATA.sql
```

## 验证启动

### 后端验证

**方式 1：浏览器访问**
```
http://localhost:3001/api/plants?page=1&limit=10
```

预期看到 JSON 响应：
```json
{
  "code": 200,
  "message": "获取成功",
  "data": { ... }
}
```

**方式 2：curl 命令**
```bash
curl http://localhost:3001/api/plants
```

### 前端验证

在浏览器访问：
```
http://localhost:3000
```

应看到项目首页和导航菜单

## 常见问题速查

| 问题 | 解决方案 |
|------|--------|
| ❌ "node not found" | 检查 Node.js 是否安装并添加到 PATH |
| ❌ "port 3001 already in use" | 关闭占用端口的程序或修改 `backend/src/app.js` 中的 PORT |
| ❌ "port 3000 already in use" | 修改 `frontend-aistudio/vite.config.ts` 中的 server.port |
| ❌ "database connection failed" | 检查 MySQL 是否运行，数据库是否存在 |
| ❌ "CORS error" | 确认后端运行在 3001 端口，Vite 代理配置是否正确 |

## 详细配置文档

- [SETUP.md](./SETUP.md) - 完整的安装配置指南
- [backend/DEVELOPMENT.md](./backend/DEVELOPMENT.md) - 后端开发指南
- [TECHNICAL_SUMMARY.md](./TECHNICAL_SUMMARY.md) - 技术架构说明

## 代码编辑

### 修改后端代码

编辑 `backend/` 下的任意文件（models, controllers, routes 等）
→ **自动重启**（nodemon 监听）
→ 前端无需重启即可看到效果

### 修改前端代码

编辑 `frontend-aistudio/src/` 下的任意文件
→ **自动刷新**（Vite HMR）
→ 浏览器自动更新

## 项目结构速览

```
zhishi-plant-system/
├── start.bat / start.sh       ⭐ 一键启动
├── backend/                   🔵 后端（Node.js + Express）
│   ├── src/app.js            │ 应用主文件
│   ├── models/               │ 数据模型（15个）
│   ├── controllers/          │ 业务控制
│   ├── services/             │ 业务逻辑
│   ├── routes/               │ API 路由
│   └── npm run dev
│
├── frontend-aistudio/        🟢 前端（React + Vite）
│   ├── src/
│   │   ├── components/      页面组件
│   │   ├── api.ts           API 服务
│   │   └── main.tsx         应用入口
│   └── npm run dev
│
└── 📊 数据库
    ├── plant_system.sql      表结构
    └── INSERT_DATA.sql       测试数据
```

## 下一步

✅ 启动成功后：

1. **访问前端应用**：http://localhost:3000
2. **查看植物库**：点击导航菜单 → 植物库
3. **测试 CRUD**：添加、编辑、删除植物
4. **查看 API 文档**：[backend/API_PLANTS.md](./backend/API_PLANTS.md)

## 停止服务

### Windows
- 关闭命令行窗口，或在窗口中按 `Ctrl+C`

### Mac/Linux
- 在终端按 `Ctrl+C`

## 获取帮助

- 📖 [SETUP.md](./SETUP.md) - 详细文档
- 🔧 [backend/DEVELOPMENT.md](./backend/DEVELOPMENT.md) - 开发指南
- 🎯 [API_PLANTS.md](./backend/API_PLANTS.md) - API 文档
- 📋 [PROJECT_CHECKLIST.md](./PROJECT_CHECKLIST.md) - 项目清单

---

**祝使用愉快！** 🎉

如遇问题可参考完整的 [SETUP.md](./SETUP.md) 文档，或查看项目内其他 README 文件。
