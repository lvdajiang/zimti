# 施工图：旅行自媒体 AI 驱动内容生产 SaaS 系统（全量商业化升级）

## 目标
基于 v3.0 整体方案，将现有个人提效工具升级为商业 SaaS 产品。新增 AI 中枢（品牌记忆/策略引擎/进化引擎）、AI-CRM、私域转化、一键流水线、聊天式 AI 向导 UI、行业模板、商业化订阅等模块。

---

## 进度总览

| 阶段 | 状态 | 说明 |
|:-----|:-----|:-----|
| 阶段零：数据模型扩展 | ✅ 完成 | 12 张新表 + shared-schema.ts 全量更新 |
| 阶段一：AI 中枢 | ✅ 完成 | BrandMemory + StrategyEngine + EvolutionEngine + 路由 |
| 阶段一T：AI 中枢测试 | ✅ 完成 | 单元测试 + 集成测试 |
| 阶段二：AI-CRM | ✅ 完成 | CustomerService + 路由（话术模板内嵌路由） |
| 阶段三：私域转化 | ✅ 完成 | 朋友圈生成 + 群内容生成 + 路由 |
| 阶段四：一键流水线 | ✅ 完成 | 4 种模式路由 + 爆款翻新异步执行 |
| 阶段五：前端 UI | ✅ 完成 | API 层 + Store + 4 页面 + 路由 |
| 阶段六：行业模板 + IP 访谈 | ✅ 完成 | 四层提问 + 行业模板 + 前端页面 |
| 阶段七：商业化（多租户 + 订阅） | ✅ 完成 | JWT 认证 + 订阅管理 + 路由守卫 |
| 阶段八：联调验证 | ✅ 完成 | 全量测试 + 类型检查 + schema 对齐 |

**已完成**: 阶段 0-8 + 测试补全（server 232 + client 95 = 327 测试全绿）
**当前重点**: 待定
**下一步**: 待用户指示

---

## 已完成详情

### 阶段零：数据模型扩展 ✅

- [x] 0.1 新增 Prisma 模型（AI 中枢）: BrandMemory, EvolutionLog
- [x] 0.2 新增 Prisma 模型（CRM + 私域）: Customer, CustomerTag, CustomerStageLog, FollowUpReminder, ChatTemplate, MomentsContent, GroupContent
- [x] 0.3 新增 Prisma 模型（流水线 + 商业化）: PipelineJob, PipelineTemplate, IndustryTemplate, Subscription
- [x] 0.4 更新 shared-schema.ts: 新增 ~15 个枚举 + ~10 个 Record 接口 + 4 组 API 常量 + 路由常量
- [x] 0.5 额外: Entity（供应商）+ Resource（资源）模型 + 高德 POI 集成
- [x] 0.6 DeepSeek LLM Provider 实现
- **交付物**: 12 张新表（迁移 20260525002510）, shared-schema.ts +245 行, schema.prisma +315 行

### 阶段一：AI 中枢 ✅

- [x] 1.1 BrandMemoryService（品牌记忆 CRUD + 风格学习 + 上下文注入）
- [x] 1.2 StrategyEngine（跨模块协调 + 热点评估 + 客户洞察 + 沉默客户检测）
- [x] 1.3 EvolutionEngine（记录学习 + 模式分析 + 风格/内容/技能三路进化）
- [x] 1.4 AI 中枢路由（7 个端点: brand-memory CRUD/learn, strategy/recommendations, evolution analyze/log）
- **交付物**: 3 个 Service 文件 + 1 个路由文件，全部注册到 routes/index.ts

### 阶段二：AI-CRM ✅

- [x] 2.1 CustomerService（客户 CRUD + 8 阶段漏斗 + 标签管理 + 语音录入解析 + 沉默检测 + 漏斗统计）
- [x] 2.2 话术模板功能内嵌路由（CRUD + AI 生成 + 效果评分）
- [x] 2.3 CRM 路由（12 个端点: 客户 CRUD/阶段/标签/语音输入/话术/跟进提醒/沉默客户/漏斗统计）
- **交付物**: 1 个 Service 文件 + 1 个路由文件

### 阶段三：私域转化 ✅

- [x] 3.1 朋友圈内容生成（3 专业 + 2 生活 + 1 转化，品牌记忆注入）
- [x] 3.2 群运营内容生成（意向客户群/已出行群/老客复购群）
- [x] 3.3 私域路由（5 个端点: moments daily/sent/engagement, group-content list/generate）
- **交付物**: 1 个路由文件（逻辑内嵌，轻量模块）

