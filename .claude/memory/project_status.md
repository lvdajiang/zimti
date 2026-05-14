---
name: project-status
description: 项目名称、版本、技术架构、页面规模、当前进度
metadata: 
  node_type: memory
  type: project
  originSessionId: 2ccade32-d359-46e2-8919-72ae80ae6593
---

# 项目状态

## 基本信息
- **项目名**: zimti v0.1.0
- **仓库**: https://github.com/lvdajiang/zimti.git
- **当前分支**: main
- **总提交数**: 20
- **最新提交**: e587b90 feat(client): 全站添加使用指引帮助提示（14个页面）

## 技术架构
- **Monorepo**: pnpm workspace，4 个包 (client/server/shared/remotion)
- **前端**: Vue 3 + TypeScript + Vite + Ant Design Vue
- **后端**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **视频**: Remotion @remotion/renderer
- **Node**: >=20, pnpm >=9

## 页面规模
- **Vue 页面**: 18 个 .vue 文件，14 个功能模块
- **服务端**: 18 个 .ts 文件
- **shared-schema.ts**: 1001 行（15页面/37枚举/28表/134 API端点）

## 14 个功能模块
人设配置、仪表盘(任务中心)、内容资产库、发布工作台、对标账号管理、数据监控面板、数据采集任务、热点追踪、爆款视频库、素材库、脚本编辑器、视频详情(含文案)、视频预览与渲染、选题工作台

## 外部微服务
| 服务 | 端口 | 技术 | 职责 |
|------|------|------|------|
| Crawler | 8001 | MediaCrawler | 抖音/小红书视频采集 |
| Whisper | 8002 | faster-whisper | 语音转文字 |
| TTS | 8003 | edge-tts | 口播语音合成 |
| ffmpeg | CLI | 系统二进制 | 视频/音频处理 |
| Remotion | 内置 | @remotion/renderer | React → MP4 |
| 地图动画 | Puppeteer | MapLibre GL + Three.js | 3D路线飞行动画 |

## 当前进度（截至 2026-05-12）
**已完成 6 个阶段**: 基础设施、CRUD补全、AI服务、Remotion渲染、Stub清零、Docker部署配置

**待完成**:
- 前端优化：骨架屏/空状态/Store补全/工具函数去重
- 新功能：AI工具导航页/创作者知识库
- 上线部署：SSL/环境变量/安全审计
- 平台发布需企业认证（抖音/小红书/微信视频号）

## 分支列表
- main (当前，与远程同步)
- work-0512-review-optimize (本地+远程)
