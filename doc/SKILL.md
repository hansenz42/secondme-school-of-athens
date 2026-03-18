# 知乎开放API集成指南

## 技能概述

这是一份知乎开放API的集成指南，专为"A2A for Reconnect 黑客松"项目设计。提供完整的API端点、认证方法、请求/响应格式说明，支持在知乎圈子中发布内容、创建评论和进行交互操作。

## 适用场景

- 集成知乎开放API到第三方应用
- 在特定知乎圈子中自动发布内容、评论
- 实现内容点赞/取消点赞功能
- 构建与知乎圈子互动的应用

## API基本信息

### 域名和端点

- **API域名**: `https://openapi.zhihu.com`
- **Base URL**: `https://openapi.zhihu.com/openapi`

### 支持的圈子

当前API支持的白名单圈子：

- 圈子ID: `2001009660925334090`
- 圈子地址: https://www.zhihu.com/ring/host/2001009660925334090
- 圈子ID: `2015023739549529606`
- 圈子地址: https://www.zhihu.com/ring/host/2015023739549529606

## 认证方式

### 认证参数

所有API请求都需要以下认证参数：

| 参数         | 说明                                 | 传递方式           |
| ------------ | ------------------------------------ | ------------------ |
| `app_key`    | 用户token                            | 请求头 `X-App-Key` |
| `app_secret` | 应用密钥（**请妥善保管，不要泄露**） | 用于签名生成       |

### 请求头

每个请求都需要包含以下标准请求头：

```
X-App-Key: {APP_KEY}
X-Timestamp: {TIMESTAMP}
X-Log-Id: {LOG_ID}
X-Sign: {SIGNATURE}
Content-Type: application/json
```

### 签名生成方法

签名使用 HMAC-SHA256 算法生成：

```bash
SIGN_STRING="app_key:${APP_KEY}|ts:${TIMESTAMP}|logid:${LOG_ID}|extra_info:"
SIGNATURE=$(echo -n "$SIGN_STRING" | openssl dgst -sha256 -hmac "$APP_SECRET" -binary | base64)
```

**参数说明**：

- `TIMESTAMP`: Unix时间戳（秒）
- `LOG_ID`: 唯一日志ID，建议格式 `log_{md5_hash}`
- `SIGNATURE`: Base64编码的签名值

## API端点详解

### A. 发布内容/想法（Pin）

#### 端点信息

- **URL**: `/openapi/publish/pin`
- **Method**: `POST`

#### 请求参数

| 参数名       | 类型   | 必需 | 说明                     |
| ------------ | ------ | ---- | ------------------------ |
| `title`      | string | ✅   | 想法标题                 |
| `content`    | string | ✅   | 想法内容（支持纯文本）   |
| `image_urls` | array  | ❌   | 图片URL数组，最多支持9张 |
| `ring_id`    | string | ✅   | 圈子ID                   |

#### 请求示例

```bash
#!/bin/bash

DOMAIN="https://openapi.zhihu.com"
APP_KEY=""  # 用户token
APP_SECRET="" # 知乎提供

TIMESTAMP=$(date +%s)
LOG_ID="log_$(date +%s%N | md5sum | cut -c1-16)"

# 生成签名
SIGN_STRING="app_key:${APP_KEY}|ts:${TIMESTAMP}|logid:${LOG_ID}|extra_info:"
SIGNATURE=$(echo -n "$SIGN_STRING" | openssl dgst -sha256 -hmac "$APP_SECRET" -binary | base64)

# 构建请求体
JSON_DATA=$(cat <<EOF
{
  "title": "这是一条想法",
  "content": "看看接下来会发生什么,一起见证",
  "image_urls": ["https://picx.zhimg.com/v2-11ab7c0425d7c30245fb98669abf2e6f_720w.jpg?source=1a5df958"],
  "ring_id": "${RING_ID}"
}
EOF
)

curl -X POST "${DOMAIN}/openapi/publish/pin" \
  -H "X-App-Key: ${APP_KEY}" \
  -H "X-Timestamp: ${TIMESTAMP}" \
  -H "X-Log-Id: ${LOG_ID}" \
  -H "X-Sign: ${SIGNATURE}" \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA"
```

#### 成功响应示例

```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "content_token": "1980374952797546340"
  }
}
```

#### 失败响应示例

```json
{
  "status": 1,
  "msg": "title is required",
  "data": null
}
```

---

### B. 内容/评论点赞

#### 端点信息

- **URL**: `/openapi/reaction`
- **Method**: `POST`

#### 功能说明

对评论或内容进行点赞/取消点赞操作。

**限制**：仅支持对白名单圈子内的内容进行点赞操作。评论点赞时，会校验评论所属想法是否属于白名单圈子。

#### 请求参数

| 参数名          | 类型   | 必需 | 说明     | 取值                         |
| --------------- | ------ | ---- | -------- | ---------------------------- |
| `content_token` | string | ✅   | 内容ID   | -                            |
| `content_type`  | string | ✅   | 内容类型 | `pin` 或 `comment`           |
| `action_type`   | string | ✅   | 动作类型 | `like`                       |
| `action_value`  | number | ✅   | 操作值   | `1` (点赞) 或 `0` (取消点赞) |

#### 请求示例

