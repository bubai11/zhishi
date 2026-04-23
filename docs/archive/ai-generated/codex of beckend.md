# 后端 / Codex 任务说明（plant_knowledge）

请帮我完善 `plant_knowledge` 数据库，根据前端接口需求文档的 **4.2 节（缺失字段汇总）**，执行以下操作。

---

## 一、步骤 1：数据库迁移

### 1.1 为 `plants` 表新增字段

```sql
ALTER TABLE plants ADD COLUMN category VARCHAR(50) NULL COMMENT '分类标签，如 Tropical/Temperate/Arid';
```

### 1.2 为 `users` 表新增字段

```sql
ALTER TABLE users
  ADD COLUMN level INT DEFAULT 1 COMMENT '用户等级',
  ADD COLUMN points INT DEFAULT 0 COMMENT '积分',
  ADD COLUMN bio TEXT COMMENT '个人简介';
```

### 1.3 创建 `user_achievements` 表

```sql
CREATE TABLE IF NOT EXISTS `user_achievements` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL COMMENT '成就名称',
  `icon` VARCHAR(20) NOT NULL COMMENT '图标emoji',
  `earned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 1.4 检查 `plant_ecology` 表字段是否完整

确保包含以下字段：

| 字段 | 说明 |
|------|------|
| `plant_id` | INT, NOT NULL, UNIQUE |
| `light_tolerance` | INT DEFAULT 50 — 光照需求 |
| `water_requirement` | INT DEFAULT 50 — 水分需求（新增） |
| `temperature_tolerance` | INT DEFAULT 50 — 温度需求 |
| `air_humidity` | INT DEFAULT 50 — 空气湿度 |
| `drought_tolerance` | INT DEFAULT 50 — 耐旱性 |
| `cold_tolerance` | INT DEFAULT 50 — 耐寒性 |

若缺少 `water_requirement` 字段，执行：

```sql
ALTER TABLE plant_ecology ADD COLUMN water_requirement INT DEFAULT 50 AFTER light_tolerance;
```

**产出物：** 生成完整的迁移 SQL 脚本文件：`scripts/db/migrations/001_add_frontend_fields.sql`

---

## 二、步骤 2：植物图片数据填充

### 问题分析

前端需要 `cover_image` 和 `images[]` 数组，但目前数据库中没有图片 URL。


请帮我设计并实现植物图片数据的填充方案。

**背景**

- `plants` 表有 `cover_image` 字段，目前为空
- `plant_media` + `media_assets` 表用于存储多张图片
- 需要为系统中的植物填充图片 URL

**数据来源选项（请分析并推荐）**

| 方案 | 说明 |
|------|------|
| **A** | 植物智 API：`http://www.iplant.cn/api/sp/sci/{scientific_name}`，返回数据中包含 `images` 数组 |
| **B** | 使用公开占位图：Unsplash / Pexels 植物相关图片，按科/属分类匹配 |
| **C** | 手动整理：为核心展示的 20–30 种植物手动下载并上传图片 |

**任务要求**

1. 创建图片下载/生成脚本 `scripts/populate-plant-images.js`
   - 遍历 `plants` 表（优先处理有中文名的）
   - 从植物智 API 获取图片 URL
   - 若 API 无图片，根据科/属名称生成 Unsplash 搜索链接
   - 下载图片到本地 `public/images/plants/`
   - 更新数据库中的 `cover_image` 和 `media_assets` 表
2. 创建图片导入脚本 `scripts/import-plant-images.js`
   - 将本地图片路径转换为 URL
   - 更新 `plants.cover_image`
   - 插入 `media_assets` + `plant_media` 记录
3. 创建图片清理脚本 `scripts/cleanup-missing-images.js`
   - 检测 `cover_image` 为空的植物
   - 输出清单供人工处理

请生成完整的、可直接运行的代码文件。

---

## 三、步骤 3：后端 API 开发

### 3.1 扩展现有接口

请扩展现有的 `GET /api/plants/:id` 接口，增加前端需要的字段。

- **当前 `plants` 表结构**（需提供实际结构）

**需要新增的返回字段**（依据前端接口需求文档 3.3 节）：

```typescript
{
  "id": "1",
  "chinese_name": "桃花",
  "scientific_name": "Prunus persica",
  "family_name": "蔷薇科 (Rosaceae)",      // 需从 wcvp_family + 中文映射
  "genus_name": "李属 (Prunus)",           // 需从 wcvp_genus + 中文映射
  "cover_image": "https://...",
  "taxonomy": {
    "kingdom": "植物界 (Plantae)",
    "phylum": "维管植物 (Tracheophytes)",
    "order": "蔷薇目 (Rosales)",
    "family": "蔷薇科 (Rosaceae)",
    "genus": "李属 (Prunus)",
    "species": "桃 (P. persica)"
  },
  "images": ["https://..."],
  "model_url": null,
  "ecology": {
    "light": 85,           // plant_ecology.light_tolerance
    "water": 60,           // plant_ecology.water_requirement
    "temperature": 70,     // plant_ecology.temperature_tolerance
    "air": 75                // plant_ecology.air_humidity
  },
  "detail": {
    "intro": "...",
    "morphology": "...",
    "ecology_importance": "...",
    "distribution_text": "..."
  },
  "conservation_status": "无危 (LC)",
  "iucn_category": "LC"
}
```

