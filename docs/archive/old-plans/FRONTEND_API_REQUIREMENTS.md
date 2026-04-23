# 前端接口需求文档
## 植识平台 (frontend-aistudio) — API 对接分析报告

> 生成时间：2026-03-29
> 分析对象：`frontend-aistudio/`（React 19 + TypeScript，Stitch + AI Studio 生成）
> 说明：该前端目前 100% 使用硬编码 mock 数据，无实际 API 调用。以下接口需求均从 UI 展示的数据结构逆向推导。

---

## 一、整体架构分析

### 技术栈

| 层面 | 技术 |
|---|---|
| 框架 | **React 19** + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 4 |
| 动画 | Motion/React (Framer Motion v12) |
| 图标 | Lucide React |
| AI集成 | @google/genai（已声明但组件中未调用） |
| 路由 | 无 React Router — 通过 `App.tsx` 的 `currentPage` state + switch 做页面切换 |
| 状态管理 | 全部为组件本地 useState，无全局 store |

### 目录结构

```
frontend-aistudio/
├── src/
│   ├── App.tsx              # 根组件，页面路由 switch
│   ├── constants.ts         # 静态 mock 数据（Plant 接口定义、示例植物）
│   ├── components/
│   │   ├── Navbar.tsx       # 导航栏（6个页面入口）
│   │   ├── Home.tsx         # 首页（搜索 + 热门植物 + 统计数据）
│   │   ├── Library.tsx      # 植物库列表页（分类筛选 + 搜索 + 分页）
│   │   ├── PlantDetail.tsx  # 植物详情页（图库 + 3D模型 + 分类卡 + 雷达图 + 地图）
│   │   ├── Classification.tsx # 分类树页（可交互可视化树 + 节点详情面板）
│   │   ├── Analysis.tsx     # 可视化分析页（全球分布热力图 + 生态韧性雷达图）
│   │   ├── LearningCenter.tsx # 学习中心（收藏/浏览记录/知识测试）
│   │   ├── UserProfile.tsx  # 个人中心（用户信息 + 成就 + 菜单）
│   │   └── Footer.tsx       # 页脚
│   └── index.css
```

### 页面导航结构

```
首页 (home)
├── → 植物库 (library)
│     └── → 植物详情 (detail)
├── → 分类系统 (classification)
│     └── → 植物详情 (detail)
├── → 可视化分析 (analysis)
├── → 学习中心 (learning)
│     ├── 收藏列表 tab
│     ├── 学习记录 tab
│     └── 知识测试 tab
└── → 个人中心 (profile)
```

---

## 二、页面功能清单与数据需求

### 页面 1：首页 (Home)

**功能：** 搜索框、热门植物卡片网格、平台统计数字、热门搜索标签

**UI 展示的数据字段：**
```typescript
// 植物卡片（首页热门，最多4条）
{
  id: string
  chinese_name: string        // "龟背竹"
  scientific_name: string     // "Monstera deliciosa"
  cover_image: string         // 封面图 URL
  short_desc: string          // 简介文字
  featured_label?: string     // "本周焦点"（特色卡片标签）
}

// 平台统计
{
  total_species: number       // "380k+"
  total_images: number        // "12M+"
  active_users: number        // "45k"
}
```

---

### 页面 2：植物库 (Library)

**功能：** 带科/属分类筛选的植物列表，支持关键词搜索、排序（热门/最新）、分页（48页）

**植物卡片所需字段：**
```typescript
{
  id: string
  chinese_name: string        // "龟背竹"
  scientific_name: string     // "Monstera deliciosa"
  family: string              // "Araceae"（科名，显示在图片角落）
  cover_image: string         // 封面图 URL
  short_desc: string          // 简介（line-clamp-2 截断）
  category?: string           // 分类标签（如 "Tropical"）
}
```

**侧边栏筛选数据：**
```typescript
{
  families: [{ name: string, scientific_name: string, count: number }]
  genera: string[]
  tags: string[]              // "濒危", "热带", "药用"
}
```