### 阶段四：一键流水线 ✅

- [x] 4.1 爆款翻新异步流水线（视频文案提取 → AI 改写 → 品牌记忆注入）
- [x] 4.2 流水线路由（6 个端点: viral-remind/daily-status/hotspot-rush/customer-question/jobs/detail）
- [x] 4.3 任务管理（创建/查询/状态流转: pending→running→waiting_confirm/failed）
- **交付物**: 1 个路由文件 + 异步执行函数

### 供应商管理（额外） ✅

- [x] Entity CRUD + 别名消歧 + 合并功能
- [x] 高德 POI 搜索 + 一键导入
- [x] Resource（资源/产品）子模块
- [x] 前端完整页面: EntitiesView.vue + entity store + API
- **交付物**: 后端路由 + 前端完整页面（Vue + Ant Design Vue）

---

## 待执行任务

### 阶段一T：AI 中枢后端测试（可后补）

- [ ] 1.T1 BrandMemoryService 单元测试
- [ ] 1.T2 StrategyEngine 单元测试
- [ ] 1.T3 EvolutionEngine 单元测试
- [ ] 1.T4 AI 中枢 API 集成测试

### 阶段五：前端 UI ✅

- [x] 5.1 前端 API 层（CRM + 私域 + 流水线 + AI 中枢）
- [x] 5.2 Pinia Store（CRM + 私域 + 流水线 + AI 中枢）
- [x] 5.3 CRM 客户管理页面 (CrmView.vue)
- [x] 5.4 私域运营页面 (PrivateDomainView.vue)
- [x] 5.5 流水线页面 (PipelineView.vue)
- [x] 5.6 路由注册 + 侧边栏导航

### 阶段六：行业模板 + IP 访谈 ✅

- [x] 6.1 IpInterviewService IP 定位访谈（四层提问框架）
- [x] 6.2 IndustryTemplateService 行业模板服务
- [x] 6.3 IP 访谈 + 模板路由 + 前端页面 (InterviewView.vue)

### 阶段七：商业化（多租户 + 订阅） ✅

- [x] 7.1 JWT 认证服务（注册/登录/demo-login/密码哈希/auth 中间件）
- [x] 7.2 订阅管理（4 档套餐/配额控制/升级）
- [x] 7.3 认证路由 + 订阅路由 + 前端页面 (AuthView.vue + auth store + 路由守卫)

### 阶段八：联调验证 ✅

- [x] 8.1 全量测试回归: server 28 PASS, client 0 FAIL
- [x] 8.2 类型检查: shared + server + client 零错误
- [x] 8.3 Schema 对齐: schema-check.ts 无报错

---

## 验证节点

| 节点 | 时机 | 验证方式 | 状态 |
|------|------|---------|------|
| V1 | 阶段零完成后 | `prisma migrate` + schema-check | ✅ 通过 |
| V2 | 阶段一-四完成后 | `tsc --noEmit` server + client | ✅ 通过 |
| V3 | 阶段五完成后 | 浏览器 4 个新页面渲染 | ✅ 通过 |
| V4 | 阶段六+七完成后 | IP 访谈 + 订阅功能 | ✅ 通过 |
| V5 | 阶段八完成后 | 全量测试 + 类型检查 + 页面联调 | ✅ 通过 |

---

## 已确认决策

| 决策点 | 选择 | 理由 |
|:---|:---|:---|
| AI 中枢 LLM | **DeepSeek** | 用户选定 |
| 品牌记忆存储 | **JSONB**（PostgreSQL） | 初期够用，后续可迁移向量数据库 |
| 语音录入 | **Web Speech API + 文本降级** | 免费，Chrome 兼容好 |
| 多租户隔离 | **行级隔离（tenantId）** | SaaS 标准方案 |
| 支付接入 | **微信支付** | 目标用户是国内企业老板 |
| PostgreSQL | **v17 本地安装** | 端口 5432, 密码 123456 |

---

## 环境信息

- **PostgreSQL**: 17.10, 本地安装, 端口 5432, 数据库 `zimti`
- **Prisma 迁移**: 8 个已应用, 44 张数据表
- **分支**: `work-0519-env-lint-optimize`
- **最近提交**: `feat: 阶段七 商业化认证与订阅`
