---
name: wf
description: 工作流 - /wf bug|dev|algo|deploy|day 一条龙流程
origin: project
---

# 一键工作流 `/wf`

> **使用场景**：需要执行完整的标准化流程时。
> **目标**：一条命令跑完整套流程，不用记组合。

## 用法

```
/wf dev [页面URL]        # 开发新页面完整流程
/wf bug [问题描述]       # 修bug完整流程
/wf algo [服务名]        # 修改算法完整流程
/wf deploy               # 部署完整流程
/wf new                  # 新功能开发全流程（需求→施工图→自动施工→检查→部署）
/wf day                  # 一天工作结束流程
/wf regression [改动文件] # 修复后回归检查流程
```

每个子命令也可以直接调用：`/wf-bug`、`/wf-dev`、`/wf-algo`、`/wf-deploy`、`/wf-new`、`/wf-day`

---

## /wf new — 新功能开发全流程

**触发**: `/wf new <需求描述>`

```
步骤1: /align          → 需求对齐（7问确认）
步骤2: /plan-first     → 生成施工图（分阶段任务+依赖+完成标准），用户确认 [Approved]
步骤3: [自动施工]      → 逐任务执行+验证循环（引擎: /plan-first Phase 2）
步骤4: /check-page     → 对照设计稿检查（有前端页面时）
步骤5: /perf-check     → 性能预算检查（列表页自动）
步骤6: /component-check → 组件统一性检查
步骤7: /deploy-check   → 部署前检查
步骤8: /bushu          → 部署到服务器
步骤9: /save-ctx       → 保存上下文到记忆文件
```

**说明**: 步骤2-3 使用 `/plan-first` 的施工图模式——Tech Spec 自动翻译为分阶段执行计划，批准后全程自动推进，仅在决策点和失败处暂停。详见 `/wf-new` 技能文件。

**详细说明**: 见 `/wf-new` 技能文件

---

## /wf dev — 开发新页面流程

**触发**: `/wf dev http://39.97.59.179/admin/xxx`

```
步骤1: /run          → 启动开发环境
步骤2: [用户开发]     → 用户和Claude协作完成页面开发
步骤3: /check-page   → 对照设计稿检查页面完整性
步骤4: /perf-check   → 性能预算检查
步骤5: /component-check → 组件统一性检查
步骤6: /deploy-check → 部署前检查
步骤7: /bushu        → 部署到服务器
```

**输出**: 每步完成后汇报，全部通过后显示"开发流程完成"。

---

## /wf bug — 修bug流程

**触发**: `/wf bug [问题描述]`

```
步骤1: /xgbug           → 确认→根因→扫描同类→修复→测试（6步全流程）
步骤2: /regression      → 回归检查：改动是否影响了其他页面/组件
步骤3: /component-check → 检查同类组件是否有相同问题
步骤4: /deploy-check    → 部署前检查
步骤5: /bushu           → 部署到服务器
```

**说明**:
- 步骤2（regression）检查的是"改了 A 会不会影响 B"
- 步骤3（component-check）检查的是"B 有没有和 A 一样的问题"
- 两者互补，先防回归再查同类

---

## /wf algo — 修改算法流程

**触发**: `/wf algo [dedup/split/combine/connect/dispatch]` 或 `/wf algo all`

```
步骤1: /scan-algo       → 结构化审查管道服务（排序、日期、业务规则、错误处理）
步骤2: [修复问题]        → 根据审查报告，用 /xgbug 修复发现的问题
步骤3: /scan-algo       → 修复后再次审查，确认问题已解决
步骤4: /deploy-check    → 部署前检查
步骤5: /bushu           → 部署到服务器
```

**说明**: 步骤3是关键 — 修复后必须再审查一遍，确认没有引入新问题。

---

## /wf deploy — 部署流程

**触发**: `/wf deploy`

```
步骤1: /deploy-check    → 硬编码扫描 + 影响分析 + 排序检查 + 冒烟测试 + 构建验证
步骤2: [如有问题]        → 修复发现的问题
步骤3: /bushu           → 部署到服务器
步骤4: [生产验证]        → 在生产环境快速验证核心功能
```

**说明**: 如果步骤1发现严重问题（❌），停止部署，修复后重新执行。

---

## /wf day — 一天工作结束流程

**触发**: `/wf day`

```
步骤1: /save-ctx        → 保存本次会话上下文到记忆文件（含CLAUDE.md更新检查）
步骤2: 汇报今日工作      → 列出本次会话完成的内容
步骤3: 列出下次待办      → 从记忆文件中提取未完成的工作
```

**输出格式**:
```
📋 今日工作总结

### 完成了什么
- [完成项1]
- [完成项2]

### 下次待办
- [ ] [待办1]
- [ ] [待办2]

💾 上下文已保存，下次会话将自动加载。
```

---

## /wf review — 全面审查修复流程

**触发**: `/wf review [范围]`

```
步骤1: 并行双扫描（Agent Team 模式）
  ├── Agent A: /code-review → 6类质量扫描（性能/错误处理/编号/死代码/风格/假操作）
  └── Agent B: /scan-bugs   → 6类功能bug扫描（逻辑/数据流/异常/边界/并发/配置）
步骤2: 合并去重          → 双扫描结果合并去重，按严重度排序
步骤3: /code-fix         → 按清单逐项修复
步骤4: /regression       → 回归检查：修复是否影响了其他页面/组件
步骤5: 并行验证扫描（Agent Team 模式）
  ├── Agent A: /code-review → 确认质量问题已解决
  └── Agent B: /scan-bugs   → 确认功能bug已解决
步骤6: /deploy-check     → 部署前检查
步骤7: /bushu            → 部署到服务器
```

**并行执行说明**:
- 步骤1：使用 Agent tool 同时启动两个 Subagent，一个跑 code-review，一个跑 scan-bugs。两个 Subagent 独立执行，结果都返回后合并去重
- 步骤5：同理，两个 Subagent 并行验证，确认所有问题已解决
- 如果步骤5发现新问题，回到步骤3继续修复

---

## 流程图

```
/wf dev:        run → 开发 → check-page → perf-check → component-check → deploy-check → bushu
/wf bug:        xgbug → regression → component-check → deploy-check → bushu
/wf algo:       scan-algo → xgbug → scan-algo → deploy-check → bushu
/wf review:     双扫描 → code-fix → regression → 再扫描 → deploy-check → bushu
/wf deploy:     deploy-check → bushu → 生产验证
/wf day:        save-ctx → 今日汇报 → 下次待办
/wf new:        align → plan-first(施工图+自动施工) → check-page → perf-check → component-check → deploy-check → bushu
/wf regression: regression → 汇报影响范围
```

## 原则

- **每步汇报**: 每个技能执行完后向用户汇报结果，不静默跳过
- **可中断**: 任何步骤失败时暂停，等待用户决定继续还是中止
- **不跳步**: 不允许跳过检查步骤（除非用户明确说"快速跳过"）
