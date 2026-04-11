# Taxa 与 Favorites API 文档

## 基础信息

- Base URL: `http://localhost:3001/api`
- 响应格式: JSON

## 1. Taxa 分类接口

### 1.1 获取分类列表

- Method: `GET`
- URL: `/taxa`
- Query:
  - `rank` 可选，`family|genus|species`
  - `parent_id` 可选，父分类 ID
  - `keyword` 可选，按中文名/学名模糊搜索

示例:

```http
GET /api/taxa?rank=species&keyword=向日
```

### 1.2 获取分类树

- Method: `GET`
- URL: `/taxa/tree`

### 1.3 获取分类详情

- Method: `GET`
- URL: `/taxa/:id`

### 1.4 创建分类

- Method: `POST`
- URL: `/taxa`
- Body(JSON):

```json
{
  "taxon_rank": "species",
  "parent_id": 4,
  "scientific_name": "Helianthus annuus",
  "chinese_name": "向日葵"
}
```

### 1.5 更新分类

- Method: `PUT`
- URL: `/taxa/:id`
- Body(JSON): 支持部分字段更新

### 1.6 删除分类

- Method: `DELETE`
- URL: `/taxa/:id`
- 约束: 若该分类存在子分类或已关联植物，会返回 400

## 2. Favorites 收藏接口

说明: 所有收藏接口都需要 JWT。

请求头:

```http
Authorization: Bearer <token>
```

### 2.1 获取当前用户收藏

- Method: `GET`
- URL: `/favorites`

### 2.2 新增收藏

- Method: `POST`
- URL: `/favorites`
- Body(JSON):

```json
{
  "plant_id": 1
}
```

### 2.3 取消收藏

- Method: `DELETE`
- URL: `/favorites/:plantId`

## 3. 统一响应格式

成功示例:

```json
{
  "code": 200,
  "message": "获取成功",
  "data": []
}
```

失败示例:

```json
{
  "code": 400,
  "message": "分类不存在"
}
```
