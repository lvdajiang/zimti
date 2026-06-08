---
name: known-issues
description: 已知但未修复的问题
metadata:
  node_type: memory
  type: project
  originSessionId: 628f4189-3c4d-4efc-9c01-d1b64260249f
---

# 已知问题

## 2026-06-06
- **问题**: Pipeline getJobStatus 返回 Prisma camelCase 字段，前端用 snake_case
  - **位置**: pipeline.ts getJobStatus() vs KnowledgeBuildView.vue
  - **严重程度**: 中（已用 getStepType() 兼容，但其他字段如 status/progress 等也是 camelCase）
  - **临时方案**: getStepType() 兼容函数 + computed 中用 Record<string,unknown> 断言

- **问题**: 评估面板维度展示只有名称，缺少 description 详情
  - **位置**: KnowledgeBuildView.vue 评估方案面板
  - **严重程度**: 低（功能正常，展示不够丰富）

## 2026-06-05
- **问题**: GEO dashboard `mention_by_engine` 缺少 `mentioned_count` 字段
  - **位置**: `server/src/routes/modules/geo.ts:514` vs `client/src/views/GeoView.vue:143`
  - **严重程度**: 高（前端监测页提及率显示 NaN）
  - **状态**: 已有问题，非本次引入

- **问题**: GEO 提及检测端点是模拟逻辑（随机标记 mentioned）
  - **位置**: `server/src/routes/modules/geo.ts` `/geo/mentions/check`
  - **严重程度**: 中（前端显示检测成功但数据不真实）
  - **状态**: 已有问题，需要接入真实 AI 搜索 API

- **问题**: 前端 GEO API 路径硬编码，未用 API.GEO.* 常量
  - **位置**: `client/src/api/geo.ts` 全文
  - **严重程度**: 低（违反 schema §09 规范）
  - **状态**: 已有问题，后续统一迁移

- **问题**: 生产流水线路由 `/pipeline/production/new` 中 `new` 被当 jobId 导致 500
  - **位置**: `server/src/routes/modules/pipelineProduction.ts:150`, `client/src/views/ProductionPipelineView.vue:177`
  - **严重程度**: 中
  - **状态**: ✅ 已修复（前端 UUID 校验 + 后端 UUID 格式校验）

## 2026-06-03
- **问题**: Git push 连接 GitHub 失败（走 127.0.0.1 代理）
  - **位置**: 系统 git 配置 / VPN 代理干扰
  - **严重程度**: 中（每次 push 需要绕过代理）
  - **临时方案**: `git -c http.proxy="" -c https.proxy="" push origin <branch>`

## 2026-06-02
- **问题**: 测试文件有 ~20 个 TypeScript 类型错误（mock 数据缺少字段）
  - **位置**: `packages/client/src/stores/__tests__/aiHub.test.ts`, `crm.test.ts`
  - **严重程度**: 低（运行时测试全绿 327/327，只是 tsc 类型检查报错）
  - **待处理**: 补全 mock 数据字段

- **问题**: JWT_SECRET 环境变量未配置，运行时有警告
  - **位置**: packages/server/src/services/auth/authService.ts
  - **严重程度**: 低（开发环境可用，生产需配置）

- **问题**: 测试 cleanupTestDb 中 TRUNCATE 偶发死锁（已加重试，仍可能偶发）
  - **位置**: packages/server/src/test/setup.ts
  - **严重程度**: 低

- **问题**: GEO 和全渠道分发模块是用户在 IDE 中自行开发的，未验证测试
  - **位置**: `packages/server/src/routes/modules/geo.ts`, `distribution.ts` 及相关 services/views
  - **严重程度**: 中（需要运行测试确认无回归）
