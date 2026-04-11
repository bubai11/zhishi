# 植物知识系统《系统架构白皮书》

生成日期：2026-04-07  
项目：`zhishi-plant-system`

## 1. 执行摘要

植物知识系统当前已具备可运行的全栈主干，整体架构采用：

- 前端：`frontend-aistudio`，基于 React + TypeScript + Vite 的单页应用
- 后端：`backend`，基于 Express + Sequelize + MySQL 的接口服务
- 数据侧：本地维护 WCVP、IUCN、WDPA、WGSRPD 等大体量数据源，并通过脚本完成导入、补全、校验与索引优化

系统已经进入“功能已成形、工程化仍需收口”的阶段。当前最突出的问题不是功能缺失，而是：

- 目录与技术栈存在“双轨并存”现象，造成系统边界不清
- 搜索、统计、预警等核心查询依赖 `LIKE` 和原生 SQL，后续数据量扩大时性能风险较高
- 安全基线偏弱，存在默认 JWT 密钥、开放式 CORS、缺少限流等典型上线风险
- 数据导入/迁移脚本很多，说明系统有很强的数据工程属性，但也带来了维护成本和知识集中风险

综合判断：  
该项目已经具备中后期交付基础，适合进入“架构收口 + 上线前治理 + 性能专项”的阶段，而不是继续无边界扩功能。

## 2. Phase 1 项目结构测绘

### 2.1 顶层结构概览

仓库中同时存在以下几个重要子系统：

- `backend`：后端 API、模型、服务、脚本、测试
- `frontend-aistudio`：当前 React 前端主工程
- `frontend`：旧版 Vue 前端工程
- `data-source`：IUCN / WCVP / WDPA / WGSRPD 原始数据
- `ai-output`：图像与补全结果产物
- `scripts`：仓库级辅助脚本

这意味着仓库不是“单纯的前后端项目”，而是一个包含：

- 业务应用
- 数据治理流水线
- 静态资源生产
- 历史前端遗留版本

的复合型工程。

### 2.2 实际运行前端识别

当前主前端是 `frontend-aistudio`，而不是仓库中的 `frontend`。

判断依据：

- `frontend-aistudio/src` 是完整的 React/TS 代码入口
- `frontend-aistudio/package.json` 具备 Vite 启动、构建、类型检查脚本
- `frontend` 为另一套 Vue 项目，疑似历史版本或备用版本

需要特别指出的是，用户背景描述写的是“React 18 + TypeScript”，但代码实际显示：

- `react`: `^19.0.0`
- `react-dom`: `^19.0.0`
- `vite`: `^6.2.0`

因此，当前真实技术栈应以代码为准，前端已不是 React 18。

### 2.3 后端结构概览

后端目录具有比较明显的分层：

- `routes/`：API 路由入口
- `controllers/`：HTTP 控制器
- `services/`：业务逻辑与查询实现
- `models/`：Sequelize 模型定义
- `scripts/`：迁移、导入、补全、标准化、性能索引脚本
- `tests/`：Node 内置 test 测试用例
- `src/app.js`：后端启动入口

值得注意的是：

- 启动入口在 `backend/src/app.js`
- 但主要业务代码又分散在 `backend/routes`、`backend/controllers`、`backend/services`、`backend/models`

这是一个“入口在 src，主体代码在根层”的混合布局，结构可运行，但不够整洁。

### 2.4 数据模型全景

后端模型数量较多，已具备明确领域划分：

- 植物主数据：`plants`、`plant_detail`、`plant_ecology`、`plant_synonyms`
- 分类学：`taxa`、`taxonomy_features`、`taxonomy_statistics`
- 保护与濒危：`threatened_species`、`redlist_alerts`、`redlist_alert_user_state`、`protected_areas`
- 分布数据：`plant_distributions`、`wgsrpd_regions`
- 用户域：`user`、`favorites`、`browse_events`、`user_achievements`
- 学习域：`quizzes`、`questions`、`question_options`、`quiz_attempts`、`attempt_answers`
- 媒体域：`media_assets`、`plant_media`
- 观测与热度：`plant_observations`、`plant_popularity_daily`
- 外部来源：`plant_external_sources`

说明系统已经从“纯植物百科”扩展成一个包含：

