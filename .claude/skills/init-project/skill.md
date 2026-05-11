---
name: init-project
description: 项目初始化 - 从全局模板快速搭建开发体系（技能卡+文档结构+设计系统+权限配置）
origin: meta
---

# 项目初始化 `/init-project`

> **使用场景**：开始一个全新项目时调用，5分钟搭建完整的 AI 辅助开发体系。
> **前置**：全局模板已就绪（`~/.claude/project-template/`）
> **输出**：新项目的 settings.json + CLAUDE.md + 技能卡 + 文档结构 + 设计系统种子

## 用法

```
/init-project                    # 交互式创建，逐步引导填写
/init-project 我的项目名          # 带项目名创建
/init-project adopt              # 老项目：已有代码，接驳到开发体系
/init-project sync               # 推送改进：项目 → 全局模板
/init-project pull               # 拉取改进：全局模板 → 项目
```

## 执行流程（6步）

### 第1步：配置权限白名单

在 `~/.claude/settings.json` 中配置自动通过规则，消除日常开发的弹窗干扰。

**操作**：读取现有 settings.json，合并（不覆盖）以下权限配置：

```jsonc
{
  "permissions": {
    // ── 自动通过：日常开发操作（零弹窗） ──
    "allow": [
      // MCP 工具
      "mcp__pencil", "mcp__4_5v_mcp", "mcp__web_reader",
      "WebSearch", "WebFetch",
      "mcp__pencil__batch_design", "mcp__pencil__batch_get",
      "mcp__pencil__get_editor_state", "mcp__pencil__open_document",
      "mcp__pencil__get_guidelines", "mcp__pencil__snapshot_layout",
      "mcp__pencil__get_screenshot", "mcp__pencil__get_variables",
      "mcp__pencil__set_variables", "mcp__pencil__find_empty_space_on_canvas",
      "mcp__pencil__search_all_unique_properties", "mcp__pencil__replace_all_matching_properties",
      "mcp__pencil__export_nodes",
      "NotebookEdit", "Glob", "Grep", "Read", "Write", "Edit",

      // 包管理 + 构建工具
      "Bash(pnpm *)", "Bash(npx *)", "Bash(npm run *)",
      "Bash(node *)", "Bash(tsx *)", "Bash(tsc *)",
      "Bash(vite *)", "Bash(vitest *)",

      // Git 常规操作
      "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)",
      "Bash(git branch*)", "Bash(git add*)", "Bash(git commit*)",
      "Bash(git checkout*)", "Bash(git stash*)", "Bash(git pull*)",
      "Bash(git fetch*)", "Bash(git merge*)", "Bash(git rebase*)",
      "Bash(git show*)", "Bash(git tag*)", "Bash(git worktree*)",
      "Bash(git rev-parse*)",

      // Git 中等风险（由 Claude 自审，见 CLAUDE.md 规则）
      "Bash(git push*)", "Bash(git remote*)", "Bash(git cherry-pick*)",
      "Bash(git reset*)", "Bash(git restore*)", "Bash(git switch*)",

      // 数据库 + 容器
      "Bash(prisma *)", "Bash(docker *)", "Bash(docker-compose *)",

      // 文件操作 + 网络
      "Bash(ls *)", "Bash(mkdir *)", "Bash(cp *)", "Bash(mv *)",
      "Bash(cat *)", "Bash(head *)", "Bash(tail *)", "Bash(wc *)",
      "Bash(stat *)", "Bash(find *)", "Bash(diff *)", "Bash(du *)",
      "Bash(sort *)", "Bash(uniq *)", "Bash(which *)", "Bash(where *)",
      "Bash(echo *)", "Bash(type *)",
      "Bash(rm *)", "Bash(rmdir *)",
      "Bash(curl *)", "Bash(wget *)",
      "Bash(gh *)", "Bash(gh pr *)",
      "Bash(* --version)", "Bash(* --help)"
    ],

    // ── 永久禁止：系统级危险命令 ──
    "deny": [
      "Bash(rm -rf /)", "Bash(rm -rf /*)", "Bash(rm -rf ~)",
      "Bash(rm -rf /.*)", "Bash(sudo *)",
      "Bash(git push --force*)", "Bash(git push -f*)",
      "Bash(git reset --hard*)", "Bash(git clean -fd*)",
      "Bash(shutdown*)", "Bash(reboot*)", "Bash(format*)",
      "Bash(del /f /s /q C:\\*)", "Bash(rd /s /q C:\\*)"
    ]
  }
}
```

