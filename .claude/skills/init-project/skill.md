---
name: init-project
description: 项目初始化 - 从全局模板快速搭建开发体系（技能卡+文档结构+设计系统）
origin: meta
---

# 项目初始化 `/init-project`

> **使用场景**：开始一个全新项目时调用，5分钟搭建完整的 AI 辅助开发体系。
> **前置**：全局模板已就绪（`~/.claude/project-template/`）
> **输出**：新项目的 CLAUDE.md + 技能卡 + 文档结构 + 设计系统种子

## 用法

```
/init-project                    # 交互式创建，逐步引导填写
/init-project 我的项目名          # 带项目名创建
/init-project sync               # 同步进化：把项目的改进推回全局模板
```

## 执行流程（5步）

### 第1步：复制技能卡

从全局模板复制核心技能卡到新项目的 `.claude/skills/`：

```
模板位置: ~/.claude/project-template/skills/

核心技能（按用途分组，全部复制）：

📋 设计链路（7个）—— 需求→设计的线性流水线
├── refine/          需求细化（想法→需求文档）
├── init-schema/     建立共享定义（需求→命名锚点）
├── design-spec/     设计规格（需求→7要素文档）
├── design-detail/   页面描述（设计规格→逐页蓝图）
├── design-page/     视觉设计（页面描述→Pencil稿）
├── data-flow/       数据流设计（页面→API+字段溯源）
└── tech-spec/       技术规格（数据流→编码蓝图）

⚙️ 工作流（10个）—— 一条命令串联完整流程
├── wf/              顶层工作流入口
├── wf-new/          新功能全流程（对齐→施工图→自动施工→检查→部署）
├── wf-dev/          页面开发流程（手动开发+检查）
├── wf-bug/          修bug流程
├── wf-batch/        批量挂机执行
├── wf-algo/         算法修改流程
├── wf-deploy/       部署流程
├── wf-review/       审查修复流程
├── wf-day-start/    一天工作开始
└── run/             启动开发环境

🔍 审查门禁（12个）—— 各阶段的质量关卡
├── project-review/  项目配置完整性
├── req-review/      需求无歧义+可测试
├── spec-review/     设计规格7要素完整性
├── design-review/   页面描述跨页面一致性
├── dataflow-review/ 数据流字段溯源+API一致性
├── techspec-review/ 技术规格与数据流对齐
├── code-review/     代码质量6类扫描
├── check-page/      页面对照设计稿
├── component-check/ 组件统一性
├── perf-check/      性能预算巡检
├── deploy-check/    部署前检查
└── regression/      回归影响检查

🔧 修复执行（2个）
├── xgbug/           系统化修bug（6步）
└── code-fix/        按清单逐项修复

🛠 工具（10个）
├── align/           需求对齐（7问确认）
├── plan-first/      施工图+自动施工（Tech Spec→分阶段执行计划→逐任务自动推进）
├── plan/            结构化计划（批量多页面）
├── model-pick/      模型选择推荐
├── brainstorming/   头脑风暴
├── scan-algo/       算法管道审查
├── status/          项目进度
├── retro/           根因分析（审查→累积→溯源→升级体系）
├── save-ctx/        保存上下文
└── load-ctx/        恢复上下文

📁 基础设施（3个）
├── git-clean/       Git清理
├── db/              数据库查询
└── bushu/           部署到服务器
```

**规则**：合并不覆盖，只添加不存在的技能卡，不覆盖已有的。

**说明**：项目还包含 `~80` 个参考/模式技能（api-design、frontend-patterns、database-migrations 等），这些是 Claude 的知识库，按需引用，不在此处列出。

### 第2步：复制文档结构

从全局模板复制整个文档文件夹结构到新项目根目录：

```bash
cp -r ~/.claude/project-template/开发文档/ ./开发文档/
```

模板中已包含10个文件夹（各含 `.gitkeep`），无需手动 `mkdir`。

| 编号 | 文件夹 | 对应阶段 | 存什么 |
|------|--------|---------|--------|
| 00 | 项目/ | — | 项目配置、技能清单、错误案例库 |
| 01 | 需求/ | `/refine` | 需求文档 |
| 02 | 设计/ | `/design-spec` + `/design-detail` | 设计规格、页面描述 |
| 03 | 视觉/ | `/design-page` | shejigao.pen + 设计系统规范 |
| 04 | 数据流/ | `/data-flow` | 数据逻辑、字段定义 |
| 05 | 技术规格/ | `/tech-spec` | 技术蓝图 |
| 06 | 架构/ | — | architecture、database、API规范、**shared-schema.ts（唯一真相源）** |
| 07 | 契约/ | — | 冻结的业务契约 |
| 08 | 日志/ | — | 开发日志 |
| 09 | 归档/ | — | 历史文件 |

