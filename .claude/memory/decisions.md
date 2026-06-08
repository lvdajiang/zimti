---
name: decisions
description: 重要技术决策及其原因
metadata:
  node_type: memory
  type: project
  originSessionId: 628f4189-3c4d-4efc-9c01-d1b64260249f
---

# 技术决策

## 2026-06-06
- **决策**: 知识库构建去掉数量限制，改为 AI 先评估主题规模
  - **原因**: 用户不应猜测建多少条，AI 应该评估主题需要多少覆盖
  - **影响**: 新增 evaluation 步骤（Pipeline 6步变7步），前端评估方案面板

- **决策**: 关键词蒸馏与维度拆分互相增强（不二选一）
  - **原因**: 关键词→推断维度（基于真实数据），维度→发现盲区→补全关键词
  - **影响**: stepEvaluate/stepDimensionSplit/stepMultiSearch 全部改造
  - **关键**: 搜索用关键词（精准），展示用维度（结构化）

- **决策**: 搜索步骤用关键词而非维度名
  - **原因**: 维度名如"经典旅游线路"不够精准，真实关键词如"新疆自驾游路线推荐"搜索效果更好
  - **向后兼容**: 无蒸馏关键词时回退到维度名搜索

- **决策**: 递归知识树方向（待实现）— 自适应深度的维度拆分
  - **原因**: 少量种子关键词通过递归拆分可以挖透整个行业知识
  - **停止条件**: 搜索返回 5+ 条高质量结果时停止，而非固定层数
  - **甜蜜点**: 2-3 层

- **决策**: API 返回 camelCase 字段名时前端用兼容函数处理
  - **原因**: Pipeline 的 getJobStatus() 直接返回 Prisma 原始对象（camelCase），不做映射
  - **影响**: 前端 `getStepType()` 兼容 step_type/stepType

## 2026-06-05
- **决策**: 生产流水线改为看板式布局（借鉴竞品「爆款IP智能体」）
  - **原因**: 竞品把所有步骤垂直排列一眼看全，比向导式分步切换更像生产线控制台
  - **影响**: `ProductionPipelineView.vue` 模板+样式全面重写，5个Panel组件零改动
  - **关键**: expandedSteps 用 `reactive(new Set())` 而非 `ref(new Set())`（Vue 3 Set响应性）

- **决策**: GEO 知识库不复用已有的 KnowledgeItem 表，新建 BrandKnowledge 表
  - **原因**: KnowledgeItem 是 AI Studio 的通用知识库，无 isActive 开关，分类不同（copy_template/hook等），用户认证不同
  - **影响**: 新表 + 新AI生成器 + brandContext.ts 增强

- **决策**: 关键词蒸馏结果按 batchId 分组管理
  - **原因**: 每次蒸馏生成多个结果，按批次分组便于查看历史和对比
  - **影响**: KeywordDistillation 表有 batchId 字段 + batches 聚合API

- **决策**: AI 生成器 JSON 解析必须校验 Array.isArray
  - **原因**: LLM 有时返回 `{ items: [...] }` 对象而非数组，JSON.parse 不报错但后续 .slice/.sort 崩溃
  - **影响**: brandKnowledgeGenerate.ts + keywordDistillGenerate.ts

## 2026-06-03
- **决策**: 生产流水线创建 Script 前先创建 TopicProposal 占位记录
  - **原因**: Script.topicId 是必填外键关联 TopicProposal，不能用硬编码 0（外键约束报错 500）
  - **影响**: `pipelineProduction.ts` 增加一步 create TopicProposal（status: 'pipeline_draft'）
  - **替代方案**: 改 Schema 让 topicId 可选（影响面大，否决）

- **决策**: Hotspot 查询不加 userId 过滤
  - **原因**: Hotspot 模型没有 userId 字段，是全局共享资源
  - **影响**: `topicSourceAggregator.ts` 的 loadHotspotHints() 不接受 userId 参数

- **决策**: 借鉴旗博士设计，建设「生产流水线」单页面
  - **原因**: 旗博士把 文案→配音→数字人→字幕→发布 串在一个页面，效率极高；Zimti 现有 4 页面跳转体验差
  - **设计**: 不替代现有页面，新增聚合视图（类似 IDE 的 Run 视图）
  - **技术基础**: PipelineTemplate.steps 字段已存在但未使用，正好作为多步流水线的编排引擎
  - **流程**: 选题/脚本 → TTS配音 → 视频画面(数字人/素材) → 字幕 → 多平台发布

- **决策**: 接入数字人视频生成 API（待选型）
  - **候选**: 即梦数字人（优先，已有账号）/ 硅基智能 / HeyGen
  - **关键要求**: 免训练数字人、REST API、支持中文
  - **状态**: 用户调研中

## 2026-06-02
- **决策**: Zimti 定位为「内容营销 + 私域获客」系统，不做产品/报价/订单
  - **原因**: 用户已有独立旅行社系统（project-lvyou，FastAPI + Vue 3），负责产品/报价/订单/派单/财务。Zimti 和它互补
  - **影响**: Zimti 聚焦 CRM、朋友圈、群聊分析、AI 内容生成、GEO 优化、全渠道分发

- **决策**: 选定投媒网 GEO 作为媒体分发集成平台
  - **原因**: 全链路 API（内容优化+媒体分发+排名监测），定位"服务商的服务商"，最贴合 Zimti 的架构
  - **对比**: 媒介盒子（资源优先10万+媒体）、优媒汇（轻量快速）、文芳城（合规严谨）
  - **架构**: Zimti = 内容大脑（AI 创作+适配），投媒网 = 分发手臂（3万+媒体资源）
  - **状态**: 等待联系投媒网拿 API 文档 + 测试账号

- **决策**: GEO = Generative Engine Optimization，不是地理信息
  - **原因**: 现有 `geo_info`（lat/lng/city）是地理坐标，GEO 优化是让 AI 搜索引擎引用内容
  - **影响**: 保留两者，新增 GeoQuestion/GeoContent/GeoMention 模型

- **决策**: 系统演进方向为 AI 原生（三阶段）
  - **阶段 1**: 侧边栏精简 4 组 + 仪表盘今日工作台（已完成）
  - **阶段 2**: AI 浮窗升级为对话面板（可执行操作的聊天界面）
  - **阶段 3**: 对话框=系统（类似 DeepSeek，页面变成详情视图）
  - **架构基础**: Service 层已就绪（CRM/群聊/朋友圈/触达），差对话式 UI 层

- **决策**: 新模块统一用 `optionalAuth` 而非 `authMiddleware`
  - **原因**: 开发环境无 token 方便调试
  - **影响**: groupChat 路由从 authMiddleware 改为 optionalAuth

- **决策**: 侧边栏隐藏页面的入口放在对应父页面内（子导航）
  - **映射**: 选题工作台→热点/爆款/流水线，AI工作室→视频预览/工具箱/知识库

## 2026-05-25
- **决策**: 接入 GPT Image 2.0 作为第三图片来源
  - **原因**: OpenAI API Key 已有，文字理解能力比即梦强
  - **成本**: 约 $0.04-0.08/张

## 2026-05-14
- **决策**: 用 Windows Junction 将记忆目录链接到仓库内
  - **原因**: C 盘格式化导致记忆丢失，需要让记忆随 git 持久化
  - **影响**: C:\Users\ladajiang\.claude\projects\d--zimti\memory\ → D:\zimti\.claude\memory\
