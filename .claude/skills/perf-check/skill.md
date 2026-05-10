---
name: perf-check
description: 性能检查 - API数据量+响应时间+虚拟滚动+数据库查询
origin: project
---

# 性能预算检查 `/perf-check`

> **使用场景**：新增或修改列表页面、API接口时调用。也可定期执行作为性能巡检。
> **目标**：防止性能问题悄无声息地积累。

## 执行方式（Subagent 模式）

本技能通过 Subagent 执行分析，不占用主对话上下文。

**必须使用 Agent tool** 启动分析代理，传入以下参数：
- subagent_type: "general-purpose"
- prompt: 包含下方性能预算标准 + 检查步骤 + 目标代码路径

代理在独立上下文中读取代码、逐项检查性能指标，**只返回检查报告摘要给主对话**。禁止在主窗口中读取和分析代码。

## 性能预算标准

| 指标 | 预算 | 警告线 | 禁止线 |
|------|------|--------|--------|
| 单次API加载条数 | ≤ 100条 | 500条 | > 1000条 |
| API响应时间 | ≤ 500ms | 2秒 | > 5秒 |
| 表格虚拟滚动 | 必须开启（>100条时） | - | 原始渲染>1000条 |
| 前端包体积（单页） | ≤ 500KB | 1MB | > 2MB |
| 数据库查询（单次） | ≤ 1000条 | 5000条 | > 10000条 |
| 下拉选项数量 | ≤ 200条（本地搜索） | 1000条 | > 5000条无虚拟滚动 |

---

## 检查步骤

### 第1步：API数据量检查

扫描后端所有分页参数的默认值：

```bash
# 搜索所有 limit 参数的默认值
grep -rn "limit" backend/app/api/v1/endpoints/ --include="*.py" | grep -E "default|param"
```

**检查内容**：
- 是否有 `limit=1000` 甚至无 limit 的API
- 默认 limit 是否合理（建议 20-100）
- 是否支持后端分页（skip/limit 或 page/page_size）

**修复方案**：
- 超过预算的 limit 改为合理值
- 无分页的API添加分页支持
- 大数据量查询添加 `order_by` + `limit` 避免全表扫描

---

### 第2步：前端加载数据量检查

扫描前端所有 API 调用：

```bash
# 搜索前端中 limit 参数的使用
grep -rn "limit" frontend/src/api/ --include="*.ts"

# 搜索前端中一次性加载全部数据的模式
grep -rn "limit.*1000\|limit.*9999\|limit.*all\|skip=0" frontend/src/ --include="*.ts" --include="*.vue"
```

**检查内容**：
- 前端是否请求了超过预算的数据量
- 是否应该改为分页加载或虚拟滚动

---

### 第3步：表格组件虚拟滚动检查

扫描所有使用 `a-table` 的地方：

```bash
# 搜索所有 a-table 组件的使用
grep -rn "a-table\|<Table" frontend/src/components/ --include="*.vue"
```

**检查内容**：
- 数据量可能超过100条的表格是否启用了 `:virtual="true"`
- 是否有 `scroll.y` 设置但没有虚拟滚动
- 分页组件是否在 overflow 容器外部（防止裁切）

---

### 第4步：下拉选择器性能检查

扫描所有 `a-select` 组件：

```bash
# 搜索所有 a-select 组件
grep -rn "a-select" frontend/src/components/ --include="*.vue"
```

**检查内容**：
- 选项数据来源：是本地全量加载还是远程搜索
- 选项数量是否可能超过500条
- 是否启用了 `:virtual="true"`
- 是否有 `filterOption=false` + `@search` 处理中文输入法

---

### 第5步：数据库查询性能检查

扫描后端 ORM 查询：

```bash
# 搜索所有 .all() 调用（无分页的全量查询）
grep -rn "\.all()" backend/app/ --include="*.py"

# 搜索所有未带 order_by + limit 的查询
grep -rn "query(" backend/app/ --include="*.py" | grep -v "order_by\|limit\|first()"
```

**检查内容**：
- `.all()` 调用是否可能返回大量数据
- 查询是否有适当的索引支持（外键字段必须有索引）
- 是否存在 N+1 查询问题（循环中调用数据库）

---

## 输出格式

```
⚡ 性能预算检查报告

### API数据量
[✅/⚠️/❌] 说明

### 前端加载
[✅/⚠️/❌] 说明

### 表格虚拟滚动
[✅/⚠️/❌] 说明

### 下拉选择器
[✅/⚠️/❌] 说明

### 数据库查询
[✅/⚠️/❌] 说明

### 超预算问题清单
1. [文件:行号] 问题描述 → 建议修复方案
2. ...

### 优先级排序
- P0（必须立即修）: ...
- P1（本周修）: ...
- P2（排期修）: ...
```

---

## 与其他技能的关系

- 新增/修改列表页时：先用 `/perf-check` 检查预算
- 修完性能问题后：用 `/xgbug` 确保没引入新bug
- 部署前：用 `/deploy-check` 最终把关