### 第3步：初始化开发基础设施

根据技术栈自动搭建项目编码所需的基础设施：

**前端（Vue/React 项目）**：
1. 安装 toast 通知库（如 `vue-toastification`）
2. 创建 `src/utils/toast.ts` 封装全局 toast 实例
3. 配置 API 拦截器：非 2xx 响应自动弹错误提示

**后端（Node.js 项目）**：
1. 创建桩标记中间件 `stubMarker.ts`（`markStub()` + `X-Stub` 响应头）
2. 在应用入口挂载桩标记中间件

**通用**：
1. 创建 `.claude/review-issues.log`（空文件，用于审查问题累积）

### 第4步：初始化设计系统

如果项目需要 Pencil 设计稿：

```
1. open_document() → 新建 shejigao.pen（或在 03-视觉/ 下新建）
2. set_variables() → 写入59个设计变量（颜色/间距/字号/圆角/字重/组件高度/阴影）
3. 生成设计系统规范文档 → 开发文档/03-视觉/设计系统规范.md
```

设计变量种子（全部使用，项目可自定义值）：

```typescript
// 颜色体系（23个）
brand-indigo: #6366F1, brand-purple: #8B5CF6, brand-gradient-start/end,
status-success/warning/error/info, text-primary/secondary/tertiary/disabled,
bg-primary/secondary/mobile-start/mobile-end, border-light/medium,
mobile-nav-bg, mobile-card-bg, mobile-active-bg, mobile-inactive-bg

// 间距（7个）: space-xs(4) / sm(8) / md(12) / lg(16) / xl(20) / 2xl(24) / 3xl(32)
// 字号（9个）: text-xs(11) / sm(12) / base(13) / md(14) / lg(16) / xl(18) / 2xl(20) / 3xl(24) / 4xl(32)
// 圆角（5个）: radius-sm(4) / md(8) / lg(12) / xl(16) / full(9999)
// 字重（4个）: weight-normal(400) / medium(500) / semibold(600) / bold(700)
// 组件高度（6个）: btn-sm(32) / btn-md(40) / btn-lg(48) / btn-mobile(56) / input-mobile(52) / nav-mobile(52)
// 阴影（1个）: hover-shadow
```

### 第5步：交互式填写 CLAUDE.md

从模板 `~/.claude/project-template/CLAUDE.md` 复制，引导用户替换占位符：

1. **项目名称**: 替换 `{项目名称}`
2. **日期**: 替换 `{日期}` 为当天日期
3. **核心原则**: 一句话描述项目核心原则
4. **语言规则**: 选择中文/英文/双语
5. **安全底线**: 保留通用规则，询问是否有项目特有安全规则
6. **技术栈**: 确认后端/前端技术栈
7. **当前阶段**: 填写项目当前阶段（如"需求分析"、"开发中"）

## 输出确认

```
✅ 项目初始化完成

### 已创建
├── CLAUDE.md                  项目协作指南
├── .claude/skills/ (44个)     核心技能卡
├── .claude/review-issues.log  审查问题累积文件
├── 开发文档/ (10个文件夹)      文档结构
├── 03-视觉/shejigao.pen       设计系统（59个变量）
├── 03-视觉/设计系统规范.md     设计系统文档
├── 前端: toast + API 拦截器    全局错误提示
└── 后端: stubMarker 中间件    桩端点标记

### 完整开发链路

设计链路（线性流水线）：
/refine → /init-schema → /design-spec → /design-detail → /design-page → /data-flow → /tech-spec
             ↓ 锚定命名                                              ↓ 扩展API      ↓ 扩展表结构

编码链路（/wf-new 一条龙）：
/wf-new = /align → /plan-first(施工图+自动施工) → /check-page → /perf-check → /deploy-check → /bushu
                            ↑
                    Tech Spec → 分阶段执行计划 → 逐任务自动推进（仅决策点暂停）

快速开发（手动模式）：
/wf-dev = /run → 手动开发 → /check-page → /perf-check → /deploy-check → /bushu

批量执行（挂机模式）：
/plan → 任务列表 → /wf-batch → 逐个自动执行

### 审查闭环
审查问题累积到 review-issues.log → 累积 ≥ 3 → /retro 根因分析 → 升级开发体系

### 下一步
1. 用 /refine 细化你的第一个需求
2. 走完整设计链路（或用 /wf-new 一条龙）
3. /plan-first 生成施工图 → [Approved] → 自动施工
```

