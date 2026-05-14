---
name: decisions
description: 重要技术决策及其原因
metadata:
  type: project
---

# 技术决策

## 2026-05-14
- **决策**: 用 Windows Junction 将记忆目录链接到仓库内
  - **原因**: C 盘格式化导致记忆丢失，需要让记忆随 git 持久化到 GitHub
  - **影响**: C:\Users\ladajiang\.claude\projects\d--zimti\memory\ → D:\zimti\.claude\memory\
  - **替代方案**: 定期手动复制（容易忘）、写同步脚本（过度设计）

- **决策**: 写 setup-dev.sh 而非用系统备份工具
  - **原因**: 易数一键还原不安全；开发环境恢复比全盘备份更精准
  - **影响**: scripts/setup-dev.sh 纳入仓库，重装后 3 分钟恢复开发环境
  - **替代方案**: Macrium Reflect 全盘备份（需要额外分区存储镜像）