**合并规则**：
- 保留现有的 `env`、`model`、`effortLevel` 等字段不动
- `allow` 数组合并去重（不删除用户已有的规则）
- `deny` 数组合并去重

### 第2步：复制技能卡

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

🛠 工具（11个）
├── align/           需求对齐（7问确认）
├── plan-first/      施工图+自动施工（Tech Spec→分阶段执行计划→逐任务自动推进）
├── plan/            结构化计划（批量多页面）
├── model-pick/      模型选择推荐
├── brainstorming/   头脑风暴
├── scan-algo/       算法管道审查
├── status/          项目进度
├── retro/           根因分析（审查→累积→溯源→升级体系）
├── save-ctx/        保存上下文
├── load-ctx/        恢复上下文
└── dev-page/        页面开发（设计规格→编码→验证）

📁 基础设施（3个）
├── git-clean/       Git清理
├── db/              数据库查询
└── bushu/           部署到服务器
```

**规则**：合并不覆盖，只添加不存在的技能卡，不覆盖已有的。

**说明**：项目还包含 `~80` 个参考/模式技能（api-design、frontend-patterns、database-migrations 等），这些是 Claude 的知识库，按需引用，不在此处列出。

### 第3步：复制文档结构

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

### 第4步：初始化开发基础设施

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

### 第5步：初始化设计系统

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


### 第6步：自动填写 CLAUDE.md

从模板 `~/.claude/project-template/CLAUDE.md` 复制，**自动检测并替换占位符**，只在检测失败时才询问用户。

**自动检测规则**（零配置）：

| 占位符 | 自动检测来源 | 检测失败时的默认值 |
|--------|------------|------------------|
| `{项目名称}` | `/init-project` 的参数，或 `package.json` 的 name 字段 | "我的项目" |
| `{日期}` | 当天日期 | 自动 |
| `{一句话核心原则}` | 默认值 | "质量优先，代码可维护性第一" |
| `{技术栈}` | 扫描项目文件自动识别（见下方检测逻辑） | "待确认" |
| `{当前阶段}` | 默认值 | "项目初始化" |

**技术栈自动检测逻辑**：

```
# 后端检测
存在 package.json + express/koa/fastify → Node.js
存在 requirements.txt → Python
存在 go.mod → Go
存在 pom.xml/build.gradle → Java
存在 Cargo.toml → Rust

# 前端检测
存在 package.json + vue → Vue
存在 package.json + react → React
存在 package.json + next → Next.js
存在 package.json + nuxt → Nuxt

# 数据库检测
存在 prisma/schema.prisma → PostgreSQL（读取 provider）
存在 package.json + mongoose → MongoDB
存在 package.json + sequelize → SQL

# 其他检测
存在 packages/remotion → Remotion
存在 docker-compose.yml → Docker
```

**执行流程**：
1. 复制模板 CLAUDE.md 到项目根目录
2. 运行自动检测，收集所有占位符的值
3. 批量替换，输出确认：
   ```
   ✅ CLAUDE.md 已生成
   - 项目名称: 智派系统
   - 技术栈: Node.js(TypeScript) + Vue + PostgreSQL
   - 核心原则: 质量优先，代码可维护性第一
   - 阶段: 项目初始化
   ```
4. 如果有检测失败的项（技术栈显示"待确认"），问一句："你的项目用什么技术栈？"用户回答后自动更新

**用户只需做的事**：
- `/init-project 我的项目名` — 说一个名字，其他全自动

## 老项目接驳流程（`/init-project adopt`）

> 当项目已有代码，需要接入开发体系时使用。
> 等价于先执行 `/init-project` 补齐技能卡和文档结构，再执行 `/adopt` 逆向接驳。

### 执行流程（2步）

#### 步骤1：补齐基础设施

与正常初始化相同：
1. 复制技能卡（`cp -rn`，不覆盖已有文件）
2. 复制文档结构（`cp -r`，已有目录不覆盖）
3. 设计系统：检查是否已有 shejigao.pen，有则跳过，无则初始化
4. CLAUDE.md：不覆盖已有内容，只补充缺失的部分

#### 步骤2：执行逆向接驳

调用 `/adopt` 技能，执行三步接驳：

```
/adopt 第1步：立地基 — 从代码逆向提取 shared-schema.ts
/adopt 第2步：画地图 — 生成页面清单 + 数据流文档
/adopt 第3步：设规则 — 更新 CLAUDE.md 向前锁定规则
```

详细步骤见 `/adopt` 技能卡。

## 输出确认

```
✅ 项目初始化完成

