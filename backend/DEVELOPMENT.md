# 后端开发指南

## 快速启动

### 1. 第一次设置

```bash
# 安装依赖
npm install

# 配置数据库（编辑 config/config.js）
# 修改 MySQL 用户名、密码、数据库名等

# 创建数据库
mysql -u root -p
> CREATE DATABASE plant_knowledge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 导入表结构
mysql -u root -p plant_knowledge < ../plant_system.sql

# 补齐运行期性能索引
npm run db:ensure-indexes
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器会运行在 `http://localhost:3001`

注意：
- 服务启动时不再自动执行 `sequelize.sync()`。
- 数据库表结构变更请通过 SQL 或 migration 脚本执行。
- 运行期性能索引请在需要时手动执行 `npm run db:ensure-indexes`。

**特点**：
- ✅ 使用 nodemon 自动监听文件变化
- ✅ 文件保存后立即重启服务器
- ✅ 监听目录：`src/`, `models/`, `controllers/`, `services/`, `routes/`

## 项目结构

```
backend/
├── config/
│   └── config.js              # 数据库配置（MySQL）
├── models/                    # Sequelize 数据模型（15 个）
│   ├── index.js              # 模型汇总和导出
│   ├── associations.js       # 模型关联定义
│   ├── user.js
│   ├── taxa.js
│   ├── plants.js
│   ├── plant_detail.js
│   ├── plant_media.js
│   ├── media_assets.js
│   ├── browse_events.js
│   ├── favorites.js
│   ├── plant_observations.js
│   ├── plant_popularity_daily.js
│   ├── quizzes.js
│   ├── questions.js
│   ├── question_options.js
│   ├── quiz_attempts.js
│   └── attempt_answers.js
├── controllers/               # 请求处理层
│   ├── userController.js
│   └── plantController.js
├── services/                  # 业务逻辑层
│   └── plantService.js
├── routes/                    # 路由定义
│   ├── user.js
│   └── plants.js
├── middleware/                # 中间件（预留）
├── src/
│   └── app.js                # Express 主应用
├── nodemon.json              # nodemon 配置
├── package.json
├── .env.example              # 环境配置示例
├── .env                       # 环境配置（不提交）
└── .gitignore
```

## 开发工作流

### 1. 修改代码
编辑任意文件（如 `controllers/plantController.js`）

### 2. 自动重启
nodemon 检测到文件变化，自动重启服务器

```
[nodemon] restarting due to changes...
[nodemon] starting `node src/app.js`
Server running on port 3001
```

### 3. 测试 API
使用 curl、Postman 或前端测试 API 变化

```bash
curl http://localhost:3001/api/plants?page=1&limit=10
```

## nodemon 配置说明

### 配置文件：nodemon.json

```json
{
  "watch": ["src", "models", "controllers", "services", "routes"],  // 监听目录
  "ext": "js",                    // 监听扩展名
  "ignore": ["node_modules", "*.json"],  // 忽略文件
  "delay": 500,                   // 重启延迟（毫秒）
  "exec": "node",                 // 执行命令
  "env": {
    "NODE_ENV": "development"
  },
  "verbose": false,               // 禁用详细日志
  "legacy-watch": false           // 使用高效的文件监听
}
```

### 常见选项

| 选项 | 说明 |
|------|------|
| `watch` | 监听文件/目录列表 |
| `ext` | 监听文件扩展名（逗号分隔） |
| `ignore` | 忽略文件/目录列表 |
| `delay` | 文件变化后的重启延迟 |
| `env` | 环境变量 |
| `verbose` | 是否输出详细日志 |

### 修改配置

编辑 `nodemon.json` 后，重启 `npm run dev` 即可生效。

**例**：监听 .json 文件变化

```json
{
  "watch": ["src", "models"],
  "ext": "js,json"
}
```

## API 测试

### 使用 curl

```bash
# 获取植物列表
curl "http://localhost:3001/api/plants?page=1&limit=10"

# 创建植物
curl -X POST http://localhost:3001/api/plants \
  -H "Content-Type: application/json" \
  -d '{"taxon_id": 1, "chinese_name": "测试植物"}'

# 获取详情
curl http://localhost:3001/api/plants/1

# 更新
curl -X PUT http://localhost:3001/api/plants/1 \
  -H "Content-Type: application/json" \
  -d '{"chinese_name": "修改后的名称"}'

# 删除
curl -X DELETE http://localhost:3001/api/plants/1
```

### 使用 Postman

1. 导入 API 集合
2. 配置环境变量 `{{base_url}}` = `http://localhost:3001`
3. 发送请求测试

### 使用前端应用

访问 `http://localhost:5173/plants`

## 常见问题

### nodemon 不重启？

**解决**：
1. 确认文件在监听目录内
2. 检查 `nodemon.json` 配置
3. 查看控制台是否有错误信息
4. 重启 `npm run dev`

### nodemon 频繁重启？

**解决**：
1. 检查代码是否有语法错误
2. 增加 `delay` 延迟时间
3. 排除不必要的监听目录

### 数据库连接失败？

**解决**：
1. 确认 MySQL 服务运行
2. 检查 `config/config.js` 的配置
3. 确认数据库和表已创建

## npm 脚本

```bash
npm run dev     # 开发模式（nodemon）
npm start       # 生产模式
npm test        # 运行测试（待实现）
npm run db:ensure-indexes  # 手动补齐运行期性能索引
```

## 环境变量

编辑 `.env` 文件配置：

```
NODE_ENV=development
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=0529
DB_NAME=plant_knowledge
JWT_SECRET=secret-key
PORT=3001
```

**注意**：`.env` 不要提交到 Git，已在 `.gitignore` 中忽略。

## 代码规范

### 命名规范
- 文件名：`camelCase.js`
- 类/构造函数：`PascalCase`
- 函数/方法：`camelCase`
- 常量：`CONSTANT_CASE`

### 响应格式

**成功**：
```javascript
res.json({
  code: 200,
  message: "获取成功",
  data: { ... }
})
```

**失败**：
```javascript
res.status(400).json({
  code: 400,
  message: "错误信息"
})
```

## 调试技巧

### 打印日志
```javascript
console.log('变量值：', value);
```

### 检查模型关联
```javascript
// 在 app.js 中调用 setupAssociations 后
console.log(Models.Plants.associations);
```

### 使用 GUI 调试
```bash
# Node Inspector
node --inspect src/app.js

# 然后访问 chrome://inspect
```

## 生产部署

### 1. 关闭开发模式
```bash
npm start
```

### 2. 使用 PM2 进程管理
```bash
npm i -g pm2

pm2 start src/app.js --name "plant-api"
pm2 logs
pm2 stop all
```

### 3. 使用 Docker
```dockerfile
FROM node:16
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3001
CMD ["npm", "start"]
```

## 相关文档

- API 文档：[API_PLANTS.md](./API_PLANTS.md)
- 技术总结：[../TECHNICAL_SUMMARY.md](../TECHNICAL_SUMMARY.md)
- 项目设置：[../SETUP.md](../SETUP.md)

---

祝开发愉快！🚀
