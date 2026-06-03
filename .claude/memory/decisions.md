---
name: decisions
description: 重要技术决策及其原因
metadata:
  node_type: memory
  type: project
  originSessionId: 628f4189-3c4d-4efc-9c01-d1b64260249f
---

# 技术决策

## 2026-06-02
- **决策**: Zimti 定位为「内容营销 + 私域获客」系统，不做产品/报价/订单
  - **原因**: 用户已有独立旅行社系统（project-lvyou，FastAPI + Vue 3），负责产品/报价/订单/派单/财务。Zimti 和它互补
  - **影响**: Zimti 聚焦 CRM、朋友圈、群聊分析、AI 内容生成、GEO 优化、全渠道分发
  - **关联**: [[project_status]]

- **决策**: 选定投媒网 GEO 作为媒体分发集成平台
  - **原因**: 全链路 API（内容优化+媒体分发+排名监测），定位"服务商的服务商"，最贴合 Zimti 的架构
  - **对比**: 媒介盒子（资源优先10万+媒体）、优媒汇（轻量快速）、文芳城（合规严谨）
  - **影响**: distribution.ts 的 publish 端点将接入投媒网 API，geo.ts 的监测端点接入排名 API
  - **架构**: Zimti = 内容大脑（AI 创作+适配），投媒网 = 分发手臂（3万+媒体资源）

- **决策**: GEO = Generative Engine Optimization，不是地理信息
  - **原因**: 现有 `geo_info`（lat/lng/city）是地理坐标，GEO 优化是让 AI 搜索引擎引用内容
  - **影响**: 保留两者，新增 GeoQuestion/GeoContent/GeoMention 模型

- **决策**: 系统演进方向为 AI 原生（三阶段）
  - **阶段 1**: 侧边栏精简 4 组 + 仪表盘今日工作台（已完成）
  - **阶段 2**: AI 浮窗升级为对话面板（可执行操作的聊天界面）
  - **阶段 3**: 对话框=系统（类似 DeepSeek，页面变成详情视图）
  - **原因**: 21 个页面学习成本太高，终极形态是用户说一句话 AI 完成所有操作
  - **架构基础**: Service 层已就绪（CRM/群聊/朋友圈/触达），差对话式 UI 层

- **决策**: 新模块统一用 `optionalAuth` 而非 `authMiddleware`
  - **原因**: 开发环境无 token 方便调试，CRM/私域等模块都已用 optionalAuth
  - **影响**: groupChat 路由从 authMiddleware 改为 optionalAuth

- **决策**: 侧边栏隐藏页面的入口放在对应父页面内（子导航）
  - **原因**: 10 个低频页面不能丢失，但侧边栏放不下
  - **映射**: 选题工作台→热点/爆款/流水线，AI工作室→视频预览/工具箱/知识库，人设→IP定位，对标→数据采集，仪表盘→监控/资产

## 2026-05-25
- **决策**: 接入 GPT Image 2.0 作为第三图片来源
  - **原因**: OpenAI API Key 已有，文字理解能力比即梦强
  - **成本**: 约 $0.04-0.08/张

## 2026-05-14
- **决策**: 用 Windows Junction 将记忆目录链接到仓库内
  - **原因**: C 盘格式化导致记忆丢失，需要让记忆随 git 持久化
  - **影响**: C:\Users\ladajiang\.claude\projects\d--zimti\memory\ → D:\zimti\.claude\memory\
