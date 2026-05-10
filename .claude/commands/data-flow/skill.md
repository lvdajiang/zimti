---
name: data-flow
description: 数据流设计 - 从设计稿和数据逻辑文档自动生成页面数据桥接表
origin: project
---

# 数据流设计 `/data-flow`

> **使用场景**：页面需求明确后、编码前，设计该页面的数据流向。
> **目标**：产出"页面→字段→API→状态"桥接表，确保编码前数据流想清楚。
> **位置**：在 `/refine` 之后、`/plan-first` 之前执行。

## 用法

```
/data-flow admin/order-pool        # 为订单池页面生成数据流
/data-flow client/resource         # 为资源库页面生成数据流
/data-flow driver/trips            # 为司机行程页面生成数据流
```

## 执行步骤

### 第1步：读取设计稿和数据逻辑文档

1. 使用 Pencil MCP 读取 `开发文档/03-视觉/shejigao.pen` 中对应页面的设计
2. 读取 `开发文档/04-数据流/` 中对应的字段定义
3. 读取 `开发文档/06-架构/architecture.md` 中的编号和数据架构规则

### 第2步：字段提取与溯源

从设计稿中提取所有页面元素，标注每个字段的数据来源：

```
### 显示字段

| 页面元素 | 字段名 | 来源类型 | 具体来源 | 备注 |
|---------|--------|---------|---------|------|
| ORD-20260301-001 | order_no | 📥存储 | orders.order_no | 编号，只读 |
| 北京国旅 | customer_name | 🔗调用 | entities.name via entity_code | 关联查询 |
| 3个任务 | task_count | 📊计算 | count(tasks) | 后端计算 |
| 状态标签 | status | 📥存储 | orders.status | 映射为颜色标签 |
```

**来源类型标注规则**：
- 📥存储：直接从数据库表读取
- 🔗调用：通过外键关联其他表获取
- 📊计算：需要后端计算（COUNT/SUM/逻辑运算）
- ⛔禁止：不应出现在此处，如果出现说明设计有问题

### 第3步：操作与API契约

对每个可操作的元素（按钮、表单、输入框），设计API：

```
### 操作

| 按钮/操作 | HTTP方法 | API端点 | 请求体 | 响应 | 变更数据 | 刷新范围 |
|----------|---------|---------|-------|------|---------|---------|
| 加载列表 | GET | /api/v1/orders | ?page=1&limit=50 | {total, items} | 无 | 整个列表 |
| 派单 | POST | /api/v1/dispatch | {order_ids, driver_id} | {dispatch_id} | orders.status, dispatch表 | 当前行+派单列表 |
| 取消 | PATCH | /api/v1/orders/:id | {status: cancelled} | {success} | orders.status | 当前行 |
| 搜索 | GET | /api/v1/orders | ?keyword=xxx | {total, items} | 无 | 整个列表 |
```

### 第4步：前端状态设计

定义数据在前端的流转路径：

```
### 状态管理

| 数据 | 存储位置 | 初始化时机 | 更新触发 |
|------|---------|-----------|---------|
| 订单列表 | Pinia Store: orderStore | 页面加载时 | 搜索/翻页/筛选变更 |
| 当前筛选条件 | URL参数 | 从URL解析 | 用户修改筛选 |
| 派单对话框可见性 | 组件本地 state | 默认false | 点击派单按钮 |
| 加载状态 | 组件本地 ref | 默认true | API请求前后 |
```

### 第5步：状态流转图

如果页面涉及状态变更，画出状态机：

```
### 状态流转

订单状态：draft → confirmed → dispatched → in_progress → completed
                                              ↓
                                          cancelled（confirmed之后任意阶段）

允许的转换：
- draft → confirmed：旅行社确认
- confirmed → dispatched：管理员派单
- dispatched → in_progress：司机开始执行
- in_progress → completed：司机完成
- * → cancelled：对应角色取消
```

---

## 输出格式

```
📋 数据流设计 — [页面名称]

## 1. 显示字段
[第2步产出的字段溯源表]

## 2. 操作与API
[第3步产出的API契约表]

## 3. 前端状态
[第4步产出的状态管理表]

## 4. 状态流转
[第5步产出的状态机图]

## 5. 待确认项
- [数据来源不明确的字段]
- [需要后端新增的API]
- [需要新建的数据库字段]

## 6. 对现有系统的影响
- [新增了哪些API]
- [修改了哪些表]
- [影响了哪些其他页面]
```

然后**保存到文件**：`开发文档/04-数据流/{页面名}-数据流.md`

输出确认：
```
✅ 数据流已生成：开发文档/04-数据流/{页面名}-数据流.md
📊 覆盖：字段溯源(📥🔗📊⛔) / API契约 / 前端状态 / 状态流转 / 系统影响
→ 下一步：/tech-spec [页面名称]（生成技术规格）
```

---

## 与其他技能的关系

```
/design-page → /data-flow → /tech-spec → /align → /plan-first → 编码
 视觉稿        数据流        技术蓝图     确认边界   制定计划
```

- `/design-page` 产出的 Pencil 设计稿是本技能的输入来源
- 本技能产出的 API 契约和字段溯源，是 `/tech-spec` 的核心输入
- 本技能的"对现有系统的影响"是 `/regression` 的输入
- 本技能的"对现有系统的影响"是 `/regression` 的输入

## 执行原则

1. **每个字段必须有来源标注**，不允许出现"待定"来源的字段（要么想清楚，要么标记为待确认）
2. **API设计遵循REST规范**（参考 `开发文档/06-架构/api-specification.md`）
3. **所有编号字段必须通过编号生成服务创建**（参考安全底线规则）
4. **优先复用已有API**，只有在现有API无法满足时才新增
