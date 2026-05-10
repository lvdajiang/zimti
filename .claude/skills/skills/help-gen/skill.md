---
name: help-gen
description: 帮助文档生成 - 基于设计稿和数据逻辑文档自动生成帮助页面草稿
origin: project
---

# 帮助文档生成 `/help-gen`

> **使用场景**：需要为某个页面生成帮助文档时调用。
> **目标**：基于设计稿和数据逻辑文档，自动生成结构化的帮助页面 Markdown 草稿。

## 用法

```
/help-gen admin/order-pool     # 生成管理员订单池的帮助文档
/help-gen agency/entity        # 生成旅行社实体库的帮助文档
/help-gen client/order         # 生成客户端订单管理的帮助文档
/help-gen --all admin          # 批量生成管理员端所有页面
/help-gen --all                # 批量生成所有页面的帮助文档
```

## 页面映射表

### 参数格式：`角色/页面简称`

| 参数 | 页面名称 | Vue 组件 | 帮助文档输出路径 |
|:-----|:---------|:---------|:----------------|
| admin/order-pool | 订单池 | OrderPoolTable.vue | help/guides/admin/order-pool.md |
| admin/dedup | 去重排序 | DedupTable.vue | help/guides/admin/dedup.md |
| admin/split | 拆分 | SplitTable.vue | help/guides/admin/split.md |
| admin/merge | 拼单 | MergeTable.vue | help/guides/admin/merge.md |
| admin/connect | 衔接 | ConnectTable.vue | help/guides/admin/connect.md |
| admin/dispatch | 派单 | DispatchTable.vue | help/guides/admin/dispatch.md |
| admin/drivers | 司机管理 | Drivers.vue | help/guides/admin/drivers.md |
| admin/business | 业务透视 | Business.vue | help/guides/admin/business.md |
| admin/driver-stats | 司机统计 | DriverStats.vue | help/guides/admin/driver-stats.md |
| admin/invoice | 发票管理 | InvoiceManage.vue | help/guides/admin/invoice.md |
| admin/exchange-rate | 汇率设置 | ExchangeRate.vue | help/guides/admin/exchange-rate.md |
| admin/finance-report | 财务报表 | FinanceReport.vue | help/guides/admin/finance-report.md |
| admin/settlement | 结算管理 | Settlement.vue | help/guides/admin/settlement.md |
| admin/transaction | 财务流水 | Transaction.vue | help/guides/admin/transaction.md |
| admin/public-webpage | 公共网页管理 | PublicWebpageManage.vue | help/guides/admin/public-webpage.md |
| admin/partner-agency | 合作旅行社 | PartnerAgencyManage.vue | help/guides/admin/partner-agency.md |
| admin/permission | 权限管理 | Permission.vue | help/guides/admin/permission.md |
| admin/system | 系统设置 | SystemSettings.vue | help/guides/admin/system.md |
| admin/feedback | 评价反馈 | Feedback.vue | help/guides/admin/feedback.md |
| admin/discount-rules | 折扣规则 | DiscountRules.vue | help/guides/admin/discount-rules.md |
| agency/entity | 实体库 | EntityLibrary.vue | help/guides/agency/entity.md |
| agency/resource | 资源库 | ResourceLibrary.vue | help/guides/agency/resource.md |
| agency/designer | 设计器 | Designer.vue | help/guides/agency/designer.md |
| agency/template | 模板库 | TemplateLibrary.vue | help/guides/agency/template.md |
| agency/team | 团队管理 | TeamManagement.vue | help/guides/agency/team.md |
| client/resource | 资源库 | ResourceLibrary.vue | help/guides/client/resource.md |
| client/template | 模板库 | TemplateLibrary.vue | help/guides/client/template.md |
| client/tourist | 游客管理 | TouristManagement.vue | help/guides/client/tourist.md |
| client/quotation | 报价器 | Quotation.vue | help/guides/client/quotation.md |
| client/order | 订单管理 | OrderManagement.vue | help/guides/client/order.md |
| client/execution-checklist | 执行清单 | ExecutionChecklist.vue | help/guides/client/execution-checklist.md |
| client/order-entry | 订单录入 | OrderEntry.vue | help/guides/client/order-entry.md |
| client/transaction | 流水记录 | TransactionHistory.vue | help/guides/client/transaction.md |
| client/security | 安全状态 | SecurityStatus.vue | help/guides/client/security.md |
| client/local-data | 本地数据 | LocalDataManage.vue | help/guides/client/local-data.md |
| client/reminder-board | 提醒看板 | ReminderBoard.vue | help/guides/client/reminder-board.md |
| client/settlement | 客户结算 | ClientSettlement.vue | help/guides/client/settlement.md |

## 执行步骤

### 第1步：确认目标（5秒）

解析参数，确定：
- **角色**（admin/agency/client/driver/service）
- **页面名称**
- **Vue 组件路径**：`frontend/src/views/{role}/{Component}.vue`
- **输出文件路径**：`help/guides/{role}/{page-name}.md`

### 第2步：读取 Vue 组件源码（30秒）

读取 `frontend/src/views/{role}/{Component}.vue`，提取：
- 页面标题和描述（从 template 中的标题/副标题）
- 表格列定义（从 columns 配置）
- 表单字段（从表单组件的 field/v-model）
- 操作按钮（新增、编辑、删除、导入、导出等）
- 筛选条件（搜索框、下拉筛选）
- 对话框（编辑、新增弹窗中的字段）

### 第3步：读取数据逻辑文档（15秒）

