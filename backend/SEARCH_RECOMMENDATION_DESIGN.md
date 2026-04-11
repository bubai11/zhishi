# 搜索与推荐模块设计（V1）

> 目标：在当前项目已有数据模型基础上，补齐“可用、可扩展、可验收”的搜索与推荐能力。

---

## 1. 设计范围

### 1.1 搜索模块
- 关键词搜索（中文名、学名、描述）
- 模糊搜索（前缀/包含）
- 搜索建议（自动补全）
- 搜索结果排序（相关度 + 热度 + 新鲜度）

### 1.2 推荐模块
- 最近浏览推荐（同用户最近行为）
- 热门植物推荐（全站热度）
- 个性化简单推荐（收藏 + 浏览偏好）

### 1.3 非目标（V1 不做）
- 向量召回/语义检索
- 复杂机器学习模型
- 实时流式特征计算

---

## 2. 现状与约束

当前可复用能力：
- 植物数据：`plants`、`plant_detail`、`taxa`
- 行为数据：`browse_events`（浏览行为）、`favorites`（收藏）
- 热度数据：`plant_popularity_daily`（按天 views/favorites/score）
- 现有查询入口：`GET /api/plants?page=&limit=&keyword=`（当前仅按中文名 like）

约束：
- 现阶段为 MySQL + Sequelize，不引入新检索引擎
- 推荐优先“可解释、可迭代”，先规则后算法

---

## 3. 总体架构

### 3.1 分层
- Route：接收参数、鉴权、基础校验
- Controller：参数标准化与响应组装
- Service：搜索召回、排序打分、推荐策略
- Model/SQL：读写行为、读取植物与热度

### 3.2 模块拆分建议
- `backend/routes/search.js`
- `backend/controllers/searchController.js`
- `backend/services/searchService.js`
- `backend/routes/recommendations.js`
- `backend/controllers/recommendationController.js`
- `backend/services/recommendationService.js`

---

## 4. 搜索模块设计

## 4.1 API 设计

### 4.1.1 搜索接口
- 方法与路径：`GET /api/search/plants`
- 查询参数：
  - `q`：关键词（必填）
  - `page`：页码，默认 1
  - `limit`：每页条数，默认 10，最大 50
  - `sort`：`relevance` | `popular` | `latest`（默认 `relevance`）
  - `taxonId`：可选分类过滤
- 返回：
  - `list`：命中植物
  - `pagination`：分页信息
  - `meta`：本次排序模式、耗时、命中总数

### 4.1.2 搜索建议接口
- 方法与路径：`GET /api/search/suggest`
- 查询参数：
  - `q`：用户输入前缀（必填，长度 1~30）
  - `limit`：建议数，默认 8，最大 20
- 返回：
  - `suggestions`：建议词列表（中文名/学名）

## 4.2 召回字段

V1 召回目标字段：
- `plants.chinese_name`
- `plants.scientific_name`
- `plants.short_desc`
- `plant_detail.intro`
- `plant_detail.uses`

## 4.3 排序策略

### 4.3.1 relevance 相关度排序

定义标准化分值（0~1）：
- `textScore`：文本命中分
- `popularityScore`：热度分（来自近 30 天 score 聚合）
- `freshnessScore`：新鲜度分（按创建时间衰减）

综合分：

`finalScore = 0.65 * textScore + 0.25 * popularityScore + 0.10 * freshnessScore`

文本分建议规则：
- 中文名全等：1.00
- 中文名前缀匹配：0.85
- 中文名包含匹配：0.75
- 学名前缀匹配：0.70
- 学名包含匹配：0.60
- short_desc/intro/uses 命中：0.45~0.55

### 4.3.2 popular 热门排序
- 主排序：近 30 天 `popularityScore` 降序
- 次排序：`finalScore` 降序（平分时）

### 4.3.3 latest 最新排序
- 主排序：`plants.created_at` 降序
- 次排序：`finalScore` 降序

## 4.4 搜索建议策略

优先级：
1. 中文名前缀匹配
2. 学名前缀匹配
3. 中文名包含匹配

去重策略：
- 同一植物只保留 1 条建议
- 同词忽略大小写去重

---

## 5. 推荐模块设计

## 5.1 API 设计

### 5.1.1 最近浏览推荐
- 方法与路径：`GET /api/recommendations/recently-viewed`
- 鉴权：需要登录
- 查询参数：
  - `limit`：默认 10，最大 30
