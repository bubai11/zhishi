# 植物模块 RESTful API 文档

## 基础信息
- **基础 URL**: `http://localhost:3001/api/plants`
- **数据格式**: JSON

## 接口列表

### 1. 获取所有植物（分页）
**请求**
```
GET /api/plants?page=1&limit=10&keyword=
```

**查询参数**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| limit | number | 10 | 每页数量 |
| keyword | string | "" | 搜索关键词（模糊匹配中文名称） |

**响应示例**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10,
    "data": [
      {
        "id": 1,
        "taxon_id": 5,
        "chinese_name": "向日葵",
        "scientific_name": "Helianthus annuus",
        "cover_image": "http://...",
        "short_desc": "向日葵是一种高大的植物...",
        "created_at": "2026-03-19T12:00:00.000Z",
        "taxon": {
          "id": 5,
          "taxon_rank": "species",
          "scientific_name": "Helianthus annuus",
          "chinese_name": "向日葵"
        },
        "detail": {
          "plant_id": 1,
          "intro": "向日葵介绍...",
          "morphology": "向日葵形态描述...",
          "lifecycle": "向日葵生活周期...",
          "habitat": "向日葵栖息地...",
          "distribution": "向日葵分布...",
          "uses": "向日葵用途..."
        }
      }
    ]
  }
}
```

### 2. 获取单个植物详情
**请求**
```
GET /api/plants/:id
```

**路径参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 植物 ID |

**响应示例**
```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "id": 1,
    "taxon_id": 5,
    "chinese_name": "向日葵",
    "scientific_name": "Helianthus annuus",
    "cover_image": "http://...",
    "short_desc": "向日葵是一种高大的植物...",
    "created_at": "2026-03-19T12:00:00.000Z",
    "taxon": { ... },
    "detail": { ... }
  }
}
```

### 3. 创建植物
**请求**
```
POST /api/plants
Content-Type: application/json
```

**请求体**
```json
{
  "taxon_id": 5,
  "chinese_name": "向日葵",
  "scientific_name": "Helianthus annuus",
  "cover_image": "http://...",
  "short_desc": "向日葵是一种高大的植物...",
  "intro": "向日葵介绍...",
  "morphology": "向日葵形态描述...",
  "lifecycle": "向日葵生活周期...",
  "habitat": "向日葵栖息地...",
  "distribution": "向日葵分布...",
  "uses": "向日葵用途..."
}
```

**响应示例**
```json
{
  "code": 201,
  "message": "创建成功",
  "data": { ... }
}
```

### 4. 更新植物
**请求**
```
PUT /api/plants/:id
Content-Type: application/json
```

**请求体**（可选字段）
```json
{
  "chinese_name": "向日葵（修改）",
  "scientific_name": "新学名",
  "cover_image": "新图片URL",
  "short_desc": "新简介",
  "intro": "新介绍",
  "morphology": "新形态"
}
```

**响应示例**
```json
{
  "code": 200,
  "message": "更新成功",
  "data": { ... }
}
```

### 5. 删除植物
**请求**
```
DELETE /api/plants/:id
```

**响应示例**
```json
{
  "code": 200,
  "message": "删除成功",
  "data": {
    "id": 1,
    "message": "删除成功"
  }
}
```

## 错误响应

### 4xx 错误
```json
{
  "code": 404,
  "message": "植物不存在"
}
```

### 5xx 错误
```json
{
  "code": 500,
  "message": "获取失败"
}
```

## 联表关系说明
- **taxon**: 分类信息（通过 `taxon_id` 关联到 `taxa` 表）
- **detail**: 植物详细信息（一对一，存储在 `plant_detail` 表）

## 使用示例

### cURL
```bash
# 获取植物列表
curl -X GET "http://localhost:3001/api/plants?page=1&limit=10"

# 获取单个植物
curl -X GET "http://localhost:3001/api/plants/1"

# 创建植物
curl -X POST "http://localhost:3001/api/plants" \
  -H "Content-Type: application/json" \
  -d '{
    "taxon_id": 5,
    "chinese_name": "向日葵",
    "scientific_name": "Helianthus annuus"
  }'

# 更新植物
curl -X PUT "http://localhost:3001/api/plants/1" \
  -H "Content-Type: application/json" \
  -d '{"chinese_name": "向日葵（修改）"}'

# 删除植物
curl -X DELETE "http://localhost:3001/api/plants/1"
```

### Node.js (axios)
```javascript
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

// 获取植物列表
api.get('/plants', { params: { page: 1, limit: 10 } });

// 获取单个植物
api.get('/plants/1');

// 创建植物
api.post('/plants', {
  taxon_id: 5,
  chinese_name: '向日葵',
  scientific_name: 'Helianthus annuus'
});

// 更新植物
api.put('/plants/1', { chinese_name: '向日葵（修改）' });

// 删除植物
api.delete('/plants/1');
```
