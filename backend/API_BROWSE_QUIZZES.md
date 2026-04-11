# BrowseEvents 与 Quizzes API 文档

## 基础信息

- Base URL: `http://localhost:3001/api`
- 响应格式: JSON

## 1. BrowseEvents 浏览记录

说明: 浏览记录接口需要 JWT。

请求头:

```http
Authorization: Bearer <token>
```

### 1.1 获取当前用户浏览记录

- Method: `GET`
- URL: `/browse-events`
- Query:
  - `page` 可选，默认 `1`
  - `limit` 可选，默认 `20`

### 1.2 创建浏览记录

- Method: `POST`
- URL: `/browse-events`
- Body(JSON):

```json
{
  "plant_id": 1,
  "source": "detail_page",
  "duration": 35
}
```

### 1.3 删除浏览记录

- Method: `DELETE`
- URL: `/browse-events/:id`

## 2. Quizzes 测验

### 2.1 获取测验列表

- Method: `GET`
- URL: `/quizzes`

### 2.2 获取测验详情

- Method: `GET`
- URL: `/quizzes/:id`
- 返回: 包含 `questions` 与 `options`

### 2.3 创建测验

- Method: `POST`
- URL: `/quizzes`
- Body(JSON):

```json
{
  "title": "植物基础测验",
  "scope": "basic",
  "questions": [
    {
      "type": "single",
      "stem": "向日葵常见花色是？",
      "explanation": "向日葵花瓣通常为黄色",
      "options": [
        { "text": "黄色", "is_correct": true },
        { "text": "蓝色", "is_correct": false }
      ]
    }
  ]
}
```

### 2.4 提交当前用户作答

说明: 需要 JWT。

- Method: `POST`
- URL: `/quizzes/:id/attempts`
- Body(JSON):

```json
{
  "answers": [
    { "question_id": 1, "chosen_option_id": 2 },
    { "question_id": 2, "chosen_option_id": 6 }
  ]
}
```

### 2.5 获取当前用户作答历史

说明: 需要 JWT。

- Method: `GET`
- URL: `/quizzes/:id/attempts/me`

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
  "message": "参数错误"
}
```
