# 🌿 植物科普学习与知识可视化系统

> 一个功能完整的植物学习和科普平台，集成了3D模型展示、数据可视化和交互式学习体验

## ⚡ 快速开始

👉 **新用户必读**：[QUICKSTART.md](./QUICKSTART.md) - **5分钟快速启动**

**一键启动**（Windows）：
```bash
start.bat
```

**一键启动**（Mac/Linux）：
```bash
bash start.sh
```

或手动启动：
```bash
# 终端1：后端
cd backend && npm run dev

# 终端2：前端
cd frontend-aistudio && npm run dev
```

访问应用：
- 🌐 **前端**：http://localhost:3000
- 🔗 **API**：http://localhost:3001

---

## 📋 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Vue3 + Vite + Element Plus + ECharts + Three.js |
| **后端** | Node.js + Express + MySQL + Sequelize |
| **数据库** | MySQL 8.0+ |
| **包管理** | npm |
| **开发工具** | nodemon（自动重启） + Vite HMR（热更新） |

---

## ✨ 功能模块

| 功能 | 说明 |
|------|------|
| 👤 **用户系统** | 注册、登录、个人资料管理 |
| 🌱 **植物管理** | 分类法（taxonomy）、植物库、详情页 |
| 📸 **多媒体展示** | 图片、视频、3D 模型展示 |
| 📚 **学习系统** | 收藏、浏览历史、阅读统计 |
| 📝 **测验系统** | 植物知识测验、成绩追踪 |
| 📊 **可视化** | 分布地图、统计图表、3D 交互 |

---

## 📂 项目结构

```
zhishi-plant-system/
├── start.bat / start.sh           ⭐ 一键启动脚本
├── QUICKSTART.md                  📖 快速启动指南（新手必读）
├── SETUP.md                       📖 完整安装配置
├── TECHNICAL_SUMMARY.md           📖 技术架构说明
│
├── backend/                       🔵 后端（Node.js + Express）
│   ├── src/
│   │   ├── app.js                │ 应用主文件
│   │   ├── models/               │ 数据模型（15个）
│   │   ├── controllers/          │ 业务控制器
│   │   ├── services/             │ 业务逻辑层
│   │   └── routes/               │ API 路由
│   ├── DEVELOPMENT.md            │ 开发指南
│   ├── API_PLANTS.md             │ 植物 API 文档
│   ├── start-dev.bat/sh          │ 启动脚本
│   └── nodemon.json              │ 监听配置
│
├── frontend-aistudio/            🟢 前端（React + Vite）
│   ├── src/
│   │   ├── components/           │ 页面组件
│   │   ├── api.ts                │ API 客户端
│   │   └── main.tsx              │ 应用入口
│   └── vite.config.ts            │ Vite 配置
│
└── 📊 数据库文件
    ├── plant_system.sql          表结构定义
    └── INSERT_DATA.sql           示例数据
```

---

## 🚀 开发工作流

### 后端开发
1. 编辑 `backend/` 中的任意文件
2. **自动重启**（nodemon 监听）✅
3. API 立即更新

### 前端开发  
1. 编辑 `frontend-aistudio/src/` 中的任意文件
2. **自动刷新**（Vite HMR）✅
3. 浏览器自动更新

---

## 📚 文档导航

| 文档 | 内容 |
|------|------|
| [QUICKSTART.md](./QUICKSTART.md) | **新手入门**（5分钟快速启动） |
| [SETUP.md](./SETUP.md) | 完整的安装配置步骤 |
| [backend/DEVELOPMENT.md](./backend/DEVELOPMENT.md) | 后端开发指南 |
| [backend/API_PLANTS.md](./backend/API_PLANTS.md) | 植物 API 文档 |
| [backend/SEARCH_RECOMMENDATION_DESIGN.md](./backend/SEARCH_RECOMMENDATION_DESIGN.md) | 搜索与推荐模块设计 |
| [TECHNICAL_SUMMARY.md](./TECHNICAL_SUMMARY.md) | 技术架构详解 |
| [PROJECT_CHECKLIST.md](./PROJECT_CHECKLIST.md) | 项目开发清单 |

---

## 🎯 功能特性

### 🎨 前端特色
- ✅ 响应式设计（桌面/平板/手机）
- ✅ Element Plus 组件库
- ✅ 动态图表（ECharts）
- ✅ 3D 交互模型（Three.js）
- ✅ 实时 HMR 开发体验

### 🔧 后端特色
- ✅ RESTful API 设计
- ✅ 15+ 数据模型
- ✅ 中间件权限控制
- ✅ 错误处理和验证
- ✅ 自动监听重启（nodemon）

### 📊 数据库特色
- ✅ UTF-8MB4 完整支持（emoji、复杂字符等）
- ✅ 标准化设计（3NF）
- ✅ 关系完整性约束
- ✅ 索引优化

---

## ❓ 常见问题

**Q: 如何修改数据库连接信息？**
A: 编辑 `backend/.env` 文件中的 `DB_HOST`、`DB_USER`、`DB_PASS` 等

**Q: 如何修改 API 端口？**
A: 编辑 `backend/.env` 文件中的 `PORT`

**Q: 如何修改前端端口？**
A: 编辑 `frontend-aistudio/vite.config.ts` 中的 `server.port`

**Q: 为什么后端文件修改后不生效？**
A: 确保运行了 `npm run dev`（启用 nodemon 自动重启）

详见 [QUICKSTART.md](./QUICKSTART.md) 的常见问题章节。

---

## 📦 环境要求

- **Node.js**：14.0 或更高
- **npm**：6.0 或更高
- **MySQL**：8.0 或更高
- **操作系统**：Windows / Mac / Linux

---

## 📝 许可证

MIT License

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

---

**快速开始**：立即查看 [QUICKSTART.md](./QUICKSTART.md) 👈
