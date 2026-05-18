---
name: known-issues
description: 已知但未修复的问题
metadata: 
  node_type: memory
  type: project
  originSessionId: 1d44c428-cee5-4128-b0e7-89961534f93f
---

# 已知问题

## 2026-05-14 (第二次)
- **问题**: packages/client 和 packages/server 的 lint 脚本仍是 `vue-tsc --noEmit` 和 `tsc --noEmit`，未接入 ESLint
  - **位置**: packages/client/package.json:11, packages/server/package.json:10
  - **严重程度**: 低
  - **临时方案**: 使用根目录 `pnpm lint` 代替（已配置好 eslint）

## 2026-05-14 (第一次)
- **问题**: .claude/settings.json 和 .claude/settings.local.json 不存在
  - **位置**: d:\zimti\.claude\
  - **严重程度**: 中
  - **影响**: 权限白名单/Hook 配置/模型配置缺失，CLAUDE.md 中提到的 pre-commit hook 未实际绑定
  - **临时方案**: CLAUDE.md 中的规则仍有效，但 schema-check.ts 不会自动触发

- **问题**: Git LFS 配置存在但仓库中无 LFS 文件
  - **位置**: .gitconfig (filter.lfs.*)
  - **严重程度**: 低
  - **临时方案**: 无需处理

- **问题**: SSH Key 未生成
  - **严重程度**: 中
  - **临时方案**: 当前用 HTTPS 推送（需开代理），建议后续生成 SSH Key