**分页：** `{ total: number, page: number, pageSize: number }`

---

### 页面 3：植物详情 (PlantDetail)

**功能：** 图片轮播（4张缩略图）、3D模型入口、科学分类卡（6层级）、环境耐受性雷达图（4维）、全球分布地图、植物学概述、形态特征列表、生态重要性、保护现状标签

**完整数据结构：**
```typescript
interface PlantDetailResponse {
  // 基础信息
  id: string
  chinese_name: string          // "桃花"
  scientific_name: string       // "Prunus persica"

  // 详情页头部标签
  family_name: string           // "蔷薇科 (Rosaceae)"
  genus_name: string            // "李属 (Prunus)"

  // 科学分类卡（完整6层级）
  taxonomy: {
    kingdom: string             // "植物界 (Plantae)"
    phylum?: string             // "维管植物 (Tracheophytes)"
    order: string               // "蔷薇目 (Rosales)"
    family: string              // "蔷薇科 (Rosaceae)"
    genus: string               // "李属 (Prunus)"
    species: string             // "桃 (P. persica)"
  }

  // 媒体资源
  images: string[]              // 图片 URL 数组（轮播+4格缩略图）
  model_url?: string            // 3D 模型文件 URL

  // 环境耐受性雷达图（4维）
  ecology: {
    light: number               // 光照 0-100
    water: number               // 水分 0-100
    temperature: number         // 温度 0-100
    air: number                 // 空气 0-100
  }

  // 详细文本（plant_detail 表）
  detail: {
    intro: string               // 植物学概述（多段落）
    morphology: string          // 形态特征
    ecology_importance: string  // 生态重要性
    distribution_text: string   // 分布文字描述
  }

  // 保护现状
  conservation_status: string   // "无危 (LC)"
  iucn_category: string         // "LC"

  // 地理分布（地图用）
  observations: Array<{
    latitude: number
    longitude: number
    count?: number
  }>
}
```

---

### 页面 4：分类树 (Classification)

**功能：** 可缩放拖拽的交互式分类树（支持缩放 0.5x-2x、拖拽平移）、点击节点查看详情面板、精选属滚动列表

**树节点数据结构（递归）：**
```typescript
interface TaxonomyNode {
  id: string
  name: string                  // 中文名 "被子植物"
  rank: string                  // "门 (Division)"
  scientific_name: string       // "Angiosperms"
  description: string           // 该节点描述
  diversity?: string            // "90%"
  diversity_label?: string      // "的已知植物"
  orders_count?: number         // 下辖目数量
  children?: TaxonomyNode[]
}
```

**精选属列表：**
```typescript
interface FeaturedGenus {
  id: string
  name: string                  // "蔷薇属 (Rosa)"
  family_name: string           // "蔷薇科 (Rosaceae)"
  cover_image: string           // 缩略图 URL
}
```

---

### 页面 5：可视化分析 (Analysis)

**功能：** 全球物种分布（地图视图 + 表格视图切换）、分类学占比条形图、生态韧性雷达图（6维）、汇总统计卡片、濒危物种警报

**数据结构：**
```typescript
// 区域分布（表格视图，5条）
interface RegionalData {
  region: string                // "热带雨林区"
  density_label: string         // "高 (850+ 种/km²)"
  species_count: number         // 124000
  trend: '上升' | '下降' | '稳定'
}

// 分类学占比（条形图）
interface TaxonomyStats {
  name: string                  // "被子植物 (Angiosperms)"
  percentage: number            // 78
}

// 生态韧性雷达图（6维）
interface EcologicalResilience {
  hydration: number             // 水分
  growth_rate: number           // 生长率
  lifespan: number              // 寿命
  pollination: number           // 授粉
  co2_intake: number            // 二氧化碳吸收
  resistance: number            // 抗性
}

// 汇总统计
interface AnalyticsSummary {
  total_species: number         // 391000
  critical_regions: number      // 14
  annual_growth_rate: string    // "+4.2%"
  protected_areas: number       // 1248
}
```

