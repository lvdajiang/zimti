# 施工图：旅行自媒体 AI 驱动内容生产 SaaS 系统（全量商业化升级）

## 目标
基于 v3.0 整体方案，将现有个人提效工具升级为商业 SaaS 产品。新增 AI 中枢（品牌记忆/策略引擎/进化引擎）、AI-CRM、私域转化、一键流水线、聊天式 AI 向导 UI、行业模板、商业化订阅等模块。

---

## 现有基础（已完成 ~70%）

- **数据层**: 28 个 Prisma 模型（User, Task, BenchmarkAccount, ViralVideo, Hotspot, Script, StoryboardSegment, Material, VideoProduct, PublishRecord 等）
- **后端**: 20 个路由模块（aiStudio, scripts, topicProposals, viralVideos, publishRecords, materials 等）
- **前端**: 18 个 Vue 视图（Dashboard, TopicWorkbench, ScriptEditor, VideoPreview, Publish 等）
- **AI 集成**: GLM（文案/脚本）、即梦 AI（文生图/图生视频/文生视频）、Edge-TTS（配音）
- **渲染管线**: Remotion 4.0（VideoComposition, 5 种 Segment 类型）
- **共享定义**: shared-schema.ts（37 枚举, 28 类型, 134 API 端点）

---

## 执行计划

### 阶段零：数据模型扩展

- [ ] 0.1 新增 Prisma 模型（AI 中枢相关）
  - 文件: packages/server/prisma/schema.prisma
  - 依赖: 无
  - 新增模型: BrandMemory, EvolutionLog
  - 完成标准: `npx prisma migrate dev` 成功，两张表可查询
  - 测试: prisma migrate 成功 + seed 数据可插入

- [ ] 0.2 新增 Prisma 模型（CRM + 私域相关）
  - 文件: packages/server/prisma/schema.prisma
  - 依赖: 无
  - 新增模型: Customer, CustomerTag, CustomerStageLog, FollowUpReminder, ChatTemplate, MomentsContent, GroupContent
  - 完成标准: `npx prisma migrate dev` 成功
  - 测试: prisma migrate 成功 + 各表 CRUD 正常

- [ ] 0.3 新增 Prisma 模型（流水线 + 商业化相关）
  - 文件: packages/server/prisma/schema.prisma
  - 依赖: 无
  - 新增模型: PipelineJob, PipelineTemplate, IndustryTemplate, Subscription
  - 完成标准: `npx prisma migrate dev` 成功
  - 测试: prisma migrate 成功

- [ ] 0.4 更新 shared-schema.ts（枚举 + 接口 + API + 路由）
  - 文件: packages/shared/src/shared-schema.ts
  - 依赖: 0.1, 0.2, 0.3
  - 新增: CustomerStage(8值), CustomerIntentLevel(3值), PipelineMode(4值), PipelineJobStatus(6值), SubscriptionPlan(4值), MomentsContentType(3值) 等枚举; 各新表的 Record 接口; API.AI_HUB / API.CRM / API.PRIVATE_DOMAIN / API.PIPELINE 常量; ROUTES 对应路由
  - 完成标准: `npx tsx scripts/schema-check.ts` 通过，`npx tsc --noEmit` 通过
  - 测试: schema-check 无报错

---

### 阶段一：AI 中枢（品牌记忆 + 策略引擎 + 进化引擎）

- [ ] 1.1 BrandMemoryService 品牌记忆服务
  - 文件: packages/server/src/services/ai/brandMemory.ts
  - 依赖: 0.1, 0.4
  - 功能: 品牌画像 CRUD、风格学习（记录用户修改习惯并提炼规则）、跨模块上下文查询、人设自动更新
  - 完成标准: `npx tsc --noEmit` 通过，export BrandMemoryService 类含 getProfile / updateProfile / learnStyle / getContext 方法
  - 测试: 单元测试覆盖 CRUD + 风格学习逻辑

- [ ] 1.2 StrategyEngine 策略引擎服务
  - 文件: packages/server/src/services/ai/strategyEngine.ts
  - 依赖: 1.1
  - 功能: 跨模块协调（CRM 问题→选题推荐、高完播率→成功基因提取、竞品爆款→跟进选题）、主动推送决策、热点匹配度判断
  - 完成标准: export StrategyEngine 类含 evaluateHotspot / recommendTopic / crossModuleAction 方法
  - 测试: 单元测试覆盖热点匹配 + 跨模块协调逻辑

