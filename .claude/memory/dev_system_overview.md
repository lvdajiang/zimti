---
name: dev-system-overview
description: 开发体系全貌：技能卡体系、Subagent 模式、工作流、计划系统
metadata: 
  node_type: memory
  type: project
  originSessionId: 2ccade32-d359-46e2-8919-72ae80ae6593
---

# 开发体系全貌

## 技能卡体系

总计 **97 个技能目录**（含 wf 子命令快捷方式），分以下大类：

### 行为规则类（17 个）
refine, init-schema, design-spec, design-detail, design-page, data-flow, tech-spec, align, plan-first, plan, brainstorming, ui-ux-pro-max, system-architect, value-analyst, design-engineer, code-implementation, dev-page

### 分析审查类 — Subagent 模式（10 个）
project-review, req-review, spec-review, design-review, dataflow-review, techspec-review, code-review, check-page, component-check, perf-check, deploy-check, regression, security-review, security-scan, status

### 修复执行类（2 个）
xgbug, code-fix

### 工作流类（8 个）
wf (入口), wf-new, wf-bug, wf-dev, wf-algo, wf-deploy, wf-day-start, wf-review, wf-batch

### 工具类（12 个）
run, bushu, db, git-clean, save-ctx, load-ctx, scan-algo, model-pick, import-docx, import-excel, help-gen, sync-page

### 后端/架构模式类（12 个）
backend-patterns, frontend-patterns, postgres-patterns, clickhouse-io, docker-patterns, deployment-patterns, database-migrations, python-patterns, python-testing, content-hash-cache-pattern, cost-aware-llm-pipeline, tdd-workflow

### 专项技能类（15+ 个）
e2e-testing, test-driven-development, continuous-learning, continuous-learning-v2, iterative-retrieval, regex-vs-llm-structured-text, nutrient-document-processing, document-generation, visa-doc-translate, eval-harness, writing-plans, writing-skills, api-design, coding-standards, project-guidelines-example

### 质量保障类（10 个）
quality-engineer, receiving-code-review, requesting-code-review, finishing-a-development-branch, verification-analysis, verification-before-completion, verification-loop, strategic-compact, search-first, systematic-debugging

### Subagent 模式类（3 个）
subagent-driven-development, dispatching-parallel-agents, task-orchestrator

### 其他
adopt (项目接驳), init-project (初始化), skill-stocktake, retro, using-superpowers, using-git-worktrees, everything-claude-code

## Subagent 模式
以下技能通过 Agent tool 在独立上下文中执行，不占用主窗口：
- scan-algo, check-page, component-check, perf-check, deploy-check, code-review
- regression, status, project-review, code-fix
- subagent-driven-development（两阶段审查：规格合规 + 代码质量）

## Hooks 机制
- **schema-check.ts**: `scripts/schema-check.ts` 检查源码是否与 shared-schema.ts 对齐
- **pre-commit hook**: CLAUDE.md 提到已配置，但实际未找到 husky/lint-staged 配置（可能丢失）
- **settings.json**: 不存在（权限/模型配置可能丢失）

## Agent Team（并行策略）
- /wf review 使用双 Subagent 并行扫描（code-review + scan-bugs）
- /dispatching-parallel-agents 面对独立问题时并行派发
- 所有并行要求：任务间无共享状态、无顺序依赖

## 全自动流水线
- /wf-full [页面名]: design-spec → design-detail → design-page → data-flow → tech-spec → plan-first → check-page → 部署
- /wf-new [需求]: align → plan-first(施工图+自动施工) → check-page → perf-check → component-check → deploy-check → bushu
- 每步自动审查，失败才暂停

## 计划系统
- /plan-first: Tech Spec → PLAN.md → 逐任务自动施工
- 严格依赖链分层：数据层 → 后端 → 测试 → 共享类型 → API → Store → 叶组件 → 组合组件 → 页面 → 联调
- 自动修复最多 3 次，失败暂停

## 自定义工具
- .claude/tools/ 目录不存在
- schema-check.ts 是唯一的自定义检查脚本