---

### 页面 6：学习中心 (LearningCenter)

**功能：** 收藏列表（含取消收藏）、浏览历史、知识测试（题目/选项/解析/计分）、学习活跃度柱状图（7天）、成就统计

**数据结构：**
```typescript
// 收藏列表
interface FavoriteItem {
  plant_id: string
  chinese_name: string
  scientific_name: string
  cover_image: string
  category: string
  saved_at: string
}

// 浏览历史
interface BrowseRecord {
  plant_id: string
  plant_name: string
  last_viewed_at: string        // "2026-03-21 10:30"
  view_count: number            // 该植物累计浏览次数
}

// 测试题目
interface QuizQuestion {
  id: number
  question: string
  options: string[]             // 4个选项文字
  correct_answer: number        // 正确选项索引（0-based）
  analysis: string              // 解析说明
}

// 历史测试记录
interface QuizRecord {
  date: string
  score: number                 // 0-100
  topic: string
}

// 每周活跃度
interface WeeklyActivity {
  day: string                   // "周一"..."周日"
  value: number                 // 0-100
}

// 成就统计
interface AchievementStats {
  avg_quiz_score: number        // 88
  streak_days: number           // 14
  badges_unlocked: number       // 6
}
```

---

### 页面 7：个人中心 (UserProfile)

**功能：** 用户信息（头像/昵称/邮箱/等级/积分/简介）、成就勋章列表、功能菜单（含徽章数）

**数据结构：**
```typescript
interface UserProfile {
  id: string
  username: string              // "植物探险家"
  email: string
  avatar: string                // 头像 URL
  level: number                 // 8
  points: number                // 1240
  bio?: string                  // 个人简介
}

interface Achievement {
  name: string                  // "初级植物学家"
  icon: string                  // emoji "🌱"
  earned_at: string             // "2026-03-01"
}

interface MenuCounts {
  favorites_count: number       // 12
  notes_count: number           // 5
  notifications_count: number   // 2
}
```

---

## 三、完整 API 接口清单

所有接口统一使用现有后端响应格式：`{ code: number, message: string, data: any }`

### 3.1 首页接口

```
GET /api/plants?sort=popular&page=1&pageSize=4
用途：首页热门植物卡片

响应：
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "1",
        "chinese_name": "龟背竹",
        "scientific_name": "Monstera deliciosa",
        "family": "Araceae",
        "cover_image": "https://...",
        "short_desc": "天南星科植物..."
      }
    ],
    "total": 1402
  }
}
```

```
GET /api/plants/stats
用途：首页平台统计数字（新接口）

响应：
{
  "code": 200,
  "data": {
    "total_species": 380000,
    "total_images": 12000000,
    "active_users": 45000
  }
}
```

---

### 3.2 植物库接口

```
GET /api/plants?page=1&pageSize=20&sort=popular&q=银杏&family=Orchidaceae&genus=Phalaenopsis
用途：植物库列表，多条件筛选

参数：
  page       int     页码，默认1
  pageSize   int     每页条数，默认20
  sort       string  "popular" | "latest"
  q          string  搜索关键词（中文名/学名）
  family     string  按科筛选（学名）
  genus      string  按属筛选

响应：
{
  "code": 200,
  "data": {
    "list": [...],
    "total": 1402,
    "page": 1,
    "pageSize": 20
  }
}
```

```
GET /api/taxa/families
用途：侧边栏科列表（含物种计数，新接口）

响应：
{
  "code": 200,
  "data": [
    { "name": "兰科", "scientific_name": "Orchidaceae", "species_count": 24 },
    { "name": "蔷薇科", "scientific_name": "Rosaceae", "species_count": 18 }
  ]
}
```

```
GET /api/search/suggest?q=银杏
用途：搜索自动补全（现有接口）
```