**实现要求**

- 修改 `services/PlantService.js` 中的 `getPlantDetail` 方法
- 添加 `taxonomy` 查询（从 `taxa` 表递归获取分类层级）
- 添加 `images` 查询（`plant_media` + `media_assets` 联查）
- 添加 `ecology` 查询（`plant_ecology` 表）
- 添加 `conservation_status`（`threatened_species` 表，中文显示）
- 统一响应格式：`{ code: 200, message: 'success', data: {...} }`

请生成修改后的完整代码文件。

---

### 3.2 新增接口开发

请根据前端接口需求文档第 **5 节（需新增的接口）**，依次实现以下 **9 个**新接口。

#### 优先级：高（必须实现）

**1. `GET /api/plants/stats`** — 首页平台统计数字

```sql
-- 示例查询
SELECT
  (SELECT COUNT(*) FROM plants WHERE chinese_name IS NOT NULL) AS total_species,
  (SELECT COUNT(*) FROM media_assets) AS total_images,
  (SELECT COUNT(DISTINCT user_id) FROM browse_events WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)) AS active_users;
```

**2. `GET /api/taxa/families`** — 植物库侧边栏科列表 + 计数

```sql
SELECT
  t.chinese_name AS name,
  t.scientific_name,
  COUNT(p.id) AS species_count
FROM taxa t
JOIN plants p ON p.wcvp_family = t.scientific_name
WHERE t.taxon_rank = 'family'
GROUP BY t.id
ORDER BY species_count DESC;
```

**3. `GET /api/user/profile`** — 当前用户完整信息（需 JWT）  
返回 `users` 表字段 + `level` / `points` / `bio`

#### 优先级：中

4. `GET /api/taxa/:id/genera` — 分类树精选属列表  
5. `GET /api/plants/analytics/summary` — 分析页汇总统计  
6. `GET /api/browse-events/weekly-stats` — 7 天学习活跃度（需 JWT）  
7. `GET /api/user/stats` — 成就统计 + 菜单徽章（需 JWT）  
8. `GET /api/quizzes/attempts/me` — 历史测试记录（需 JWT）

#### 优先级：低

9. `GET /api/user/achievements` — 成就勋章列表（需 JWT）

**实现要求**

- 每个接口在 `routes/` 下创建对应路由文件
- 业务逻辑放在 `services/`
- 需要 JWT 的接口使用 `authenticate` 中间件
- 统一响应：`{ code: 200, message: 'success', data: ... }`
- 编写接口测试用例

请生成完整的代码文件。

---

## 四、步骤 4：数据填充优先级

请创建数据填充状态检查脚本 `scripts/check-data-readiness.js`，输出以下信息。

### 检查项

**`plants` 表**

- 总记录数
- 有 `chinese_name` 的记录数及占比
- 有 `cover_image` 的记录数及占比
- 有 `category` 的记录数及占比

**`plant_detail` 表**

- 总记录数
- 各字段完整率（`intro` / `morphology` / `habitat` / `distribution`）

**`plant_ecology` 表**

- 总记录数
- 各维度有值的记录数

**`media_assets` 表**

- 总图片数
- 按 `kind` 分组统计

**`threatened_species` 表**

- 总记录数
- 按 `red_list_category` 分组统计

### 输出格式

生成 Markdown 报告，包含：

- 数据填充进度表格
- 缺失数据清单
- 建议的填充优先级

请生成完整的脚本代码。

---

## 五、执行顺序建议

| 顺序 | 任务 | 负责人 | 预估时间 |
|------|------|--------|----------|
| 1 | 数据库迁移（新增字段 + 表） | Codex | 30 分钟 |
| 2 | 数据填充状态检查 | Codex | 15 分钟 |
| 3 | 植物图片填充脚本 | Codex | 2 小时 |
| 4 | 扩展植物详情接口 | Codex | 1 小时 |
| 5 | 高优先级新接口（3 个） | Codex | 2 小时 |
| 6 | 中优先级新接口（5 个） | Codex | 2 小时 |
| 7 | 接口联调测试 | 你 + Codex | 1 小时 |

---

## 六、关键注意事项

| 注意事项 | 说明 |
|----------|------|
| JWT 认证 | 新增接口如需用户信息，必须添加 `authenticate` 中间件 |
| 响应格式统一 | 所有接口使用 `{ code: 200, message: 'success', data: ... }` |
| 错误处理 | 使用 try-catch，返回 `{ code: 500, message: error.message }` |
| SQL 注入防护 | 使用参数化查询，禁止字符串拼接 |
| 图片 URL | 使用相对路径或配置 base URL |

---

## 七、完成标志

- [ ] 数据库迁移执行成功
- [ ] 数据填充状态报告显示主要字段完整率 > 80%
- [ ] 9 个新接口全部实现并通过测试
- [ ] 植物详情接口返回 `taxonomy` / `ecology` / `images` 字段
- [ ] 前端可正常调用所有接口

完成后告诉我，我帮你安排下一步的前后端联调。
