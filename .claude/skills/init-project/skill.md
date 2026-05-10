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

## 执行流程（4步）

### 第1步：复制技能卡

从全局模板复制核心技能卡到新项目的 `.claude/skills/`：

```
模板位置: ~/.claude/project-template/skills/

核心技能（25个，全部复制）：
├── refine/          需求细化
├── init-schema/     共享定义（需求→命名锚点）
├── design-spec/     设计规格（7要素）
├── design-detail/   页面描述（逐页蓝图）
├── design-page/     视觉设计（→Pencil稿）
├── data-flow/       数据流设计
├── tech-spec/       技术规格
├── align/           需求对齐
├── plan-first/      规划执行分离
├── plan/            结构化计划
├── brainstorming/   头脑风暴
├── check-page/      页面检查
├── code-review/     代码审查
├── component-check/ 组件检查
├── perf-check/      性能检查
├── deploy-check/    部署检查
├── regression/      回归检查
├── retro/           根因分析（审查→累积→溯源→升级体系）
├── xgbug/           系统化修bug
├── code-fix/        按清单修复
├── status/          项目进度
├── git-clean/       Git清理
├── save-ctx/        保存上下文
├── load-ctx/        恢复上下文
└── db/              数据库查询
```

**规则**：合并不覆盖，只添加不存在的技能卡，不覆盖已有的。

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
├── .claude/skills/ (25)       核心技能卡
├── .claude/review-issues.log  审查问题累积文件
├── 开发文档/ (10个文件夹)      文档结构
├── 03-视觉/shejigao.pen       设计系统（59个变量）
├── 03-视觉/设计系统规范.md     设计系统文档
├── 前端: toast + API 拦截器    全局错误提示
└── 后端: stubMarker 中间件    桩端点标记

### 完整链路
/refine → /init-schema → /design-spec → /design-detail → /design-page → /data-flow → /tech-spec → /align → /plan-first → 编码 → 审查 → 修复 → 部署
             ↓ 锚定命名                                              ↓ 扩展API      ↓ 扩展表结构                      ↑
                                                                                                                   │
                                                                    ┌───────────────────────────────────────────────┘
                                                                    │ 审查问题累积到 review-issues.log
                                                                    │ 累积 ≥ 3 → /retro 根因分析 → 升级开发体系
                                                                    └───────────────────────────────────────────────┘

### 下一步
1. 用 /refine 细化你的第一个需求
2. 用 /design-spec 生成设计规格
3. 开始编码
```

## 内含规则

1. **合并不覆盖**：已有 `.claude/skills/` 目录，只添加不存在的技能卡
2. **设计系统可选**：如果项目不需要 Pencil 设计稿，跳过第3步
3. **交互式确认**：每个步骤都确认用户意图，不自动覆盖已有文件
4. **模板优先**：所有内容从全局模板复制，确保一致性

## 模板位置

```
~/.claude/project-template/
├── CLAUDE.md              项目协作指南模板
├── skills/ (25个)         核心技能卡（含 init-schema、retro）
├── memory/ (5个)          记忆文件模板
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
| /data-flow | 新增了字段溯源标记规则 | → 更新模板 |

### CLAUDE.md 变化
- 新增了 /design-detail 到完整链路
- 新增了文档路径索引
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
- **不同步**：项目特有的技能卡（如 `/bushu`、`/import-docx`、`/wf-*`），这些是业务定制

**通用 vs 项目特有判断**：
- 通用：`/refine` `/init-schema` `/design-*` `/data-flow` `/tech-spec` `/align` `/plan-*` `/check-page` `/code-review` `/component-check` `/perf-check` `/deploy-check` `/regression` `/retro` `/xgbug` `/code-fix` `/status` `/git-clean` `/save-ctx` `/load-ctx` `/db` `/brainstorming`
- 项目特有：`/bushu`（部署脚本） `/run`（端口映射） `/import-*`（业务导入） `/wf-*`（工作流定制） `/help-gen`（文档定制） `/sync-page`（平台定制） 以及带业务名的技能

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