---

### 3.3 植物详情接口

```
GET /api/plants/:id
用途：植物完整详情（需扩展现有接口，增加 taxonomy/ecology/images 字段）

响应：
{
  "code": 200,
  "data": {
    "id": "1",
    "chinese_name": "桃花",
    "scientific_name": "Prunus persica",
    "family_name": "蔷薇科 (Rosaceae)",
    "genus_name": "李属 (Prunus)",
    "cover_image": "https://...",
    "taxonomy": {
      "kingdom": "植物界 (Plantae)",
      "phylum": "维管植物 (Tracheophytes)",
      "order": "蔷薇目 (Rosales)",
      "family": "蔷薇科 (Rosaceae)",
      "genus": "李属 (Prunus)",
      "species": "桃 (P. persica)"
    },
    "images": ["https://...", "https://..."],
    "model_url": null,
    "ecology": {
      "light": 85,
      "water": 60,
      "temperature": 70,
      "air": 75
    },
    "detail": {
      "intro": "桃（学名：Prunus persica）...",
      "morphology": "高度：4-10米...",
      "ecology_importance": "桃子是早春各种传粉者...",
      "distribution_text": "原产于中国西北部..."
    },
    "conservation_status": "无危 (LC)",
    "iucn_category": "LC"
  }
}
```

```
GET /api/plants/:id/observations
用途：地图分布观测数据（现有接口，直接可用）

响应：
{
  "code": 200,
  "data": [
    { "latitude": 39.9, "longitude": 116.4, "count": 5 }
  ]
}
```

---

### 3.4 分类树接口

```
GET /api/taxonomy/tree
用途：完整分类树（现有接口 tree-with-stats，需调整字段名）

响应：
{
  "code": 200,
  "data": {
    "id": "plantae",
    "name": "植物界",
    "rank": "kingdom",
    "scientific_name": "Plantae",
    "description": "...",
    "diversity": null,
    "diversity_label": null,
    "orders_count": null,
    "children": [
      {
        "id": "angiosperms",
        "name": "被子植物",
        "rank": "phylum",
        "scientific_name": "Angiosperms",
        "diversity": "90%",
        "diversity_label": "的已知植物",
        "orders_count": 64,
        "children": [...]
      }
    ]
  }
}
```

```
GET /api/taxa/:id/genera?limit=10
用途：精选属列表（分类树侧边栏，新接口）

响应：
{
  "code": 200,
  "data": {
    "total": 128,
    "list": [
      {
        "id": "rosa",
        "name": "蔷薇属",
        "scientific_name": "Rosa",
        "family_name": "蔷薇科 (Rosaceae)",
        "cover_image": "https://..."
      }
    ]
  }
}
```

---

### 3.5 可视化分析接口

```
GET /api/wcvp-analytics/diversity?groupBy=division
用途：分类学占比统计（现有接口，调整 groupBy 参数）

响应：
{
  "code": 200,
  "data": [
    { "name": "被子植物", "scientific_name": "Angiosperms", "percentage": 78 },
    { "name": "裸子植物", "scientific_name": "Gymnosperms", "percentage": 12 },
    { "name": "蕨类植物", "scientific_name": "Pteridophytes", "percentage": 6 },
    { "name": "苔藓植物", "scientific_name": "Bryophytes", "percentage": 4 }
  ]
}
```

```
GET /api/wcvp-analytics/heatmap?groupBy=climate_zone
用途：全球分布密度（现有接口，需扩展 trend 字段）

响应：
{
  "code": 200,
  "data": [
    {
      "region": "热带雨林区",
      "density_label": "高 (850+ 种/km²)",
      "species_count": 124000,
      "trend": "稳定"
    }
  ]
}
```

```
GET /api/plants/analytics/summary
用途：分析页汇总数字（新接口）

响应：
{
  "code": 200,
  "data": {
    "total_species": 391000,
    "critical_regions": 14,
    "annual_growth_rate": "+4.2%",
    "protected_areas": 1248
  }
}
```

