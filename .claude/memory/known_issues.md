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
- **问题**: authService.ts 中 `require('crypto')` 已修复为 ESM import，但 JWT_SECRET 环境变量未配置，运行时有警告
  - **位置**: packages/server/src/services/auth/authService.ts
  - **严重程度**: 低（开发环境可用，生产需配置）
- **问题**: 测试 cleanupTestDb 中 TRUNCATE 可能死锁（已加重试，偶发）
  - **位置**: packages/server/src/test/setup.ts
  - **严重程度**: 低（重试机制已覆盖）
- **问题**: 朋友圈日历排期后端数据层就绪（scheduledAt + status 字段），前端 UI 未开发
  - **严重程度**: 中（功能半完成）
  - **待办**: 创建 MomentsCalendar.vue 组件

## 2026-05-14
- **问题**: packages/client 和 packages/server 的 lint 脚本未接入 ESLint
  - **严重程度**: 低
  - **临时方案**: 使用根目录 `pnpm lint`

- **问题**: .claude/settings.json 和 settings.local.json 不存在，pre-commit hook 未绑定
  - **严重程度**: 中