### 已创建
├── ~/.claude/settings.json      权限白名单（日常操作零弹窗）
├── CLAUDE.md                    项目协作指南（含风险自审规则）
├── .claude/skills/ (45个)       核心技能卡
├── .claude/review-issues.log    审查问题累积文件
├── 开发文档/ (10个文件夹)       文档结构
├── 03-视觉/shejigao.pen         设计系统（59个变量）
├── 03-视觉/设计系统规范.md       设计系统文档
├── 前端: toast + API 拦截器      全局错误提示
└── 后端: stubMarker 中间件      桩端点标记

### 权限体系
├── ✅ 自动通过: 读/写/搜索/编辑/构建/测试/git 常规操作
├── 👁️ Claude 自审: git push/rm/curl（中文说明后执行）
├── 🚫 永久禁止: rm -rf /、sudo、force push、硬重置
└── ❓ 必须问你: 改密钥、改部署配置、删大目录

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

全自动流水线（需求完善时）：
需求文档 → design-spec → design-detail → design-page → data-flow → tech-spec → plan-first → coding → deploy
           ↓ 自动审查     ↓ 自动审查      ↓ 自动审查    ↓ 自动审查    ↓ 自动审查    ↓ 自动施工
           失败暂停        失败暂停         失败暂停       失败暂停       失败暂停      失败暂停

### 审查闭环
审查问题累积到 review-issues.log → 累积 ≥ 3 → /retro 根因分析 → 升级开发体系

### 下一步
1. 用 /refine 细化你的第一个需求
2. 走完整设计链路（或用 /wf-new 一条龙）
3. /plan-first 生成施工图 → [Approved] → 自动施工
```


---

## pull 模式：全局模板 → 项目（拉取改进）

> **使用场景**：在另一个项目改进了技能卡后，用 sync 推到了全局模板，现在要把改进拉到当前项目。
> **触发**：`/init-project pull`
> **与 sync 的区别**：sync 是推（项目→模板），pull 是拉（模板→项目）

### 执行流程（3步）

### 第1步：对比差异

对比全局模板与当前项目，找出可拉取的改进：

```
对比范围：
├── .claude/skills/    ← 技能卡（模板有更新的版本）
└── CLAUDE.md          ← 通用规则（模板有新增的规则）
```

**对比方法**：
1. 列出模板中所有技能卡
2. 与项目的技能卡逐个对比（检查 skill.md 内容是否有差异）
3. 分类：**无冲突**（项目未修改） vs **有冲突**（两边都修改了）
4. 列出 CLAUDE.md 中模板有但项目没有的通用规则

### 第2步：展示差异清单，分类处理

**无冲突的技能卡**（项目未修改，模板有更新）→ 自动拉取，不需要确认

**有冲突的技能卡**（两边都修改了同一个技能卡）→ 展示差异，让你选择

```
📋 拉取同步报告

### 自动拉取（无冲突）
| 技能卡 | 变化摘要 | 操作 |
|--------|---------|------|
| /check-page | 新增桩功能检测 | → 自动更新 |
| /code-review | 新增安全扫描项 | → 自动更新 |

### ⚠️ 冲突（两边都改了，需要选择）
| 技能卡 | 项目版本变化 | 模板版本变化 |
|--------|------------|------------|
| /plan-first | 新增测试循环 | 新增并行化规则 |
| /wf-new | 修改提交策略 | 优化暂停逻辑 |

#### /plan-first 冲突详情
项目版本新增：
  - Layer 1T 后端测试层
  - 测试执行规则（红绿循环）
  - 提交前必须 vitest run 通过

模板版本新增：
  - Layer 并行化规则
  - 阶段级并行任务拆分

选择:
  1. 用模板版本（覆盖项目版本）
  2. 保留项目版本（跳过）
  3. 合并两者（AI 自动合并，推荐）

