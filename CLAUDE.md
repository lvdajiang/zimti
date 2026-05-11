# Zimti - 项目协作指南

> **版本**: v1.0 | **更新日期**: 2026-05-09
> **核心原则**: 质量优先，代码可维护性第一
> **技术栈**: Node.js(TypeScript) + Vue + PostgreSQL + Remotion
> **详细技术规范**: 见各技能卡，本文档只包含行为规则

---

## 语言规则

本项目所有沟通、注释、文档使用中文。代码标识符（变量名、函数名、类名）使用英文。

## 操作风险自审规则（权限已自动通过，由 Claude 自主判断风险）

用户已授权所有操作自动通过，不再手动审批。Claude 必须替代用户做风险判断：

### 无需通知，直接执行

- 读文件、搜索、查看状态等只读操作
- 编辑/创建项目代码文件（src/、packages/、开发文档/、scripts/）
- 运行测试、构建、类型检查、lint
- git add、git commit、git checkout、git stash
- pnpm/npm 安装依赖、运行脚本
- prisma 数据库操作

### 先用中文一句话说明，等 3 秒再执行（给用户取消的机会）

- `git push` — 说明推送到哪个分支
- `git reset` / `git restore` — 说明要丢弃什么
- `rm` 删除文件 — 说明要删哪个文件
- `git merge` — 说明合并哪两个分支
- `curl` / `wget` 网络请求 — 说明请求什么地址
- `gh pr create` — 说明创建什么 PR
- 修改 `.env` 或包含密钥的配置文件

### 必须询问用户（高风险）

- `git push --force` — 强制推送
- `git reset --hard` — 硬重置
- 删除 `node_modules` 或大型目录
- 修改数据库连接配置或密钥
- 修改部署相关配置（Dockerfile、nginx.conf、docker-compose.yml）

---

## 安全底线（强制，不可下沉）

- **禁止拼接SQL字符串**，必须参数化查询
- **所有外键字段必须建立索引**
- **编号/ID必须唯一且不可修改**
- **所有公共函数必须添加类型注解**
- **错误必须使用自定义异常类处理**

---

## 协作工作流程规范

### 00 先确认问题，再开始工作（强制）
报告问题时先确认：哪个页面/组件？具体表现？等用户确认再动手。

### 01 先描述方法，等待批准（技能: `/plan-first`）
### 02 需求模糊时先澄清
### 03 完成代码后列出边缘案例
### 04 超过3个文件时拆分任务
### 05 bug 系统化修复（修一类非一个）
### 06 每次纠正时提炼规则

### 07 改前查规范（强制门禁）
编辑代码前先查阅设计文档和技能卡，禁止凭经验直接改：
- UI/样式 → 设计稿 + `/check-page`
- 数据模型 → 数据流文档
- TDD范围 → `/plan-first`
- 需求对齐 → `/align`

### 08 改后验证再提交（强制门禁）
完成前必须验证：前端→浏览器确认，后端→API确认，通用→检查同类组件。
完成标准：必须明确输出"已验证：xxx 功能正常"

### 09 Schema 增量维护（强制门禁，全自动）
**编码过程中引入任何新的命名时，必须立即更新 `shared-schema.ts`。**

- 新字段 → 加到对应表的 TypeScript Interface
- 新枚举值 → 加到对应 Union Type + Label Map
- 新 API 端点 → 加到 API 常量对象
- 新路由 → 加到 ROUTES 常量
- 禁止在业务代码中硬编码 schema 中不存在的枚举值或API路径

**提交前自动检查**：
- `npx tsx scripts/schema-check.ts` 检查全部源码是否与 schema 对齐
- `npx tsx scripts/schema-check.ts --staged` 只检查待提交文件
- 发现违规 → 必须先更新 schema 再提交
- git pre-commit hook 已配置，自动执行此检查

### 10 测试驱动质量保障（强制门禁，全自动）

**每个编码任务完成后，必须运行测试确认功能正确。**

- 后端 API 任务 → 自动生成集成测试（vitest + supertest），覆盖正常+校验+错误+边界
- Store/Service 任务 → 自动生成单元测试，覆盖状态流转+计算逻辑
- 纯展示组件 → 类型检查 + /check-page 替代测试
- 每个阶段完成后 → `pnpm vitest run` 全量通过才可提交
- 测试失败 → 自动修复（最多3次），修复实现代码而非修改测试
- 回归检测 → 已有测试变红必须修复，不允许跳过

---

## LLM 编码行为准则

1. **编码前思考**: 不确定时提问不猜测，有更简单方案时推回讨论
2. **简单优先**: 只实现明确请求的功能，200行能完成不写1000行
3. **精确修改**: 不顺便重构/删死代码，每个改动可追溯到用户请求
4. **目标驱动**: 添加验证→先写测试，修bug→先重现，多步骤→先陈述计划