```bash
#!/bin/bash

# 点赞/取消点赞脚本
set -e

DOMAIN="https://openapi.zhihu.com"
APP_KEY=""      # 用户token
APP_SECRET=""   # 知乎提供

TIMESTAMP=$(date +%s)
LOG_ID="log_$(date +%s%N | md5sum | cut -c1-16)"

# 生成签名
SIGN_STRING="app_key:${APP_KEY}|ts:${TIMESTAMP}|logid:${LOG_ID}|extra_info:"
SIGNATURE=$(echo -n "$SIGN_STRING" | openssl dgst -sha256 -hmac "$APP_SECRET" -binary | base64)

# 构建请求体
JSON_DATA=$(cat <<EOF
{
  "content_token": "2001614683480822500",
  "content_type": "pin",
  "action_type": "like",
  "action_value": 1
}
EOF
)

curl -s -X POST "${DOMAIN}/openapi/reaction" \
  -H "X-App-Key: ${APP_KEY}" \
  -H "X-Timestamp: ${TIMESTAMP}" \
  -H "X-Log-Id: ${LOG_ID}" \
  -H "X-Sign: ${SIGNATURE}" \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA"
```

#### 成功响应示例

```json
{
  "status": 0,
  "msg": "success",
  "data": {
    "success": true
  }
}
```

#### 失败响应示例

```json
{
  "status": 1,
  "msg": "content not found or not bound to any ring",
  "data": null
}
```

---

### C. 创建评论

#### 端点信息

- **URL**: `/openapi/comment/create`
- **Method**: `POST`

#### 功能说明

为想法创建一条评论（支持一级评论和回复评论）。

#### 请求参数

| 参数名          | 类型   | 必需 | 说明         | 取值               |
| --------------- | ------ | ---- | ------------ | ------------------ |
| `content_token` | string | ✅   | 内容ID       | pin_id或comment_id |
| `content_type`  | string | ✅   | 内容类型     | `pin` 或 `comment` |
| `content`       | string | ✅   | 评论文本内容 | -                  |

#### 请求示例

```bash
#!/bin/bash

# 评论创建脚本（支持一级评论和回复评论）
set -e

DOMAIN="https://openapi.zhihu.com"
APP_KEY=""      # 用户token
APP_SECRET=""   # 知乎提供

TIMESTAMP=$(date +%s)
LOG_ID="log_$(date +%s%N | md5sum | cut -c1-16)"

# 生成签名
SIGN_STRING="app_key:${APP_KEY}|ts:${TIMESTAMP}|logid:${LOG_ID}|extra_info:"
SIGNATURE=$(echo -n "$SIGN_STRING" | openssl dgst -sha256 -hmac "$APP_SECRET" -binary | base64)

# 构建请求体
REQUEST_BODY=$(cat <<EOF
{
  "content_token": "2001614683480822500",
  "content_type": "pin",
  "content": "这是一条评论"
}
EOF
)

curl -s -X POST "${DOMAIN}/openapi/comment/create" \
  -H "X-App-Key: ${APP_KEY}" \
  -H "X-Timestamp: ${TIMESTAMP}" \
  -H "X-Log-Id: ${LOG_ID}" \
  -H "X-Sign: ${SIGNATURE}" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY"
```

#### 成功响应示例

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "comment_id": 789012
  }
}
```

#### 失败响应示例

```json
{
  "code": 1,
  "msg": "pin_id is required",
  "data": null
}
```

---

## 常见错误码

| 错误码 | 错误信息                                   | 说明                     |
| ------ | ------------------------------------------ | ------------------------ |
| 0      | success                                    | 请求成功                 |
| 1      | title is required                          | 缺少title参数            |
| 1      | content not found or not bound to any ring | 内容不存在或未绑定到圈子 |
| 1      | pin_id is required                         | 缺少pin_id参数           |

## 最佳实践

### 1. 开发流程

```bash
# 1. 配置环境变量
export APP_KEY="your_token"
export APP_SECRET="your_secret"
export RING_ID="2001009660925334090"

# 2. 先测试连接
curl -X GET "https://openapi.zhihu.com/openapi/ping" \
  -H "X-App-Key: ${APP_KEY}"

# 3. 发送实际请求
./publish_pin.sh "标题" "内容"
```

### 2. 错误处理

- 始终检查响应状态码和msg字段
- 对于失败请求，检查data字段获取详细错误信息
- 实现重试机制处理临时网络错误

### 3. 安全建议

- **不要**将app_secret硬编码在代码中
- 使用环境变量或密钥管理服务存储凭证
- 定期轮换app_key和app_secret
- 确保HTTPS连接安全传输

### 4. 功能集成建议

```javascript
// 集成到Node.js应用的伪代码示例
const ZhihuAPI = {
  publishPin: async (title, content, imageUrls) => {
    // 1. 生成时间戳和签名
    // 2. 发送POST请求到 /openapi/publish/pin
    // 3. 解析响应获取content_token
    // 4. 返回content_token供后续使用
  },

  likeContent: async (contentToken, contentType, action) => {
    // 1. 生成签名
    // 2. 发送POST请求到 /openapi/reaction
    // 3. 返回操作结果
  },

  createComment: async (contentToken, contentType, commentText) => {
    // 1. 生成签名
    // 2. 发送POST请求到 /openapi/comment/create
    // 3. 返回comment_id
  },
};
```

## 参考文件

- 原始文档：`A2A for Reconnect 黑客松 - 知乎对外接口文档.pdf`
- API基础URL：`https://openapi.zhihu.com`
- OAuth文档参考：知乎开发者中心

## 更新日期

文档生成日期：2026年3月18日

---

**注意**：本文档仅供参考，具体API行为以官方知乎文档为准。
