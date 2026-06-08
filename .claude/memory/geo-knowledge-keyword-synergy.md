---
name: geo-knowledge-keyword-synergy
description: GEO知识库构建引擎v2设计 — 关键词蒸馏与维度拆分互相增强的串联方案
metadata: 
  node_type: memory
  type: project
  originSessionId: f2845ed3-e456-4ab0-8440-55a03fabba33
---

# GEO 知识库构建 v2：关键词与维度互相增强

## 核心理念

关键词蒸馏和维度拆分不是二选一，而是**互相增强**：

```
真实热搜关键词 → 推断维度 → 维度发现盲区 → 补全缺失关键词 → 全面搜索建库
```

- **关键词 → 维度**：真实搜索数据告诉 AI 用户关心的"面"，取代凭空想象
- **维度 → 关键词**：维度帮你发现盲区，主动补全未覆盖的关键词

## 背景

SEO 逻辑：关键词 → 内容 → 搜索排名
GEO 逻辑：知识权威性 → AI 引用 → 品牌提及

两条业务线应该串联：
1. **关键词蒸馏** — 发现高价值关键词，了解用户意图
2. **知识库构建** — 用蒸馏后的关键词驱动搜索，建立权威知识
3. **内容生成** — 基于知识库素材，生成 AI 容易引用的结构化内容

## 当前系统状态

- ✅ 评估规划步骤已实现（去掉数量限制，先评估再确认）
- ✅ Pipeline 从 6 步变 7 步（新增 evaluation）
- ✅ 前端评估方案面板已实现
- 🔲 关键词蒸馏 → 知识库构建的串联
- 🔲 用真实关键词辅助维度推断 + 维度反向补全关键词

## v2 Pipeline 设计

```
步骤0: 评估规划 — 确定主题规模，获取已有蒸馏关键词
步骤1: 关键词增强维度拆分 — 关键词推断维度 + 维度补全关键词（新增逻辑）
步骤2: 多维搜索 — 用完整关键词列表搜索（不是用维度搜索）
步骤3: 可信度筛选
步骤4: 语义去重
步骤5: AI 完善
步骤6: 入库
```

### 评估步骤新逻辑

```
输入主题
  ↓
获取已有蒸馏关键词（如果有）
  ↓
AI 分析关键词 → 推断维度（基于真实数据）
  ↓
维度回查 → 发现关键词未覆盖的维度
  ↓
为缺失维度生成补充关键词
  ↓
输出：维度列表（展示用） + 完整关键词列表（搜索用，原始+补全）
```

### 搜索时用关键词，展示时用维度

- 关键词 = 搜索查询（精准）
- 维度 = 面板展示（结构化概览）

## 相关文件

- `packages/server/src/services/knowledgeBuilder/stepEvaluate.ts` — 评估步骤
- `packages/server/src/services/knowledgeBuilder/stepDimensionSplit.ts` — 维度拆分
- `packages/server/src/services/knowledgeBuilder/pipeline.ts` — Pipeline 编排
- `packages/server/src/services/ai/generators/keywordDistillGenerate.ts` — 关键词蒸馏
- `packages/client/src/views/KnowledgeBuildView.vue` — 构建页面
- `packages/client/src/stores/knowledgeBuild.ts` — 构建 Store

## 决策记录

- 2026-06-05: 去掉知识库构建的数量限制，改为 AI 先评估再确认
- 2026-06-05: 确定关键词与维度互相增强的方向，不二选一
- 2026-06-05: 确认 GEO 和 SEO 逻辑差异（知识权威性 vs 关键词匹配）
- 2026-06-06: 已实现关键词蒸馏→维度推断的串联（stepEvaluate + stepMultiSearch）
- 2026-06-06: 确认下一步方向：递归知识树 [[recursive-knowledge-tree]]