```
GET /api/redlist/alerts?limit=5
用途：濒危物种警报（现有接口）

响应：
{
  "code": 200,
  "data": {
    "new_count": 2,
    "alerts": [...]
  }
}
```

---

### 3.6 学习中心接口

```
GET /api/favorites                   （需 JWT，现有接口）
用途：当前用户收藏列表

响应：
{
  "code": 200,
  "data": [
    {
      "plant_id": "1",
      "chinese_name": "龟背竹",
      "scientific_name": "Monstera deliciosa",
      "cover_image": "https://...",
      "category": "Tropical",
      "saved_at": "2026-03-21"
    }
  ]
}
```

```
POST /api/favorites                  （需 JWT，现有接口）
Body: { "plant_id": "1" }

DELETE /api/favorites/:plantId       （需 JWT，现有接口）
```

```
GET /api/browse-events?limit=20      （需 JWT，现有接口，需扩展）
用途：浏览历史（需在现有基础上增加 view_count 聚合字段）

响应：
{
  "code": 200,
  "data": [
    {
      "plant_id": "1",
      "plant_name": "龟背竹",
      "last_viewed_at": "2026-03-21 10:30",
      "view_count": 5
    }
  ]
}
```

```
GET /api/browse-events/weekly-stats  （需 JWT，新接口）
用途：学习活跃度7天柱状图

响应：
{
  "code": 200,
  "data": [
    { "day": "周一", "value": 40 },
    { "day": "周二", "value": 60 },
    { "day": "周三", "value": 45 },
    { "day": "周四", "value": 90 },
    { "day": "周五", "value": 65 },
    { "day": "周六", "value": 80 },
    { "day": "周日", "value": 55 }
  ]
}
```

```
GET /api/quizzes/:id                 （现有接口）
用途：测试题目（注意：correct_answer 建议在提交答案后才返回，避免前端泄露答案）

响应：
{
  "code": 200,
  "data": {
    "id": "1",
    "title": "综合植物知识",
    "questions": [
      {
        "id": 1,
        "question": "下列哪种植物被称为"活化石"？",
        "options": ["龟背竹", "银杏", "红枫", "蝴蝶兰"],
        "analysis": "银杏（Ginkgo biloba）..."
      }
    ]
  }
}
```

```
POST /api/quizzes/:id/attempts       （需 JWT，现有接口）
Body: { "answers": [{ "question_id": 1, "chosen_option_id": 2 }] }

响应：
{
  "code": 200,
  "data": {
    "score": 100,
    "total": 3,
    "correct_count": 3,
    "results": [
      { "question_id": 1, "correct": true, "correct_answer": 1, "analysis": "..." }
    ]
  }
}
```

```
GET /api/quizzes/attempts/me         （需 JWT，新接口）
用途：历史测试记录列表

响应：
{
  "code": 200,
  "data": [
    { "date": "2026-03-15", "score": 100, "topic": "基础植物学" },
    { "date": "2026-03-10", "score": 66, "topic": "热带雨林植物" }
  ]
}
```

---

### 3.7 用户中心接口

```
GET /api/user/profile                （需 JWT，新接口）
用途：当前用户完整信息

响应：
{
  "code": 200,
  "data": {
    "id": "1",
    "username": "植物探险家",
    "email": "user@example.com",
    "avatar": "https://...",
    "level": 8,
    "points": 1240,
    "bio": "热爱大自然..."
  }
}
```

```
GET /api/user/stats                  （需 JWT，新接口）
用途：成就统计 + 菜单徽章数量

响应：
{
  "code": 200,
  "data": {
    "avg_quiz_score": 88,
    "streak_days": 14,
    "badges_unlocked": 6,
    "favorites_count": 12,
    "notes_count": 5,
    "notifications_count": 2
  }
}
```