- 知识库
- 分类浏览
- 预警中心
- 用户行为
- 学习中心
- 数据融合

的综合平台。

## 3. 架构全景

### 3.1 请求链路

当前主链路为：

`React SPA -> API 封装层 -> Express Router -> Controller -> Service -> Sequelize / Raw SQL -> MySQL`

其中：

- 前端 `src/api.ts` 统一封装 API 调用、鉴权头、缓存和失效逻辑
- 后端 `routes` 负责 URL 映射
- `controllers` 负责输入/输出和错误响应
- `services` 承载真实业务逻辑
- 查询层混用 Sequelize 模型查询与 `sequelize.query(...)` 原生 SQL

这类架构的优点是上手快、扩展快；缺点是当业务增长后，查询逻辑容易分散，性能调优与一致性治理成本会升高。

### 3.2 前端架构特征

React 前端目前是“轻路由、重状态”的单页模式：

- 页面切换主要靠 `App.tsx` 中的状态与 URL 参数同步
- 没有引入 React Router，而是手动维护 `page`、`plantId`、`search`、`sort` 等参数
- API 层内置了 GET 缓存、inflight 去重和局部缓存失效

这套方式对中小型系统足够灵活，但随着页面数、鉴权状态和交互流增加，维护复杂度会逐步上升。

### 3.3 后端架构特征

后端有典型的业务分域：

- Plant / Taxa / Search / RedList / Favorites / Browse / Quiz / Media / User / Analytics

其中 `plantService.js`、`searchService.js`、`redlistService.js` 是核心价值密度最高的服务层文件，已经体现出：

- 复杂 SQL 排序
- 聚合统计
- 多表联查
- 基于业务规则的结果格式化

说明项目的复杂度主要集中在“数据组织与查询表达”，而不是复杂的异步分布式调用。

### 3.4 数据工程侧架构

仓库中的 `backend/scripts` 体量很大，涵盖：

- schema 迁移
- 性能索引补建
- WCVP / IUCN / WDPA 数据导入
- 中文名补全
- 图像导入与标准化
- 数据 readiness 检查

这意味着项目具备明显的数据中台特征。  
后续若继续增长，脚本体系建议升级为更正式的数据任务编排体系，否则维护会越来越依赖个人经验。

## 4. 技术债务清单

### P0

- 前后端双轨并存：`frontend-aistudio` 与 `frontend` 同时存在，容易误导部署、联调和新人理解。
- JWT 存在默认回退密钥：`process.env.JWT_SECRET || 'secret-key'`，属于上线级安全隐患。
- 后端目录结构混合：入口在 `src`，业务主体在根目录，长期会放大维护成本。

### P1

- 查询层混用 Sequelize 和大量原生 SQL，风格不统一，测试与重构门槛偏高。
- 编码/文案存在乱码痕迹，错误信息和注释出现明显字符集问题，影响可维护性与对外输出质量。
- 前端未使用正式路由系统，页面流转逻辑集中在单个 `App.tsx`，后期扩展风险较高。
- 缺少更系统化的配置分层，开发/测试/生产环境隔离能力偏弱。

### P2

- 数据导入与修复脚本数量很多，但缺少统一任务分级和编排规范。
- 当前测试覆盖偏向工具函数和规则函数，业务接口级、集成级覆盖不足。
- 文档多而分散，存在多个报告、总结、说明文件并行，主线文档治理还未收口。

## 5. 性能瓶颈评估

### 5.1 搜索与列表查询

`searchService.js` 与 `plantService.js` 中的核心搜索策略依赖：

- `LIKE 'prefix%'`
- `LIKE '%keyword%'`
- 排序时拼接 `CASE WHEN`
- 热度分数联查

风险：

- `LIKE '%keyword%'` 很难高效利用普通索引
- 数据量从万级升到十万级后，检索延迟会明显上升
- 排序逻辑内联在 SQL 中，维护与优化难度较高

当前已有 `ensure-performance-indexes.js` 补了部分索引，但这对“包含匹配”只能部分缓解，不能根治。

### 5.2 明细页查询

`getPlantById` 会：

- 通过 Sequelize include 拉取多组关联
- 再额外执行分类链递归查询
- 再额外统计观测数量

单次请求还可接受，但如果未来明细页扩展更多联查字段或高并发访问增多，会形成热点接口。