## 内含规则

1. **合并不覆盖**：已有 `.claude/skills/` 目录，只添加不存在的技能卡
2. **设计系统可选**：如果项目不需要 Pencil 设计稿，跳过第4步
3. **交互式确认**：每个步骤都确认用户意图，不自动覆盖已有文件
4. **模板优先**：所有内容从全局模板复制，确保一致性

## 模板位置

```
~/.claude/project-template/
├── CLAUDE.md              项目协作指南模板
├── skills/ (44个)         核心技能卡
├── memory/                记忆文件模板
└── 开发文档/ (10个文件夹)  文档结构模板
```

---

## sync 模式：项目进化 → 模板同步

> **使用场景**：在项目中改进了技能卡、优化了文档结构、进化了工作流后，把改进推回全局模板，让未来新项目自动受益。
> **触发**：`/init-project sync`

### 执行流程（3步）

### 第1步：对比差异

对比当前项目与全局模板，找出进化点：

```
对比范围：
├── .claude/skills/    ← 技能卡（新增/修改/删除）
├── CLAUDE.md          ← 协作规则（新增的规则/流程）
└── 开发文档/结构       ← 文件夹结构变化（新增/重命名）
```

**对比方法**：
1. 列出项目的 `.claude/skills/` 中所有技能卡
2. 与模板中的技能卡逐个对比（检查 skill.md 文件内容是否有差异）
3. 列出项目中有但模板中没有的技能卡（新增）
4. 列出两边都有但内容不同的技能卡（改进）
5. 列出 CLAUDE.md 中的新增规则/流程

### 第2步：展示差异清单，确认同步

```
📋 进化同步报告

### 新增技能卡（项目有，模板无）
| 技能卡 | 说明 | 操作 |
|--------|------|------|
| /sync-page | H5→小程序对齐 | → 复制到模板 |

### 改进技能卡（两边都有，内容不同）
| 技能卡 | 变化摘要 | 操作 |
|--------|---------|------|
| /plan-first | 升级为施工图+自动施工模式 | → 更新模板 |
| /wf-new | 改用 plan-first 替代 plan+wf-batch | → 更新模板 |

### CLAUDE.md 变化
- 新增了编码施工图流程
- 更新了完整链路描述
→ 更新模板 CLAUDE.md

### 文件夹结构变化
- 无变化 ✅

是否同步以上变更到全局模板？（默认：是）
```

### 第3步：执行同步

**同步规则**：
- **新增技能卡**：直接复制到模板
- **改进技能卡**：用项目版本覆盖模板版本
- **CLAUDE.md**：提取通用规则部分更新模板，不复制项目特有内容（如项目名、端口映射、业务特定技能）
- **文件夹结构**：如果项目新增了文件夹，同步到模板
- **不同步**：项目特有的技能卡，这些是业务定制

**通用 vs 项目特有判断**：

| 通用（同步到模板） | 项目特有（不同步） |
|:---|:---|
| `/refine` `/init-schema` `/design-*` `/data-flow` `/tech-spec` | `/bushu` 部署脚本 |
| `/align` `/plan-first` `/plan` `/brainstorming` | `/run` 端口映射 |
| `/wf` `/wf-new` `/wf-dev` `/wf-bug` `/wf-batch` | `/import-*` 业务导入 |
| `/wf-algo` `/wf-deploy` `/wf-review` `/wf-day-start` | `/sync-page` 平台定制 |
| `/project-review` `/req-review` `/spec-review` `/design-review` | `/help-gen` 文档定制 |
| `/dataflow-review` `/techspec-review` `/code-review` | 业务名称命名的技能 |
| `/check-page` `/component-check` `/perf-check` `/deploy-check` | |
| `/regression` `/xgbug` `/code-fix` `/retro` | |
| `/model-pick` `/scan-algo` `/status` `/git-clean` | |
| `/save-ctx` `/load-ctx` `/db` | |

输出确认：
```
✅ 进化已同步到全局模板

### 同步内容
├── 新增技能卡: {N}个
├── 更新技能卡: {N}个
├── CLAUDE.md: 已更新通用规则
└── 文件夹结构: {无变化/已更新}

### 下次 /init-project 将自动包含这些进化
```
