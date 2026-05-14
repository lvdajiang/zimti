---
name: known-issues
description: 已知但未修复的问题
metadata:
  type: project
---

# 已知问题

## 2026-05-14
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
