---
name: project-status
description: 项目名称、版本、技术架构、页面规模、当前进度
metadata:
  node_type: memory
  type: project
  originSessionId: 628f4189-3c4d-4efc-9c01-d1b64260249f
---

# 项目状态

## 基本信息
- **项目名**: Zimti v1.0
- **仓库**: https://github.com/lvdajiang/zimti.git
- **当前分支**: work-0519-env-lint-optimize
- **定位**: 旅行自媒体 AI 驱动内容营销 + 私域获客系统

## 两个系统分工
| 系统 | 位置 | 职责 | 技术栈 | 状态 |
|------|------|------|--------|------|
| **Zimti** | d:\zimti | 内容营销 + 私域获客 + AI 内容 | Node.js + Vue 3 + Prisma + PG | 开发中 |
| **project-lvyou** | d:\project-lvyou | 旅行社业务（产品/报价/订单/派单） | Python FastAPI + Vue 3 + Ant Design | 已上线 http://39.97.59.179:8000 |

## 技术架构
- **Monorepo**: pnpm workspace，4 个包 (client/server/shared/remotion)
- **前端**: Vue 3 + TypeScript + Vite + CSS 变量设计系统
- **后端**: Express 4 + TypeScript + Prisma + PostgreSQL
- **AI**: GLM-5-turbo + 即梦 + Pexels + TTS + OpenAI Images
- **视频**: Remotion @remotion/renderer

## 页面规模
- **侧边栏**: 4 组 13 项（工作台/内容生产/私域运营/设置，含全渠道分发+GEO优化）
- **隐藏页面**: 10 个（通过父页面子入口访问）
- **总路由**: 25+
- **Prisma 模型**: 30+ 张表（含 GEO/分发/私域运营/裂变等新表）

## 功能模块完成状态
- ✅ 阶段 0-8 全量功能（媒体采集/选题/视频/私域/AI中枢/流水线/商业化）
- ✅ 私域流量运营（标签/健康度/群聊分析/运营日历/触达/裂变/漏斗/朋友圈排期）
- ✅ UI 美化（CSS 变量设计系统 + 24 页面统一）
- ✅ 移动端适配（侧边栏抽屉 + 响应式）
- ✅ AI 原生转型阶段 1（侧边栏精简 + 仪表盘今日工作台）
- 🔄 GEO 优化模块（用户在 IDE 中开发，schema 已有）
- 🔄 全渠道分发模块（用户在 IDE 中开发，schema 已有）
- ⬜ AI 原生转型阶段 2（AI 浮窗升级为对话面板）
- ⬜ 部署到服务器

## 分支列表
- work-0519-env-lint-optimize (当前)
- main (基础分支)

## 关联记忆
- [[session_progress]] — 每次会话详细进度
- [[decisions]] — 技术决策记录
- [[known_issues]] — 已知问题
