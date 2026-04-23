# 植物科普学习与知识可视化系统

这是一个植物科普学习、分类浏览、物种详情、保护信息与知识可视化系统。当前项目由 Node.js 后端、MySQL 数据库和 React + TypeScript 前端组成。

## 当前技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19, TypeScript, Vite, Tailwind CSS, lucide-react, motion |
| 后端 | Node.js, Express, Sequelize, MySQL |
| 数据库 | MySQL 8.0+ |
| 包管理 | npm |

> 说明：历史文档中可能仍出现 Vue3、Element Plus 等描述，这些已经不是当前前端技术栈。请以本文件、`QUICKSTART.md`、`backend/DEVELOPMENT.md` 和 `backend/DATA_IMPORT_GUIDE.md` 为准。

## 快速启动

### 后端

```bash
cd backend
npm install
npm run dev
```

默认 API 地址：

```text
http://localhost:3001
```

### 前端

```bash
cd frontend-aistudio
npm install
npm run dev
```

默认前端地址：

```text
http://localhost:3000
```

也可以在项目根目录使用一键脚本：

```bash
start.bat
```

或：

```bash
bash start.sh
```

## 目录结构

```text
zhishi-plant-system/
  backend/               Node.js + Express 后端
    src/app.js           后端应用入口
    controllers/         控制器
    routes/              API 路由
    services/            业务服务
    models/              Sequelize 模型
    scripts/             数据导入、迁移、维护脚本
    tests/               后端测试
  frontend-aistudio/     React + TypeScript + Vite 前端
    src/App.tsx          前端应用入口组件
    src/api.ts           API 客户端
    src/components/      页面与功能组件
    src/types.ts         前端类型定义
  data-source/           外部数据源目录
  docs/                  当前文档索引与历史归档
  plant_system.sql       基础数据库结构
  INSERT_DATA.sql        示例数据
```

## 可信文档入口

- `QUICKSTART.md`：快速启动。
- `SETUP.md`：完整安装与环境配置，部分内容仍待进一步校准。
- `backend/DEVELOPMENT.md`：后端开发说明。
- `backend/DATA_IMPORT_GUIDE.md`：数据导入官方流程。
- `backend/scripts/README.md`：数据脚本分层和使用规则。
- `docs/README.md`：文档治理说明和历史归档索引。

## 数据导入原则

WCVP、IUCN、WDPA 等大型数据导入属于初始化或阶段性维护任务，不是日常开发任务。日常开发优先使用 `backend/package.json` 中暴露的 npm scripts，不直接运行未登记的一次性脚本。

当前 WCVP 官方入口为：

```bash
cd backend
npm run import:wcvp
```

更多数据流程见 `backend/DATA_IMPORT_GUIDE.md`。

## 常用命令

后端：

```bash
cd backend
npm run dev
npm test
npm run db:ensure-indexes
```

前端：

```bash
cd frontend-aistudio
npm run dev
npm run build
npm run lint
```

## 维护约定

- 根目录只保留启动、安装、数据库初始化和当前可信入口文档。
- 阶段性总结、AI 生成报告、旧方案放入 `docs/archive/`。
- 新增数据脚本必须在 `backend/scripts/README.md` 登记用途、入口、输入输出和是否可重复执行。
- 优先通过 `backend/package.json` 的 npm scripts 暴露正式数据任务。