### 5.3 统计与预警查询

以下查询天然偏重：

- 热区统计：按 `plant_distributions.area_code_l3` 聚合
- 活跃用户统计：按近 30 天浏览去重
- 预警列表：`redlist_alerts` 与 `redlist_alert_user_state` 左连接
- 一键已读：先全量读取 alerts，再批量 upsert

这些查询在数据增长后很容易成为后台慢查询来源。

### 5.4 资源体积

前端构建产物显示：

- JS 主包约 `412.79 kB`
- gzip 后约 `124.56 kB`

当前仍可接受，但已经进入需要关注代码拆分的区间，尤其页面组件都挂在单个入口时，首屏负载后续可能继续膨胀。

## 6. 安全风险评估

### 高风险

- JWT 默认密钥回退：如果环境变量遗漏，系统会使用固定弱密钥。
- CORS 全开放：`app.use(cors())` 没有来源白名单与方法限制。
- 缺少登录/搜索/写接口限流：容易被爆破、刷接口或恶意放大查询压力。

### 中风险

- 管理端接口仅做登录校验，没有看到额外的角色/权限分层。
- 多数输入校验仍停留在手写函数级别，缺少统一 schema 校验体系。
- 错误信息与编码问题会降低审计质量，影响问题定位与对外一致性。

### 低风险

- 密码采用 `bcryptjs` 处理，这是正向信号。
- 认证保护已经覆盖用户中心、收藏、浏览记录、答题记录、红色名录个人态接口。

## 7. 健康检查结果

### 已验证

- 后端测试：通过
  - 执行时间约 1.15s
  - 共 31 个测试，0 失败
- 前端类型检查：通过
  - `tsc --noEmit` 通过
- 前端生产构建：通过
  - 初次在沙箱内因 `esbuild` 子进程 `spawn EPERM` 失败
  - 提升权限后构建成功

### 结论

从“能否构建/能否通过测试”的角度，当前项目是健康的。  
从“是否适合上线/是否容易长期维护”的角度，仍存在较明显的治理缺口。

## 8. 优化路线图

### 第一阶段：上线前治理，1 周

- 去掉 JWT 默认密钥回退，启动时强制校验环境变量
- 为 CORS 增加来源白名单、方法范围与凭证策略
- 为登录、搜索、管理端更新接口增加限流
- 明确主前端，只保留一个默认运行入口，并标注旧版前端状态
- 修复关键乱码文案，统一 UTF-8 编码

### 第二阶段：性能专项，1-2 周

- 为高频查询建立慢 SQL 清单与基线耗时
- 将搜索拆成“前缀检索”和“全文检索/倒排检索”两级方案
- 为 `redlist_alerts`、`redlist_alert_user_state`、`plant_distributions` 增补组合索引
- 优化 `markAllRead` 为单条批量 SQL 路径，避免全量读取 alerts
- 评估前端代码分包与按页面懒加载

### 第三阶段：架构收口，2-3 周

- 统一后端目录：将 routes/controllers/services/models 归入一致层级
- 引入正式配置层与环境区分策略
- 将脚本体系按“迁移 / 导入 / 修复 / 分析”重新分类
- 为核心 API 增加集成测试
- 建立一份唯一可信的系统总文档，替代分散报告

### 第四阶段：中期演进，视资源投入

- 前端引入正式路由管理
- 搜索升级为全文索引方案或专用搜索服务
- 数据导入脚本演进为任务编排流水线
- 增加审计日志、管理员角色与操作追踪

## 9. 最终判断

植物知识系统已经具备比较完整的产品轮廓，最有价值的部分不是页面本身，而是：

- 植物主数据
- 分类链路
- 濒危预警
- 地理分布
- 数据补全与标准化能力

这说明项目的核心护城河在“数据组织能力”和“知识结构化能力”。

当前建议不是再铺更多模块，而是优先做三件事：

1. 收口工程结构，明确唯一主前端与主运行路径
2. 补齐安全底线，避免弱配置直接进入部署环境
3. 提前处理搜索和统计性能，否则后期数据增长会反噬体验

如果这三步完成，该系统将从“完成度不错的毕业/项目型系统”，升级为“具备持续演进能力的产品型系统”。