#### /wf-new 冲突详情
...

### 可更新的通用规则
- 新增 §10 测试驱动质量保障 → 自动更新

### 跳过（项目特有）
- 项目名称、技术栈、项目状态
- bushu/run 等业务配置
```

### 第3步：执行拉取

**拉取规则**：
- **无冲突的技能卡**：自动用模板版本更新
- **有冲突的技能卡**：按用户选择处理（覆盖/跳过/合并）
- **合并模式**：AI 读取两个版本，识别各自的新增内容，合并为一个完整版本，消除重复
- **CLAUDE.md**：只更新通用规则部分（§00-§10），保留项目特有内容
- **不覆盖**：项目特有的技能卡（bushu、run、sync-page 等）
- **不覆盖**：项目 CLAUDE.md 中的项目名称、技术栈、项目状态行

输出确认：
```
✅ 已从全局模板拉取改进

### 拉取内容
├── 自动更新: 2个技能卡（无冲突）
├── 冲突解决: 2个技能卡（用户选择）
│   ├── /plan-first → 合并 ✅
│   └── /wf-new → 保留项目版本
├── 通用规则: 1条新增
└── 项目特有内容: 已保留 ✅
```

## 内含规则

1. **合并不覆盖**：已有 `.claude/skills/` 目录，只添加不存在的技能卡
2. **权限合并不覆盖**：保留用户已有的 settings.json 配置，只追加权限规则
3. **设计系统可选**：如果项目不需要 Pencil 设计稿，跳过第5步
4. **交互式确认**：每个步骤都确认用户意图，不自动覆盖已有文件
5. **模板优先**：所有内容从全局模板复制，确保一致性

## 模板位置

```
~/.claude/project-template/
├── CLAUDE.md              项目协作指南模板
├── skills/ (45个)         核心技能卡
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
├── ~/.claude/settings.json ← 权限配置变化
└── 开发文档/结构       ← 文件夹结构变化（新增/重命名）
```

**对比方法**：
1. 列出项目的 `.claude/skills/` 中所有技能卡
2. 与模板中的技能卡逐个对比（检查 skill.md 文件内容是否有差异）
3. 列出项目中有但模板中没有的技能卡（新增）
4. 列出两边都有但内容不同的技能卡（改进）
5. 列出 CLAUDE.md 中的新增规则/流程
6. 对比 settings.json 权限配置变化

### 第2步：展示差异清单，确认同步

```
📋 进化同步报告

### 新增技能卡（项目有，模板无）
| 技能卡 | 说明 | 操作 |
|--------|------|------|
| /retro | 根因分析 | → 复制到模板 |

### 改进技能卡（两边都有，内容不同）
| 技能卡 | 变化摘要 | 操作 |
|--------|---------|------|
| /plan-first | 升级为施工图+自动施工模式 | → 更新模板 |
| /init-project | 新增权限配置步骤+风险自审规则 | → 更新模板 |

### CLAUDE.md 变化
- 新增操作风险自审规则（三级分级）
- 新增全自动流水线描述
→ 更新模板 CLAUDE.md

### 权限配置变化
- 新增中等风险操作白名单（git push/rm/curl）
- 新增 deny 规则（rm -rf/sudo/force push）
→ 更新模板 settings.json 参考

### 文件夹结构变化
- 无变化 ✅

是否同步以上变更到全局模板？（默认：是）
```

### 第3步：执行同步

**同步规则**：
- **新增技能卡**：直接复制到模板
- **改进技能卡**：用项目版本覆盖模板版本
- **CLAUDE.md**：提取通用规则部分更新模板，不复制项目特有内容（如项目名、端口映射、业务特定技能）
- **settings.json**：提取权限配置部分作为新项目参考，不复制密钥和环境变量
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
| `/save-ctx` `/load-ctx` `/db` `/dev-page` | |
| 权限白名单配置 | env 密钥和 API Token |

输出确认：
```
✅ 进化已同步到全局模板

### 同步内容
├── 新增技能卡: {N}个
├── 更新技能卡: {N}个
├── CLAUDE.md: 已更新通用规则（含风险自审）
├── 权限配置: 已保存为新项目参考
└── 文件夹结构: {无变化/已更新}

### 下次 /init-project 将自动包含这些进化
```