- [ ] 1.3 EvolutionEngine 进化引擎服务
  - 文件: packages/server/src/services/ai/evolutionEngine.ts
  - 依赖: 1.1
  - 功能: 内容进化（对比数据表现识别成功/失败模式）、话术进化、风格进化（记录用户修改→提炼偏好规则）、Skill 自动升级
  - 完成标准: export EvolutionEngine 类含 analyzePatterns / learnFromResult / evolveSkill 方法
  - 测试: 单元测试覆盖模式识别 + 学习逻辑

- [ ] 1.4 AI 中枢路由
  - 文件: packages/server/src/routes/modules/aiHub.ts
  - 依赖: 1.1, 1.2, 1.3
  - 端点: GET /brand-memory (获取品牌画像), PUT /brand-memory (更新), POST /brand-memory/learn (触发学习), GET /strategy/recommendations (获取策略推荐), POST /evolution/analyze (触发进化分析), GET /evolution/log (查看进化日志)
  - 完成标准: 路由注册到 routes/index.ts，`npx tsc --noEmit` 通过
  - 测试: 集成测试覆盖各端点正常+校验+错误场景

---

### 阶段一T：AI 中枢后端测试

- [ ] 1.T1 BrandMemoryService 单元测试
  - 文件: packages/server/__tests__/unit/brandMemory.test.ts
  - 依赖: 1.1
  - 覆盖: CRUD 正常路径 + 风格学习（记录修改→提炼规则）+ 边界值
  - 完成标准: `pnpm vitest run` 全部通过

- [ ] 1.T2 StrategyEngine 单元测试
  - 文件: packages/server/__tests__/unit/strategyEngine.test.ts
  - 依赖: 1.2
  - 覆盖: 热点匹配度计算 + CRM 问题→选题推荐 + 高完播率→成功基因
  - 完成标准: `pnpm vitest run` 全部通过

- [ ] 1.T3 EvolutionEngine 单元测试
  - 文件: packages/server/__tests__/unit/evolutionEngine.test.ts
  - 依赖: 1.3
  - 覆盖: 成功/失败模式识别 + 用户修改偏好提取 + Skill 升级触发
  - 完成标准: `pnpm vitest run` 全部通过

- [ ] 1.T4 AI 中枢 API 集成测试
  - 文件: packages/server/__tests__/api/aiHub.test.ts
  - 依赖: 1.4
  - 覆盖: 各端点 200 + 参数校验 400 + 未授权 401
  - 完成标准: `pnpm vitest run` 全部通过

---

### 阶段二：AI-CRM 客户关系管理

- [ ] 2.1 CustomerService 客户服务
  - 文件: packages/server/src/services/crm/customerService.ts
  - 依赖: 0.2, 0.4
  - 功能: 客户 CRUD、阶段流转（8阶段漏斗）、标签管理、语音录入解析（调用 GLM 提取关键信息填入字段）、沉默客户检测、转介绍链追踪
  - 完成标准: export CustomerService 类含 create / updateStage / addTags / parseVoiceInput / detectSilent 方法
  - 测试: 单元测试覆盖阶段流转 + 语音解析 + 沉默检测

- [ ] 2.2 ChatTemplateService 话术模板服务
  - 文件: packages/server/src/services/crm/chatTemplateService.ts
  - 依赖: 0.2, 0.4
  - 功能: 话术模板 CRUD、按客户阶段匹配话术、AI 动态生成话术（结合品牌记忆）、话术效果追踪（转化率统计）
  - 完成标准: export ChatTemplateService 类含 getByStage / generate / trackEffectiveness 方法
  - 测试: 单元测试覆盖阶段匹配 + 动态生成

- [ ] 2.3 CRM 路由
  - 文件: packages/server/src/routes/modules/crm.ts
  - 依赖: 2.1, 2.2
  - 端点: CRUD customers、阶段流转、标签操作、话术查询/生成、语音录入、跟进提醒列表、沉默客户列表、漏斗统计
  - 完成标准: 路由注册，`npx tsc --noEmit` 通过
  - 测试: 集成测试覆盖各端点