- 返回：
  - 最近浏览植物列表（按最近浏览时间倒序）

### 5.1.2 热门推荐
- 方法与路径：`GET /api/recommendations/popular`
- 鉴权：不强制
- 查询参数：
  - `days`：统计窗口，默认 7，可选 7/30
  - `limit`：默认 10，最大 30
- 返回：
  - 热门植物列表（按热度分）

### 5.1.3 个性化推荐（简单版）
- 方法与路径：`GET /api/recommendations/for-you`
- 鉴权：需要登录
- 查询参数：
  - `limit`：默认 12，最大 30
- 返回：
  - 推荐植物列表
  - `reason`：推荐原因（如“你常浏览 蔷薇科 植物”）

## 5.2 个性化策略（V1）

### 5.2.1 用户兴趣画像
- 输入行为：
  - 浏览行为（近 30 天）
  - 收藏行为（近 90 天）
- 画像维度：
  - `taxon_id` 偏好权重
- 权重建议：
  - 收藏权重 0.65
  - 浏览权重 0.35

### 5.2.2 候选召回
- 从用户偏好最高的 Top-N 分类中召回植物
- 过滤用户已收藏与最近浏览过的植物（避免重复打扰）

### 5.2.3 排序公式

标准化分值（0~1）：
- `interestScore`：分类兴趣匹配分
- `popularityScore`：近 30 天热度分
- `noveltyScore`：新颖性分（用户近期未接触程度）

综合分：

`recommendScore = 0.50 * interestScore + 0.35 * popularityScore + 0.15 * noveltyScore`

## 5.3 降级策略

- 用户无行为数据：降级到热门推荐
- 热门数据不足：按最新创建时间补齐
- 登录态失效：返回 401，由前端提示登录后查看“为你推荐”

---

## 6. 数据与索引建议

为保证搜索和推荐在数据增长后的性能，建议新增以下索引：

- `plants(chinese_name)`
- `plants(scientific_name)`
- `plants(created_at)`
- `plant_detail(plant_id)`（若未建）
- `browse_events(user_id, occurred_at)`
- `browse_events(plant_id, occurred_at)`
- `favorites(user_id, created_at)`
- `plant_popularity_daily(date, score)`
- `plant_popularity_daily(plant_id, date)`

可选增强：
- 对 `plants(chinese_name, scientific_name, short_desc)` 增加 FULLTEXT（MySQL 版本和中文分词能力允许时）

---

## 7. 任务分期

## Phase 1（2~3 天）
- 新增搜索/建议接口
- 支持排序模式（relevance/popular/latest）
- 前端植物列表页接入新搜索接口（保留兼容）

## Phase 2（2 天）
- 新增热门推荐、最近浏览推荐接口
- 新增“猜你喜欢”入口卡片（使用 for-you，未登录隐藏）

## Phase 3（2~3 天）
- 个性化推荐打分落地
- 推荐原因文案
- 基础埋点与效果指标

---

## 8. 验收标准

搜索模块：
- 输入关键字可返回相关植物（中文名、学名、描述）
- 搜索建议延迟在本地开发环境下通常小于 200ms
- 三种排序模式返回顺序符合预期

推荐模块：
- 未登录可访问热门推荐
- 已登录可访问最近浏览与为你推荐
- 无行为用户可稳定降级到热门推荐

质量标准：
- 所有新接口补齐 Postman 用例
- 核心排序/打分函数有最小单元测试
- 错误响应格式与现有 API 保持一致

---

## 9. 前后端改造清单（实施指引）

后端：
- 新增搜索与推荐 route/controller/service
- 新增参数校验中间件：search/recommendation 查询参数
- 复用现有模型，必要时补索引 SQL

前端：
- `Plants.vue`：接入 `/api/search/plants` 与 `/api/search/suggest`
- 首页或学习中心：新增“热门推荐”“为你推荐”模块
- 未登录状态：展示热门推荐，隐藏个性化入口

---

## 10. 风险与后续优化

风险：
- `LIKE %q%` 在数据量大时性能下降
- 中文分词质量影响建议与相关度

后续优化方向：
- 引入搜索引擎（如 Elasticsearch）
- 增加同义词词典（别名/俗名）
- 推荐多样性控制（避免同类过于集中）
- A/B 对比不同权重策略
