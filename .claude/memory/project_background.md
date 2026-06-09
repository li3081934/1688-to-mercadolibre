---
name: project-background
description: "Project overview — 1688 product collection, category mapping, Excel export, ML listing"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0eed0454-5f04-4b22-80a4-4238ceaa2475
---

## 项目概述

1688 商品采集到 Mercado Libre 刊登的辅助工具。

### 技术栈

- **框架:** Next.js 15 (App Router)
- **语言:** TypeScript
- **数据库:** SQLite (better-sqlite3)
- **样式:** CSS custom properties, 无 UI 框架

### 核心流程

1. **1688 采集** — 通过浏览器扩展采集 1688 商品数据 → ZIP 包上传
2. **数据解析** — ZIP 解压 → 主 JSON + SKU JSON + 图片
3. **分类映射** — 本地分类管理（Excel 模板 + AI 填写）
4. **Excel 导出** — AI 大模型填写分类模板 → 生成 xlsx
5. **美客多刊登（开发中）** — OAuth 认证 → 分类映射 → POST /items 刊登

### 目录结构

| 目录 | 说明 |
|---|---|
| `app/` | Next.js 页面和 API 路由 |
| `lib/` | 核心逻辑：db, products, storage, excel, mercadolibre, mappers |
| `extension/` | 1688 商品采集浏览器扩展（content script + popup） |
| `scripts/` | 工具脚本 |
| `storage/` | 上传的 ZIP 和提取数据的存储目录（gitignored） |