# 知识库全网搜索建库功能 — 实施计划

## 需求

在 GEO 知识库标签页中，新增「全网搜索」按钮。用户输入一个主题（如"新疆旅游攻略"），系统自动：
1. 调用搜索 API 获取相关网页结果
2. 抓取每个结果的网页内容
3. 用 AI 提取和结构化有价值的信息
4. 自动存入 BrandKnowledge 表

## 现状分析

- **无搜索 API 集成**：项目中没有 web search / SERP 相关服务
- **无网页抓取能力**：没有 axios/fetch/cheerio 等爬虫库
- **AI Provider**：使用 GLM（智谱），基于 Anthropic SDK，支持 `tools` 参数传入 `web_search`
- **知识库已有**：BrandKnowledge 模型 + 完整 CRUD + AI 生成器

## 技术方案

### 搜索引擎选择：GLM web_search 优先 + SearXNG 降级

**主方案**：利用 GLM 模型原生的 `web_search` 工具能力。智谱 AI 的 GLM-4 系列支持在 API 调用中启用 `web_search` 工具，模型会自动联网搜索并返回结果。零成本、零额外依赖。

**降级方案**：如果 GLM web_search 不可用，使用免费的 SearXNG 公共实例进行搜索，配合 Node.js 内置 fetch 抓取页面内容。

**用户确认**：两者都支持。

### 架构设计

```
用户输入主题 → 后端接收 → GLM web_search 搜索 → AI 提取结构化知识 → 存入 BrandKnowledge
```

## 实施步骤

### 阶段 1：搜索服务（后端）

**1.1 创建搜索服务 `packages/server/src/services/webSearch.ts`**
- `searchWeb(topic: string, count?: number)` — 使用 GLM web_search 进行搜索
- 先尝试 GLM 原生 web_search，失败则降级到 SearXNG 公共实例
- 返回搜索结果列表（标题、URL、摘要）

**1.2 创建知识提取生成器 `packages/server/src/services/ai/generators/webKnowledgeGenerate.ts`**
- `extractKnowledgeFromSearch(topic: string, searchResults: SearchResult[])`
- 将搜索结果喂给 AI，提取结构化知识条目
- 自动分类、去重（与已有 BrandKnowledge 比较）
- 返回 `{ items: GeneratedKnowledge[] }`

**1.3 添加后端路由 `POST /api/v1/geo/knowledge/search-and-build`**
- 接收 `{ topic, count?, category? }`
- 调用搜索 → 调用 AI 提取 → 批量写入 BrandKnowledge
- 使用已有的 task 异步模式（runTask/getTask）
- 添加 SSE 进度通知

### 阶段 2：前端 UI

**2.1 修改知识库标签页 — 添加搜索入口**
- 在 filter-bar 中添加「🔍 全网搜索」按钮
- 点击后弹出一个搜索对话框/面板
- 输入：主题 + 可选分类 + 可选数量
- 点击搜索后显示进度（搜索中 → 提取中 → 写入中）

**2.2 添加搜索进度展示**
- 复用已有的 task 轮询模式（handleGenerateKnowledge 类似）
- 显示搜索到了多少条结果、提取了多少条知识

### 阶段 3：类型和配置

**3.1 更新 shared-schema.ts**
- 添加 `WebSearchResult` 类型
- 添加 `SEARCH_AND_BUILD_KNOWLEDGE` API 路由常量

**3.2 更新 .env.example**
- 添加 `SEARXNG_URL` 配置（降级方案用）

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/server/src/services/webSearch.ts` | 新建 | 搜索服务 |
| `packages/server/src/services/ai/generators/webKnowledgeGenerate.ts` | 新建 | 知识提取生成器 |
| `packages/server/src/routes/modules/geo.ts` | 修改 | 添加路由 |
| `packages/client/src/api/geo.ts` | 修改 | 添加 API |
| `packages/client/src/stores/geo.ts` | 修改 | 添加状态 |
| `packages/client/src/views/GeoView.vue` | 修改 | 添加 UI |
| `packages/shared/src/shared-schema.ts` | 修改 | 添加类型 |
| `packages/server/.env.example` | 修改 | 添加配置 |

## 风险评估

- **低风险**：复用已有 task 异步模式、BrandKnowledge 模型、AI Provider
- **唯一不确定性**：GLM web_search 工具的 API 调用格式，需要查阅文档确认
- **降级保障**：SearXNG 公共实例作为搜索降级方案

## 预计耗时

约 30-40 分钟，8 个文件改动。
