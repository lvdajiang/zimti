---
name: known-issues
description: 已知但未修复的问题
metadata:
  node_type: memory
  type: project
  originSessionId: 628f4189-3c4d-4efc-9c01-d1b64260249f
---

# 已知问题

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