```
GET /api/user/achievements           （需 JWT，新接口）
用途：成就勋章列表

响应：
{
  "code": 200,
  "data": [
    { "name": "初级植物学家", "icon": "🌱", "earned_at": "2026-03-01" },
    { "name": "分类达人",     "icon": "🔍", "earned_at": "2026-03-10" }
  ]
}
```

```
POST /api/user/login                 （现有接口）
Body: { "username": "string", "password": "string" }
响应: { "code": 200, "data": { "token": "...", "username": "..." } }

POST /api/user/register              （现有接口）
Body: { "username": "string", "password": "string", "email": "string" }
```

---

## 四、数据字段匹配度分析

### 4.1 字段覆盖对比

| 前端需求字段 | 数据库表 | 字段名 | 匹配状态 |
|---|---|---|---|
| `chinese_name` | `plants` | `chinese_name` | ✅ 完全匹配 |
| `scientific_name` | `plants` | `scientific_name` | ✅ 完全匹配 |
| `cover_image` | `plants` | `cover_image` | ✅ 完全匹配 |
| `short_desc` | `plants` | `short_desc` | ✅ 完全匹配 |
| `family`（科名） | `plants` | `wcvp_family` | ⚠️ 字段存在但为英文，需中文映射 |
| `genus`（属名） | `plants` | `wcvp_genus` | ⚠️ 同上，需中文映射 |
| `category`（分类标签） | — | — | ❌ **缺失**，无对应字段 |
| `taxonomy.kingdom` | `taxa` | `chinese_name` where rank='kingdom' | ⚠️ 需多表 JOIN 重组 |
| `taxonomy.order` | `taxa` | `chinese_name` where rank='order' | ⚠️ 需多表 JOIN |
| `images[]`（多图） | `media_assets` | `url` | ✅ 需通过 `plant_media` 关联查询 |
| `model_url` | `media_assets` | `url` where kind='model' | ✅ 结构存在 |
| `ecology.light` | `plant_ecology` | `light_tolerance`（需确认列名） | ⚠️ 表存在，列名待验证 |
| `ecology.water` | `plant_ecology` | `drought_tolerance` | ⚠️ 语义需映射（耐旱 → 水分需求反向） |
| `ecology.temperature` | `plant_ecology` | `cold_tolerance` | ⚠️ 语义需映射 |
| `detail.intro` | `plant_detail` | `intro` | ✅ 完全匹配 |
| `detail.morphology` | `plant_detail` | `morphology` | ✅ 完全匹配 |
| `detail.distribution_text` | `plant_detail` | `distribution` | ✅ 完全匹配 |
| `conservation_status` | `threatened_species` | `iucn_category` | ⚠️ 需格式转换（"LC" → "无危 (LC)"） |
| `observations[].lat/lng` | `plant_observations` | `latitude`, `longitude` | ✅ 完全匹配 |
| `families[].species_count` | — | 需 COUNT JOIN | ⚠️ 需聚合查询 |
| `browse_record.view_count` | `browse_events` | — | ❌ **缺失**，需聚合计数 |
| `user.level` | `users` | — | ❌ **缺失**，无 level 字段 |
| `user.points` | `users` | — | ❌ **缺失**，无 points 字段 |
| `user.bio` | `users` | — | ❌ **缺失**，无 bio 字段 |
| `achievements[]` | — | — | ❌ **缺失**，无成就系统表 |
| `weekly_activity[]` | `browse_events` | `created_at` | ⚠️ 需按天聚合计算 |
| `quiz.correct_answer` | `question_options` | `is_correct` | ⚠️ 结构不同，需后端转换为索引 |
| `quiz.analysis` | `questions` | `explanation` | ⚠️ 字段名不同，需映射 |
| `diversity_percent` | `taxonomy_statistics` | `species_ratio` | ⚠️ 字段存在，格式需转换 |

### 4.2 缺失字段汇总（需新增）

**`plants` 表新增字段：**
```sql
ALTER TABLE plants ADD COLUMN category VARCHAR(50) NULL COMMENT '分类标签，如 Tropical/Temperate/Arid';
```

