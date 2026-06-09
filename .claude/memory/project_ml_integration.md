---
name: ml-integration
description: "Mercado Libre API integration — OAuth flow and category query implemented, pending product listing"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0eed0454-5f04-4b22-80a4-4238ceaa2475
---

## Status: OAuth + 分类查询已实现

### 完成的功能

- **OAuth 2.0 认证流程** (`lib/mercadolibre/auth.ts`)
  - 生成授权跳转链接
  - 回调交换 access_token / refresh_token
  - refresh_token 自动刷新

- **API 客户端** (`lib/mercadolibre/client.ts`)
  - `getSites()` — 查询所有站点
  - `getCategories(siteId)` — 查询顶级分类
  - `getCategoryDetail(categoryId)` — 查询分类详情（含子分类）
  - 自动带 access_token 请求头

- **数据库** (`lib/db.ts`)
  - 新增 `ml_accounts` 表：mlUserId, siteId, accessToken, refreshToken, tokenExpiresAt, nickname

- **API 路由**
  - `GET /api/mercadolibre/auth` — 检查认证状态/返回授权链接
  - `GET /api/mercadolibre/callback` — OAuth 回调处理
  - `GET /api/mercadolibre/categories?siteId=MLA&categoryId=可选` — 分类查询（自动刷新过期 token）

- **前端页面** (`/mercadolibre`)
  - 认证状态展示
  - 登录/重新授权按钮
  - 站点选择（MLA/MLB/MLM/MLC/MCO/MLU/MLP）
  - 顶级分类列表 + 点击展开子分类

### 新建文件

| 文件 | 作用 |
|---|---|
| `lib/mercadolibre/types.ts` | ML API 类型定义 |
| `lib/mercadolibre/auth.ts` | OAuth 认证逻辑 |
| `lib/mercadolibre/client.ts` | API 封装 |
| `app/api/mercadolibre/auth/route.ts` | 认证状态 API |
| `app/api/mercadolibre/callback/route.ts` | OAuth 回调 API |
| `app/api/mercadolibre/categories/route.ts` | 分类查询 API |
| `app/mercadolibre/page.tsx` | 前端管理页面（Client Component） |

### 修改文件

| 文件 | 改动 |
|---|---|
| `lib/db.ts` | 新增 ml_accounts 表 + CRUD |
| `app/layout.tsx` | 顶部导航新增"美客多集成"链接 |
| `.env` | 新增 ML_APP_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI 变量 |

### 下一步（待实现）

1. **商品刊登** — `POST /items` 在指定分类下创建商品
2. **图片上传** — `POST /pictures` 上传商品图片
3. **描述添加** — `POST /items/{id}/description`
4. **SKU 多规格处理** — variations 或 User Products (UP) 模型
5. **Token 刷新优化** — 当前在 API 调用时同步刷新，后续可加定时刷新

### 用户需要做的

- 注册 ngrok（推荐）获取 HTTPS 地址
- 在 [Mercado Libre Developers](https://developers.mercadolibre.com) 创建 App
- 设置 Redirect URI 为 `https://{ngrok域名}/api/mercadolibre/callback`
- 填写 `.env` 中的 `ML_APP_ID`, `ML_CLIENT_SECRET`
- 启动后访问 `/mercadolibre` 完成 OAuth 授权