# 快速启动

本文件用于本地快速启动植物科普学习与知识可视化系统。当前前端为 React + TypeScript + Vite，后端为 Node.js + Express + MySQL。

## 前置条件

- Node.js 18+，建议 Node.js 20+
- npm
- MySQL 8.0+
- Git

## 1. 准备数据库

创建数据库：

```sql
CREATE DATABASE plant_knowledge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

导入基础结构：

```bash
mysql -u root -p plant_knowledge < plant_system.sql
```

可选：导入示例数据。

```bash
mysql -u root -p plant_knowledge < INSERT_DATA.sql
```

## 2. 配置后端环境

复制或参考后端环境变量示例：

```bash
cd backend
```

检查 `backend/.env` 或 `backend/config/` 下的数据库连接配置，确保数据库名、用户名、密码和端口与本机一致。

## 3. 启动后端

```bash
cd backend
npm install
npm run dev
```

默认地址：

```text
http://localhost:3001
```

## 4. 启动前端

新开一个终端：

```bash
cd frontend-aistudio
npm install
npm run dev
```

默认地址：

```text
http://localhost:3000
```

## 一键启动

Windows：

```bash
start.bat
```

Mac/Linux：

```bash
bash start.sh
```

如果一键脚本失败，请优先使用上面的手动方式分别启动后端和前端。

## 常见检查

后端依赖或服务异常：

```bash
cd backend
npm install
npm run dev
```

前端依赖或页面异常：

```bash
cd frontend-aistudio
npm install
npm run dev
```

后端测试：

```bash
cd backend
npm test
```

前端类型检查：

```bash
cd frontend-aistudio
npm run lint
```

## 数据导入提醒

WCVP、IUCN、WDPA 等大型数据导入通常只在初始化或数据维护阶段执行。日常开发不需要反复运行这些脚本。

正式数据导入流程见：

```text
backend/DATA_IMPORT_GUIDE.md
backend/scripts/README.md
```