**`users` 表新增字段：**
```sql
ALTER TABLE users
  ADD COLUMN level   INT DEFAULT 1   COMMENT '用户等级',
  ADD COLUMN points  INT DEFAULT 0   COMMENT '积分',
  ADD COLUMN bio     TEXT            COMMENT '个人简介';
```

**新增 `user_achievements` 表：**
```sql
CREATE TABLE user_achievements (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  name       VARCHAR(100) NOT NULL,
  icon       VARCHAR(10)  NOT NULL,
  earned_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4.3 需要后端处理的数据转换

| 转换需求 | 说明 |
|---|---|
| `wcvp_family` → 中文科名 | 需通过 taxa 表 JOIN 或维护英文→中文映射表 |
| `iucn_category` → 中文显示 | `"LC"` → `"无危 (LC)"`，建议后端枚举映射 |
| `explanation` → `analysis` | 字段重命名，API 层做 alias |
| `is_correct` → `correct_answer: index` | 从多条 is_correct=true 记录转换为选项索引（0-based） |
| `browse_events` → `view_count` | 按 `plant_id + user_id` GROUP BY + COUNT |
| `browse_events` → weekly stats | 按 `DATE(created_at)` 聚合最近7天，转换为周一~周日 |
| `plant_ecology` 字段语义 | `drought_tolerance`（耐旱）与"水分需求"语义相反，需新增 `water_requirement` 字段或反向计算 |
| `taxonomy_statistics.species_ratio` → `diversity` | 小数比例转换为百分比字符串格式 |

---

## 五、接口复用 vs 新增汇总

### 可直接复用的现有接口（✅）

| 接口 | 备注 |
|---|---|
| `GET /api/plants?page&q` | 需补充 family/genus 筛选参数 |
| `GET /api/plants/:id` | 需扩展返回 taxonomy/ecology/images 字段 |
| `GET /api/plants/:id/observations` | 直接可用 |
| `GET /api/search/suggest` | 直接可用 |
| `GET /api/taxonomy/tree-with-stats` | 需调整返回字段名以匹配前端期望 |
| `GET /api/favorites` | 需 JWT |
| `POST /api/favorites` | 需 JWT |
| `DELETE /api/favorites/:plantId` | 需 JWT |
| `GET /api/browse-events` | 需扩展 view_count 聚合字段 |
| `GET /api/quizzes/:id` | 需调整字段名（explanation → analysis） |
| `POST /api/quizzes/:id/attempts` | 直接可用 |
| `POST /api/user/login` | 直接可用 |
| `POST /api/user/register` | 直接可用 |
| `GET /api/redlist/alerts` | 直接可用 |
| `GET /api/wcvp-analytics/diversity` | 需调整 groupBy 参数支持 division |
| `GET /api/wcvp-analytics/heatmap` | 需扩展 trend 字段 |

### 需新增的接口（🆕）

| 接口 | 优先级 | 说明 |
|---|---|---|
| `GET /api/plants/stats` | 🔴 高 | 首页平台统计数字 |
| `GET /api/taxa/families` | 🔴 高 | 植物库侧边栏科列表+计数 |
| `GET /api/user/profile` | 🔴 高 | 当前用户完整信息 |
| `GET /api/taxa/:id/genera` | 🟡 中 | 分类树精选属列表 |
| `GET /api/plants/analytics/summary` | 🟡 中 | 分析页汇总统计 |
| `GET /api/browse-events/weekly-stats` | 🟡 中 | 7天学习活跃度 |
| `GET /api/user/stats` | 🟡 中 | 成就统计+菜单徽章 |
| `GET /api/quizzes/attempts/me` | 🟡 中 | 历史测试记录 |
| `GET /api/user/achievements` | 🟢 低 | 成就勋章列表 |

---

*文档版本：v1.0 | 生成日期：2026-03-29*