- [ ] 2.4 CRM 后端测试
  - 文件: packages/server/__tests__/api/crm.test.ts, packages/server/__tests__/unit/customerService.test.ts
  - 依赖: 2.3
  - 覆盖: 客户 CRUD + 阶段流转 + 语音录入解析 + 话术生成 + 沉默检测 + API 集成测试
  - 完成标准: `pnpm vitest run` 全部通过

---

### 阶段三：私域转化模块

- [ ] 3.1 MomentsService 朋友圈服务
  - 文件: packages/server/src/services/privateDomain/momentsService.ts
  - 依赖: 0.2, 0.4, 1.1
  - 功能: 自动生成每日朋友圈内容（3专业+2生活+1转化，从视频脚本派生）、"已发送"状态追踪、发送时间记录、互动数据录入、最佳发布时间分析
  - 完成标准: export MomentsService 类含 generateDaily / markSent / recordEngagement / analyzeBestTime 方法
  - 测试: 单元测试覆盖内容生成 + 时间分析

- [ ] 3.2 GroupContentService 群运营服务
  - 文件: packages/server/src/services/privateDomain/groupContentService.ts
  - 依赖: 0.2, 0.4, 1.1
  - 功能: 生成群运营内容（意向客户群/已出行群/老客复购群）、行前行中行后模板
  - 完成标准: export GroupContentService 类含 generateForGroup 方法
  - 测试: 单元测试覆盖三种群类型内容生成

- [ ] 3.3 私域路由
  - 文件: packages/server/src/routes/modules/privateDomain.ts
  - 依赖: 3.1, 3.2
  - 端点: GET /moments/daily（获取今日朋友圈）、POST /moments/:id/sent（标记已发送）、POST /moments/:id/engagement（录入互动）、GET /group-content（获取群内容）、资料包生成端点
  - 完成标准: 路由注册，`npx tsc --noEmit` 通过
  - 测试: 集成测试覆盖各端点

---

### 阶段四：一键流水线

- [ ] 4.1 PipelineOrchestrator 流水线编排器
  - 文件: packages/server/src/services/pipeline/orchestrator.ts
  - 依赖: 1.1, 1.2, 0.4
  - 功能: 四种模式编排（爆款翻新/每日自动/热点紧急/CRM驱动）、全链路调度（下载→提取→改写→脚本→素材→配音→渲染→发布文案→朋友圈）、关键节点暂停等确认
  - 完成标准: export PipelineOrchestrator 类含 runViralRemake / runDailyAuto / runHotspotRush / runCustomerQuestion 方法
  - 测试: 单元测试覆盖四种模式的流程编排逻辑

- [ ] 4.2 MaterialMatcherService 素材匹配服务
  - 文件: packages/server/src/services/pipeline/materialMatcher.ts
  - 依赖: 0.4
  - 功能: 根据脚本分镜自动匹配素材（Pexels API 关键词搜索 + AI 筛选）、地图动画模板匹配、AI 生成素材（调用即梦 API）
  - 完成标准: export MaterialMatcherService 类含 matchForSegment 方法
  - 测试: 单元测试覆盖匹配逻辑

- [ ] 4.3 流水线路由
  - 文件: packages/server/src/routes/modules/pipeline.ts
  - 依赖: 4.1, 4.2
  - 端点: POST /pipeline/viral-remake（粘贴链接一键翻新）、GET /pipeline/daily-status（每日自动状态）、POST /pipeline/hotspot-rush（紧急出片）、POST /pipeline/customer-question（CRM驱动）、GET /pipeline/jobs（任务列表）、GET /pipeline/jobs/:id（任务详情）
  - 完成标准: 路由注册，`npx tsc --noEmit` 通过
  - 测试: 集成测试覆盖各端点

- [ ] 4.4 流水线后端测试
  - 文件: packages/server/__tests__/api/pipeline.test.ts, packages/server/__tests__/unit/orchestrator.test.ts
  - 依赖: 4.3
  - 覆盖: 四种模式编排 + 素材匹配 + API 集成测试
  - 完成标准: `pnpm vitest run` 全部通过

---

### 阶段五：聊天式 AI 向导 UI

