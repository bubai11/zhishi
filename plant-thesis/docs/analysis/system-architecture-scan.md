# 系统结构扫描结果

## 1. 项目扫描范围

本次扫描覆盖了 `d:\zhishi-plant-system` 项目的以下核心目录：
- **前端目录**: `frontend-aistudio/src/`（包含 `components/`, `api.ts`, `App.tsx`, `types.ts` 等）
- **后端目录**: `backend/`（包含 `src/app.js`, `routes/`, `controllers/`, `services/`, `models/`）
- **数据工程目录**: `backend/scripts/` 以及 `scripts/`（包含各类数据导入、补充、清洗脚本）

## 2. 系统真实架构

基于代码的实际存在情况，系统架构分为以下几个层级：

### 2.1 前端层 (React + Vite + Tailwind CSS)
- **页面路由机制**: 未使用 `react-router-dom` 等第三方路由库，而是通过 `App.tsx` 中的状态变量 `currentPage` 配合 URL 参数实现页面组件的动态挂载。
- **组件结构**: 包含 7 个核心页面组件（Home, Library, Classification, Analysis, LearningCenter, PlantDetail, UserProfile）以及公共组件（Navbar, Footer）。
- **接口通信**: 通过 `api.ts` 集中封装前端对后端的请求。

### 2.2 后端层 (Node.js + Express)
采用典型的 MVC (模型-视图-控制器) 变体架构：
- **入口层**: `src/app.js` 统一挂载跨域、JSON 解析中间件以及 13 个业务路由模块。
- **路由层 (`routes/`)**: 定义 API 端点并应用中间件（如 `authMiddleware` 鉴权）。
- **控制层 (`controllers/`)**: 提取请求参数并调用相应的 Service，如 `plantController`, `taxaController`, `redlistController` 等。
- **业务逻辑层 (`services/`)**: 处理核心业务逻辑，如 `plantService`, `searchService`, `chineseNameService`，部分服务中（如 `searchService`）存在大量复杂的原生 SQL 拼接与查询。

### 2.3 数据层 (MySQL + Sequelize)
- **ORM 模型 (`models/`)**: 定义了近 30 个数据模型，涵盖植物主数据 (`plants`), 分类 (`taxa`), 详情 (`plant_detail`), 分布 (`plant_distributions`, `wgsrpd_regions`), 濒危预警 (`threatened_species`, `redlist_alerts`), 用户及互动 (`user`, `favorites`, `browse_events`), 测验 (`quizzes`, `questions`, `quiz_attempts`) 等。
- **关联关系**: 在 `associations.js` 中集中定义了表间的关系（一对多、一对一等）。

### 2.4 数据工程层 (独立脚本群)
不属于系统实时运行的服务，而是用于支撑系统数据的构建与维护，主要包含：
- **核心数据导入**: 如 `import-wcvp.js`, `import-iucn-redlist.js`, `import-wdpa.js`。
- **名称与数据增强**: 如 `enrich-plants-from-iplant.js`, `fetch-chinese-names.js`, `batch-update-chinese-names.js`，包含不同优先级的名称映射处理。
- **图片补全与清洗**: 如 `enrich-real-images.js`, `standardize-common-plant-images.js`, `localize-placeholder-covers.js`。
- **修复与迁移**: 如 `repair-taxonomy-chain.js`, `migrate-schema-evolution-2026-03.js` 等历史与维护脚本。

## 3. 实际功能模块划分

通过对应前端组件和后端路由/控制器，真实实现的功能模块如下：

1. **植物知识库 (Library.tsx / plants.js / search.js)**
   - 支持列表展示、关键词/科属检索、结果排序。
   - `searchService.js` 中实现了基于缓存和复杂相关度计算的检索逻辑。
2. **分类树探索 (Classification.tsx / taxa.js)**
   - 支持从顶层节点逐级加载（懒加载）植物分类树，并可反向搜索分类节点。
3. **数据可视化分析 (Analysis.tsx / wcvpAnalytics.js)**
   - 提供基于 WGSRPD 区域的分布热度图、区域统计、物种多样性占比以及高频濒危预警信息的汇总。
4. **濒危预警 (redlist.js / redlistController.js)**
   - 支持查看濒危物种列表及详情。
   - 包含针对用户的预警提醒管理（已读、忽略、未读计数）。
5. **学习测验中心 (LearningCenter.tsx / quizzes.js)**
   - 题库呈现、答题提交校验（评分记录）、历史答题记录查询。
6. **用户与成就系统 (UserProfile.tsx / user.js)**
   - JWT 用户注册登录、个人资料、浏览历史记录、植物收藏夹、学习统计及成就徽章。
7. **数据管理员后端接口 (admin.js)**
   - 提供供数据维护使用的接口（如中文名审核与更新等），但前端暂未看到成熟的管理控制台组件与之对应。

## 4. 关键目录与职责说明

- `frontend-aistudio/src/components/`: 包含所有前端页面与组件。
- `backend/routes/` & `backend/controllers/`: 处理客户端 HTTP 请求与响应。
- `backend/services/`: 系统的核心大脑，封装业务规则与 SQL 组装。
- `backend/models/`: Sequelize ORM 定义，映射底层数据表。
- `backend/scripts/`: 庞大的数据预处理、导入与维护工具链，支撑系统的知识基础。

## 5. 初步观察结论

- **分层清晰但部分服务过重**: 系统前后端分离明确，后端 MVC 架构清晰。但部分 Service（如 `searchService.js` 近 600 行，大量 Raw SQL）承担了过重的组装和查询逻辑。
- **无成熟的前端管理后台**: 系统存在 `admin.js` 路由，并有大量的数据维护脚本，但前端并未实现对应的管理员仪表盘页面（仅存在 `admin.js` 供 API 调用或脚本使用）。
- **数据工程是项目核心基础**: 系统极度依赖 `backend/scripts` 中的数十个脚本完成多源数据的融合（WCVP、IUCN、iPlant 等），数据准备工作构成了系统的基本盘。
