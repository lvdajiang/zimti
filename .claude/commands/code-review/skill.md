# 代码审查 `/code-review`

> **使用场景**：审查任何页面/组件/服务的代码质量，不需要设计稿。
> **目标**：自动化发现性能、错误处理、编号规范、死代码、风格一致性问题。

## 执行方式（Subagent 模式）

本技能通过 Subagent 执行分析，不占用主对话上下文。

**必须使用 Agent tool** 启动分析代理，传入以下参数：
- subagent_type: "general-purpose"
- prompt: 包含下方完整审查清单 + 目标代码路径

代理在独立上下文中读取代码、执行审查，**只返回问题清单摘要给主对话**。禁止在主窗口中读取和分析代码。

## 用法

```
/code-review client                    # 审查整个客户端
/code-review admin                     # 审查管理后台
/code-review client/OrderTable.vue     # 审查单个组件
/code-review backend/services          # 审查后端服务目录
```

## 执行步骤

### 第1步：确认审查范围（5秒）

根据参数确定：
- **目录/文件范围**：需要扫描的目录或文件
- **文件类型**：`.vue` / `.ts` / `.py` 等
- **预估文件数量**：决定并行策略

### 第2步：自动化扫描（30秒）

使用 grep/代码分析工具，逐项检查以下6类问题：

#### 2.1 性能扫描

```bash
# 前端：pageSize 超标（>100 为警告，>1000 为严重）
grep -rn "pageSize" frontend/src/ --include="*.vue" --include="*.ts"
# 后端：SQL 查询无 limit
grep -rn "select(" backend/app/ --include="*.py" | grep -v "limit"
# 前端：全量加载模式
grep -rn "加载所有数据" frontend/src/ --include="*.vue"
```

**通过条件**：
- ✅ 所有 API 调用 `pageSize ≤ 100`
- ✅ 后端查询有 limit/分页
- ✅ 无 "加载所有数据用于前端搜索" 注释

#### 2.2 错误处理扫描

```bash
# catch 块中缺少 message.error
grep -A2 "catch" frontend/src/ --include="*.vue" | grep -v "message.error" | grep "console.error"
# 后端：裸 except
grep -rn "except:" backend/app/ --include="*.py"
```

**通过条件**：
- ✅ 所有 `catch` 块都有用户提示（`message.error` 或 `message.warning`）
- ✅ 后端无裸 `except:`

#### 2.3 编号规范扫描

```bash
# 前端：不规范的ID生成
grep -rn "Date.now()\|Math.random()\|\.length.*padStart" frontend/src/ --include="*.vue" --include="*.ts"
# 后端：硬编码编号
grep -rn "ORD\|TSK\|RES\|DSP" backend/app/ --include="*.py" | grep -v "service\|config"
```

**通过条件**：
- ✅ 编号通过后端编号生成服务创建
- ✅ 前端不自行拼接编号

#### 2.4 死代码扫描

```bash
# 定义了但未调用的函数
grep -rn "const.*=.*(" frontend/src/ --include="*.vue" | ...
# 未使用的导入
grep -rn "import.*from" frontend/src/ --include="*.vue" | ...
# 空函数体
grep -rn "= () => {}\|= ()$" frontend/src/ --include="*.vue"
```

**通过条件**：
- ✅ 无未调用的函数
- ✅ 无未使用的导入
- ✅ 无空函数体

#### 2.5 风格一致性扫描

```bash
# fetch vs @/api 混用
grep -rn "await fetch(" frontend/src/ --include="*.vue" --include="*.ts"
# mode="tags" 违规
grep -rn 'mode="tags"' frontend/src/ --include="*.vue"
# console.log 残留
grep -rn "console\." frontend/src/ --include="*.vue" --include="*.ts" | grep -v "node_modules"
```

**通过条件**：
- ✅ 统一使用 `@/api/xxx` 封装（不直接 fetch）
- ✅ 无 `mode="tags"` 使用
- ✅ 无 `console.log` 残留

#### 2.6 假操作扫描

```bash
# 只有 message.success 但没有 API 调用的函数
grep -B5 "message.success" frontend/src/ --include="*.vue" | grep -v "await\|fetch\|axios"
# localStorage 做持久化（应该用后端API）
grep -rn "localStorage" frontend/src/ --include="*.vue" --include="*.ts"
```

**通过条件**：
- ✅ 每个 `message.success` 前都有实际的 API 调用
- ✅ 关键数据不依赖 localStorage 持久化

### 第3步：人工审查（30秒）

对自动化扫描无法覆盖的项进行人工检查：

| 检查项 | 方法 |
|--------|------|
| 数据一致性 | 前端字段名是否与后端 API 返回匹配 |
| 权限控制 | 是否有未保护的敏感操作 |
| 并发安全 | 编辑/删除操作是否有竞态条件 |
| 类型安全 | TypeScript 类型是否完整（any 滥用） |

### 第4步：输出审查报告

```
📋 代码审查报告 — [审查范围]

文件数量：[N个]
审查时间：[时间]

### 扫描结果汇总

| 类别 | ✅通过 | ⚠️警告 | ❌严重 |
|------|--------|--------|--------|
| 性能 | N | N | N |
| 错误处理 | N | N | N |
| 编号规范 | N | N | N |
| 死代码 | N | N | N |
| 风格一致性 | N | N | N |
| 假操作 | N | N | N |

### 发现的问题

| # | 严重程度 | 类别 | 文件:行号 | 问题描述 | 建议修复 |
|---|---------|------|----------|---------|---------|
| 1 | ❌高 | 性能 | xxx:L42 | pageSize=1000 | 改为后端分页 |
| 2 | ⚠️中 | 错误处理 | xxx:L63 | catch无用户提示 | 加message.error |
| 3 | ⚠️中 | 风格 | xxx:L15 | 使用fetch而非api封装 | 改用@/api/xxx |
| 4 | 💡低 | 死代码 | xxx:L100 | applySearch未调用 | 删除或改用 |

### 改进建议
1. [具体建议]
2. [具体建议]
```

## 与其他 skill 的关系

| Skill | 用途 | 区别 |
|-------|------|------|
| `/code-review` | 纯代码质量审查 | 不需要设计稿，只审代码 |
| `/check-page` | 对照设计稿检查页面 | 需要设计稿+数据文档 |
| `/perf-check` | 性能预算巡检 | 只检查性能，更深入 |
| `/component-check` | 组件统一性检查 | 只检查组件一致性 |

## 严重程度定义

| 标记 | 含义 | 示例 |
|------|------|------|
| ❌ 高 | 功能缺陷或严重违规 | 假操作、pageSize>1000、编号重复 |
| ⚠️ 中 | 代码质量问题 | 无错误提示、fetch混用、死代码 |
| 💡 低 | 规范建议 | 空函数、UI不一致、localStorage |

## 注意事项

- 自动化扫描覆盖 80% 的常见问题，剩余 20% 需要人工判断
- 审查结果按严重程度排序，高优先级问题应先修复
- 扫描结果可能包含误报（如测试文件中的 console.log），需人工过滤
- 建议与 `/xgbug` 配合：先用 `/code-review` 发现问题，再用 `/xgbug` 修复
