---
name: component-check
description: 组件检查 - 扫描同类组件差异，推动封装公共组件
origin: project
---

# 组件统一性检查 `/component-check`

> **使用场景**：修改任何共享模式的组件时调用（如admin下的6个Table、表单对话框、搜索选择器等）。
> **目标**：一次修复，全局生效。消灭"同类bug反复出现"。

## 执行方式（Subagent 模式）

本技能通过 Subagent 执行分析，不占用主对话上下文。

**必须使用 Agent tool** 启动分析代理，传入以下参数：
- subagent_type: "general-purpose"
- prompt: 包含下方完整检查步骤 + 中文输入法搜索方案 + 组件族路径

代理在独立上下文中读取组件代码、对比差异，**只返回差异报告摘要给主对话**。禁止在主窗口中读取和对比组件代码。

---

## 触发条件

以下情况应主动调用 `/component-check`：

1. 修改了 admin 目录下某个 Table 组件的布局/分页/滚动样式
2. 修改了某个表单对话框的交互逻辑（搜索、校验、提交）
3. 修改了某个下拉选择器的搜索/过滤/拼音方案
4. 修改了某个通用工具函数（日期处理、排序、格式化）
5. 修复了某个组件的bug，且该模式在其他页面也使用

---

## 检查步骤

### 第1步：识别组件族

根据当前修改的组件，找出所有同类组件：

**admin Table 组件族**（6个）：
```
frontend/src/components/admin/OrderPoolTable.vue
frontend/src/components/admin/DedupTable.vue
frontend/src/components/admin/SplitTable.vue
frontend/src/components/admin/MergeTable.vue
frontend/src/components/admin/ConnectTable.vue
frontend/src/components/admin/DispatchTable.vue
```

**搜索选择器组件族**（出发地/抵达地/关联资源）：
```
所有包含 a-select + show-search 的 .vue 文件
所有包含 a-auto-complete 的 .vue 文件
```

**表单对话框组件族**：
```
所有包含 a-modal + a-form 的 .vue 文件
```

**通用工具函数族**：
```
frontend/src/utils/ 下的所有 .ts 文件
backend/app/services/ 下的所有 .py 文件
```

---

### 第2步：对比实现差异

对组件族中的每个成员，对比以下维度：

| 维度 | 对比内容 |
|------|---------|
| **表格结构** | a-table 的 props（scroll.y、pagination、row-key）是否一致 |
| **分页实现** | 分页组件位置（容器内/外）、分页参数是否一致 |
| **搜索过滤** | filterOption 实现方式（内置/禁用+@search）、拼音支持 |
| **样式** | 相同功能区域的 CSS 是否统一（颜色、间距、字体） |
| **数据加载** | API 调用方式（limit值、排序方式、错误处理） |
| **交互行为** | 编辑/删除/保存的交互流程是否一致 |

---

### 第3步：生成差异报告

```
🔍 组件统一性检查报告

组件族：[组件类型]
成员数量：N 个

### 实现差异

| 维度 | 文件A | 文件B | 文件C | ... |
|------|-------|-------|-------|-----|
| scroll.y | calc(100vh-380px) | calc(100vh-360px) | 未设置 | ... |
| 分页位置 | 表格外 | 表格内 | 表格内 | ... |
| 搜索方式 | @search | filterOption | 无搜索 | ... |

### 建议行动

- [ ] 统一 scroll.y 为 calc(100vh - 380px)
- [ ] 统一分页组件放到表格容器外部
- [ ] 统一搜索方式为 filterOption=false + @search
```

---

### 第4步：推动封装

如果差异超过3处，建议封装公共组件：

**admin Table 封装方案**：
```
创建：frontend/src/components/admin/AdminDataTable.vue
Props: columns, dataSource, loading, rowKey, extraSlots
内置：scroll.y + 外置pagination + 冻结表头 + 统一样式
```

**搜索选择器封装方案**：
```
创建：frontend/src/components/common/SearchSelect.vue
Props: options, value, placeholder, multiple, remoteSearch
内置：filterOption=false + @search + 拼音匹配 + 虚拟滚动
```

---

## 中文输入法搜索方案（标准方案，组件统一性核心）

所有下拉搜索组件必须统一为以下方案，禁止偏离：

- **单选下拉**: `a-select` + `:filter-option="false"` + `@search` + 拼音首字母匹配
- **多选下拉**: `a-select` + `:filter-option` + 拼音首字母匹配
- **拼音工具**: `frontend/src/utils/pinyin.ts`
- **禁止**: `mode="tags"`（吞输入）、纯 `filterOption`（IME干扰）

检查时重点对比：搜索触发方式、拼音匹配实现、IME兼容处理是否一致。

---

## 与 `/xgbug` 的关系

- `/xgbug` 步骤3（扫描同类问题）负责发现同类bug
- `/component-check` 负责发现结构性的实现差异
- 两者互补：bug修复用 xgbug，架构统一用 component-check
- 最佳实践：修完bug后用 component-check 检查是否该封装

---

## 执行原则

1. **发现差异 → 先统一 → 再封装**：不要一上来就封装，先统一实现，确认方案稳定后再提取
2. **渐进式封装**：不要一次重构所有组件，先封装最常用的模式
3. **保持灵活性**：公共组件通过 props 和 slots 留出定制空间
4. **文档先行**：封装前先写清楚 props 接口和用法示例