根据页面所属模块，读取相关文档：
- **订单/调度类**：`开发文档/04-数据流/调度管道核心算法说明.md`
- **资源/实体类**：`开发文档/04-数据流/实体库和资源库字段说明.md`
- **通用字段**：`开发文档/04-数据流/接送机派单系统数据逻辑详细说明_整合版.md`
- **数据模型**：`开发文档/04-数据流/数据模型和字段定义.md`
- **业务全景**：`开发文档/04-数据流/智派业务逻辑全景说明.md`

提取：
- 字段说明和枚举值
- 业务规则和约束
- 数据关联关系
- 状态流转

### 第4步：读取设计稿（可选，30秒）

**如果 shejigao.pen 中有对应页面设计**，使用 Pencil MCP 工具读取：
- 搜索页面名称
- 提取布局描述（用于"页面布局"章节）
- 提取按钮文案和标签页名称

**注意**：帮助文档不需要精确的颜色代码和尺寸，重点提取布局结构和交互说明。

### 第5步：生成 Markdown 文档

按照以下模板生成完整文档：

```markdown
---
title: [页面名称]
role: [admin/agency/client/driver/service]
module: [order/driver/finance/system/resource/template/marketing/tools]
difficulty: [beginner/intermediate/advanced]
type: guide
keywords: [关键词1, 关键词2, 关键词3]
---

# [页面名称]

> 一句话描述页面的核心功能和用途。

## 概述

[2-3句话说明这个页面做什么、解决什么问题、在整体业务流程中的位置]

## 访问路径

**菜单位置**: [角色端] → [一级菜单] → [二级菜单] → [页面名称]
**直接URL**: `http://39.97.59.179/[role-path]/[page-path]`

## 页面布局

[描述页面的主要区域布局]

| 区域 | 内容 | 说明 |
|------|------|------|
| 顶部操作栏 | [列出按钮：新增、导入、导出...] | [功能说明] |
| 搜索筛选区 | [列出筛选项] | [筛选说明] |
| 数据表格 | [列出主要列] | [表格说明] |
| 分页 | 底部分页组件 | 支持 XX 条/页 |

## 核心功能

### 功能1：[名称]

[详细描述这个功能的操作步骤，使用有序列表]

1. **步骤一**：描述
2. **步骤二**：描述
3. **步骤三**：描述

> **提示**: [操作提示或注意事项]

### 功能2：[名称]

[详细描述]

## 字段说明

| 字段名 | 显示名 | 说明 | 格式 |
|--------|--------|------|------|
| xxx | XXX | [从数据逻辑文档提取] | [如：YYYY-MM-DD] |
| xxx | XXX | [从数据逻辑文档提取] | [如：自动生成] |

## 筛选与搜索

| 筛选项 | 类型 | 说明 |
|--------|------|------|
| [筛选项名] | [下拉/日期/输入框] | [说明] |

## 常见操作

<details>
<summary>如何新增一条记录？</summary>

1. 点击顶部的「新增」按钮
2. 在弹出的对话框中填写必要字段
3. 点击「确定」保存

</details>

<details>
<summary>如何编辑已有记录？</summary>

1. 在表格中找到目标记录
2. 点击操作列的「编辑」按钮
3. 修改需要变更的字段
4. 点击「确定」保存

</details>

<details>
<summary>如何删除记录？</summary>

1. 在表格中找到目标记录
2. 点击操作列的「删除」按钮
3. 在确认对话框中点击「确定」

> **注意**: 删除操作不可撤销，请谨慎操作。

</details>

<details>
<summary>如何导出数据？</summary>

[根据组件中是否有导出功能来描述]

</details>

## 常见问题

<details>
<summary>[从业务逻辑中提取的常见问题]</summary>

[解答]

</details>

## 相关页面

- [相关页面1](/guides/[role]/[page])
- [相关页面2](/guides/[role]/[page])

---

<PageFeedback />
```

### 第6步：写入文件

将生成的 Markdown 写入 `help/guides/{role}/{page-name}.md`，覆盖已有的占位文件。

## 批量生成模式

### `--all` 参数

当使用 `--all` 或 `--all [role]` 时：

1. 列出映射表中对应的页面
2. 逐个执行第2-6步
3. 每生成一个页面后，向用户汇报进度

**建议顺序**：先按角色逐个生成，每个角色生成后暂停让用户审核。

### 批量生成输出示例

```
📝 help-gen 批量生成报告

✅ admin/order-pool → help/guides/admin/order-pool.md
✅ admin/dedup → help/guides/admin/dedup.md
✅ admin/split → help/guides/admin/split.md
⚠️ admin/merge → 设计稿中未找到对应页面，基于组件源码生成
✅ admin/connect → help/guides/admin/connect.md
✅ admin/dispatch → help/guides/admin/dispatch.md

共 6/6 页面生成完成
```

## 生成质量标准

每篇文档必须包含：
- [ ] frontmatter 标签完整（title/role/module/difficulty/type/keywords）
- [ ] 概述说明页面用途
- [ ] 访问路径明确
- [ ] 页面布局描述
- [ ] 核心功能有步骤说明
- [ ] 字段说明表格（从数据逻辑文档提取）
- [ ] 至少3个常见操作的折叠问答
- [ ] 至少1个常见问题
- [ ] 相关页面链接
- [ ] 底部有 PageFeedback 组件

## 与现有技能的关系

| 技能 | 数据源 | 输出 |
|:-----|:-------|:-----|
| dev-page | shejigao.pen + 数据逻辑文档 | Vue 组件代码 |
| check-page | shejigao.pen + 数据逻辑文档 + 组件代码 | 检查报告 |
| **help-gen** | Vue 组件代码 + 数据逻辑文档 + shejigao.pen | 帮助文档 Markdown |

`help-gen` 读取的信息来源与 `check-page` 相同，但输出目标不同：用户帮助文档而非开发检查报告。