---

## 任务执行规范

### 快速通道（可跳过计划直接执行）
- 预计耗时 < 10 分钟 | 只涉及 1 个文件 | 无破坏性变更

### 必须创建计划（PLAN.md）
- 多步骤任务（> 3个子任务）| 涉及多个文件/模块 | 有架构设计决策 | 需要数据模型变更

### 自动执行（不询问）
- 技术实现细节选择 | 代码格式调整、注释更新 | Bug修复（不涉及业务逻辑变更）

### 必须询问用户
- 涉及业务逻辑变更 | 多种功能方案需要选择 | 可能影响系统架构 | 可能导致数据丢失

---

## 文档路径索引

- 需求文档: `开发文档/01-需求/`
- 设计规格/页面描述: `开发文档/02-设计/`
- UI设计: `开发文档/03-视觉/`
- 数据模型/字段定义: `开发文档/04-数据流/`
- 技术规格: `开发文档/05-技术规格/`
- 架构/数据库/编号: `开发文档/06-架构/`
- **共享定义(唯一真相源)**: `开发文档/06-架构/shared-schema.ts`
- 项目配置: `开发文档/00-项目/`

---

## 技能速查（按类型分组）

### 行为规则类
`/refine` 需求细化(想法→需求) | `/init-schema` 建立共享定义(需求→命名锚点) | `/design-spec` 设计规格(需求→7要素文档) | `/design-detail` 页面描述(设计规格→逐页蓝图) | `/design-page` 视觉设计(页面描述→Pencil稿) | `/data-flow` 数据流设计(页面→API+扩展schema) | `/tech-spec` 技术规格(数据流→编码蓝图+扩展schema) | `/align` 对齐理解(7问+穷举) | `/plan-first` 施工图+自动施工(Tech Spec→分阶段执行计划→逐任务自动推进) | `/plan` 结构化计划(批量多页面) | `/brainstorming` 头脑风暴

### 分析审查类（Subagent 模式，不占主窗口）
`/project-review` 项目配置完整性 | `/req-review` 需求无歧义+可测试 | `/spec-review` 设计规格7要素完整性 | `/design-review` 页面描述跨页面一致性 | `/dataflow-review` 数据流字段溯源+API一致性 | `/techspec-review` 技术规格与数据流对齐 | `/code-review` 代码质量6类扫描 | `/check-page` 页面对照设计稿(UI规范) | `/component-check` 组件统一性 | `/perf-check` 性能预算巡检 | `/deploy-check` 部署前检查 | `/regression` 回归影响检查 | `/status` 项目进度

### 修复执行类
`/xgbug` 系统化修bug(6步) | `/code-fix` 按清单逐项修复

### 工具类
`/git-clean` Git清理 | `/db` 数据库查询 | `/save-ctx` `/load-ctx` 上下文存取

---

## 日常流程

> 每个阶段产出后必须执行：审查 → 修复 → 再进入下一阶段

```
项目初始化:        /init-project → /project-review → 修复
模糊想法→需求:    /refine <想法描述> → /req-review → 修复
需求→命名锚点:    /init-schema（建立 shared-schema.ts，后续阶段只引用不创造）
需求→设计规格:    /design-spec [页面名称] → /spec-review → 修复
设计规格→页面描述: /design-detail [页面名称] → /design-review → 修复
页面描述→视觉稿:  /design-page [页面名称] → /check-page → 修复
设计稿→数据流:    /data-flow [页面路径] → /dataflow-review → 修复（完成后扩展schema §4§6）
数据流→技术规格:  /tech-spec [页面名称] → /techspec-review → 修复（完成后扩展schema §3§5）
修bug（已知）:    /xgbug [问题描述]
代码审查:         /code-review [审查范围]
会话结束:         /save-ctx
```

完整链路（含审查门禁）：
`/init-project` → **审查** → `/refine` → **审查** → `/init-schema` → `/design-spec` → **审查** → `/design-detail` → **审查** → `/design-page` → **审查** → `/data-flow` → **审查** → `/tech-spec` → **审查** → `/align` → `/plan-first`(施工图+自动施工) → `/check-page` → 部署

全自动流水线（需求完善时，一键出结果）：
`/wf-full [页面名]` — 自动串联 design-spec → design-detail → design-page → data-flow → tech-spec → plan-first → check-page → 部署，每步自动审查，失败才暂停

---

## 项目状态

- **版本**: v1.0 | **分支**: main | **阶段**: 全量功能完成（GLM/即梦AI/Pexels/TTS/Remotion/Stub清零），待前端优化+上线部署