- [ ] 5.1 前端 API 层（AI 中枢 + CRM + 私域 + 流水线）
  - 文件: packages/client/src/api/aiHub.ts, crm.ts, privateDomain.ts, pipeline.ts
  - 依赖: 0.4
  - 完成标准: 所有 API 调用函数导出，类型从 shared-schema 导入，`npx tsc --noEmit` 通过

- [ ] 5.2 Pinia Store（AI 中枢 + CRM + 私域 + 流水线）
  - 文件: packages/client/src/stores/aiHub.ts, crm.ts, privateDomain.ts, pipeline.ts
  - 依赖: 5.1
  - 完成标准: 各 Store 包含 state/actions，TypeScript 编译通过

- [ ] 5.3 聊天式 AI 助手核心组件
  - 文件: packages/client/src/components/ai-assistant/ChatPanel.vue, ChatBubble.vue, QuickActions.vue, VoiceInput.vue
  - 依赖: 5.2
  - 功能: 聊天气泡界面（AI 消息 + 用户消息）、快捷操作按钮、语音输入组件
  - 完成标准: 组件渲染正常，TypeScript 编译通过

- [ ] 5.4 CRM 组件
  - 文件: packages/client/src/components/crm/CustomerCard.vue, CustomerList.vue, StagePipeline.vue, VoiceRecordButton.vue, FollowUpReminder.vue
  - 依赖: 5.2
  - 功能: 客户卡片（一键阶段选择+标签按钮）、客户列表、阶段漏斗可视化、语音录入按钮、跟进提醒
  - 完成标准: 组件渲染正常，TypeScript 编译通过

- [ ] 5.5 朋友圈 + 私域组件
  - 文件: packages/client/src/components/private-domain/MomentsCard.vue, CopyButton.vue, SentStatusBadge.vue, ChatTemplateSelector.vue
  - 依赖: 5.2
  - 功能: 朋友圈卡片（文案+配图建议+复制按钮+已发送状态）、话术选择器
  - 完成标准: 组件渲染正常

- [ ] 5.6 流水线组件
  - 文件: packages/client/src/components/pipeline/PipelineLauncher.vue, PipelineProgress.vue, ViralRemakeForm.vue
  - 依赖: 5.2
  - 功能: 流水线启动器（选择模式）、进度条（全链路各环节状态）、爆款翻新表单（粘贴链接）
  - 完成标准: 组件渲染正常

- [ ] 5.7 主页面组装 + 路由注册
  - 文件: packages/client/src/views/AiAssistantView.vue, router/index.ts
  - 依赖: 5.3, 5.4, 5.5, 5.6
  - 功能: 聊天式 AI 助手主页面（左侧导航 + 右侧聊天区），注册 /ai-assistant 路由
  - 完成标准: 浏览器访问 /ai-assistant 页面完整渲染，无 console.error

---

### 阶段六：行业模板 + IP 访谈

- [ ] 6.1 IpInterviewService IP 定位访谈服务
  - 文件: packages/server/src/services/ai/ipInterview.ts
  - 依赖: 1.1, 0.4
  - 功能: 四层提问框架（事件→行为→感受→信念）、自动追问（识别浅回答深挖到第四层）、自动生成 IP 定位画布
  - 完成标准: export IpInterviewService 类含 startInterview / nextQuestion / generateProfile 方法
  - 测试: 单元测试覆盖追问逻辑 + 画布生成

- [ ] 6.2 IndustryTemplateService 行业模板服务
  - 文件: packages/server/src/services/template/industryTemplateService.ts
  - 依赖: 0.3, 0.4
  - 功能: 行业模板 CRUD（预设旅游/餐饮/教育/健身等模板）、模板应用（一键套用行业配置）
  - 完成标准: export IndustryTemplateService 类含 list / apply / create 方法

- [ ] 6.3 IP 访谈 + 模板路由 + 测试
  - 文件: packages/server/src/routes/modules/ipInterview.ts, industryTemplate.ts
  - 依赖: 6.1, 6.2
  - 完成标准: 路由注册，集成测试通过

---

### 阶段七：商业化（多租户 + 订阅）

- [ ] 7.1 多租户中间件
  - 文件: packages/server/src/middleware/tenant.ts
  - 依赖: 无
  - 功能: 从 JWT 提取 tenantId，注入到所有查询条件，确保数据隔离
  - 完成标准: 中间件注册，未携带 tenantId 返回 401

