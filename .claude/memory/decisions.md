---
name: decisions
description: 重要技术决策及其原因
metadata: 
  node_type: memory
  type: project
  originSessionId: 1d44c428-cee5-4128-b0e7-89961534f93f
---

# 技术决策

## 2026-05-14 (第二次)
- **决策**: 使用 ESLint flat config（eslint.config.js）而非 .eslintrc.cjs
  - **原因**: eslint@10 默认使用 flat config，.cjs 格式已过时
  - **影响**: 根目录 eslint.config.js，所有包共享

- **决策**: 日志轮转用自实现而非第三方库（如 winston/pino）
  - **原因**: 项目轻量，只需简单的 RotatingFileHandler 功能，避免引入额外依赖
  - **影响**: packages/server/src/logger.ts，纯 Node.js fs 实现

- **决策**: Prettier 配置使用无分号 + 单引号风格
  - **原因**: 与项目现有代码风格一致（查看现有 .ts 文件确认）
  - **影响**: .prettierrc `semi: false, singleQuote: true`

## 2026-05-14 (第一次)
- **决策**: 用 Windows Junction 将记忆目录链接到仓库内
  - **原因**: C 盘格式化导致记忆丢失，需要让记忆随 git 持久化到 GitHub
  - **影响**: C:\Users\ladajiang\.claude\projects\d--zimti\memory\ → D:\zimti\.claude\memory\
  - **替代方案**: 定期手动复制（容易忘）、写同步脚本（过度设计）

- **决策**: 写 setup-dev.sh 而非用系统备份工具
  - **原因**: 易数一键还原不安全；开发环境恢复比全盘备份更精准
  - **影响**: scripts/setup-dev.sh 纳入仓库，重装后 3 分钟恢复开发环境
  - **替代方案**: Macrium Reflect 全盘备份（需要额外分区存储镜像）