- [ ] 7.2 SubscriptionService 订阅服务
  - 文件: packages/server/src/services/subscription.ts
  - 依赖: 0.3, 0.4
  - 功能: 订阅计划管理（体验/个人/专业/企业）、配额检查（月度视频数/功能权限）、升级/降级
  - 完成标准: export SubscriptionService 类含 checkQuota / upgrade / downgrade 方法

- [ ] 7.3 认证路由 + 订阅路由 + 测试
  - 文件: packages/server/src/routes/modules/auth.ts, subscriptions.ts
  - 依赖: 7.1, 7.2
  - 功能: 注册/登录/JWT、订阅管理端点
  - 完成标准: 路由注册，集成测试通过

---

### 阶段八：联调验证

- [ ] 8.1 全量测试回归
  - 文件: packages/server/__tests__/
  - 依赖: 全部阶段
  - 完成标准: `pnpm vitest run` 全量通过（0 失败）

- [ ] 8.2 类型检查
  - 依赖: 全部阶段
  - 完成标准: `npx tsc --noEmit` 全项目通过

- [ ] 8.3 Schema 对齐检查
  - 依赖: 全部阶段
  - 完成标准: `npx tsx scripts/schema-check.ts` 无报错

- [ ] 8.4 页面联调
  - 依赖: 全部阶段
  - 完成标准: 浏览器访问所有新增页面，功能正常，无 console.error

---

## 验证节点

| 节点 | 时机 | 验证方式 |
|------|------|---------|
| V1 | 阶段零完成后 | `npx prisma migrate dev` + `npx tsx scripts/schema-check.ts` |
| V2 | 阶段一+一T完成后 | `pnpm vitest run` 全部通过 |
| V3 | 阶段二完成后 | CRM API 集成测试全绿 |
| V4 | 阶段三+四完成后 | 流水线端点 curl 200 + `pnpm vitest run` 全绿 |
| V5 | 阶段五完成后 | 浏览器 /ai-assistant 页面完整渲染 |
| V6 | 阶段六+七完成后 | IP 访谈流程 + 订阅配额检查正常 |
| V7 | 阶段八完成后 | 全量测试 + 类型检查 + Schema 检查 + 页面联调全部通过 |

---

## 已确认决策

| 决策点 | 选择 | 理由 |
|:---|:---|:---|
| AI 中枢 LLM | **DeepSeek** | 用户选定 |
| 品牌记忆存储 | **JSON 字段**（PostgreSQL JSONB） | 初期够用，无需引入向量数据库的复杂度，后续可迁移 |
| 语音录入 | **Web Speech API + 文本降级** | 免费，Chrome 兼容好；非 Chrome 自动切换文本输入 |
| 多租户隔离 | **行级隔离（tenantId 字段）** | SaaS 标准方案，简单可维护，所有查询加 tenantId 条件 |
| 支付接入 | **微信支付** | 目标用户是国内传统企业老板，微信支付最普遍 |

---

## 风险评估

- **AI API 调用成本**: 策略引擎和进化引擎频繁调用 LLM，需做好缓存和批量处理
- **语音录入兼容性**: Web Speech API 在部分浏览器不支持，需准备降级方案
- **流水线渲染时间**: Remotion 渲染 1-3 分钟视频约需 2-5 分钟，热点紧急模式需优先队列
- **多租户数据泄漏**: 中间件必须覆盖所有查询，遗漏任一路由即造成数据泄漏

## 测试计划

| 范围 | 测试类型 | 框架 | 覆盖目标 |
|------|---------|------|---------|
| AI 中枢 | 单元测试 | vitest | 品牌记忆CRUD + 策略推荐 + 进化学习 |
| CRM | 单元+集成 | vitest + supertest | 客户CRUD + 阶段流转 + 语音录入 + 话术生成 |
| 私域 | 单元+集成 | vitest + supertest | 朋友圈生成 + 群内容生成 + API 端点 |
| 流水线 | 单元+集成 | vitest + supertest | 四种模式编排 + 素材匹配 + API 端点 |
| 商业化 | 集成测试 | vitest + supertest | 租户隔离 + 配额检查 + 订阅管理 |
| 全量回归 | 全量 | vitest | 0 失败 |
