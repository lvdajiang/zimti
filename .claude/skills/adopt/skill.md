---
name: adopt
description: 项目接驳 - 将已有项目逆向接入开发体系，提取schema+生成数据流+向前锁定规则
origin: project
---

# 项目接驳 `/adopt`

> **使用场景**：已有代码的项目要接入新开发体系时执行，将"代码先行"逆向翻译为"文档驱动"。
> **目标**：建立代码↔文档双向映射，让开发体系能读懂现有代码，从下一个改动开始接管。
> **前置**：`/init-project` 已完成（技能卡+文档结构+CLAUDE.md 就绪）
> **后置**：后续改动走完整链路（新页面）或改前补文档（已有页面）

## 用法

```
/adopt                          # 全量接驳（三步全部执行）
/adopt schema                   # 只执行第1步：提取共享定义
/adopt map                      # 只执行第2步：逆向生成地图
/adopt status                   # 查看接驳进度
```

---

## 核心思路

新体系的链路：`需求文档 → 设计规格 → 页面描述 → 设计稿 → 数据流 → 技术规格 → 代码`

老项目的现实：只有右半段（代码），左半段为空。

`/adopt` 不从头建文档，而是**从代码逆向提取**，建立"代码 ↔ 文档"的对应关系。

```
正向开发（新页面）：需求 → 文档 → 代码
逆向接驳（老页面）：代码 → 提取 → 文档 → 之后改代码时对照文档
```

---

## 执行步骤

### 第1步：立地基 — 提取 shared-schema.ts

从现有代码中逆向提取所有"已约定的命名"，建立唯一真相源。

#### 1.1 提取枚举（后端 → 前端对齐）

扫描以下来源：

| 来源 | 路径 | 提取什么 |
|------|------|---------|
| 后端模型 | `backend/app/models/*.py` | 所有枚举字段（status, type, role 等） |
| 后端 schema | `backend/app/schemas/*.py` | Pydantic 的 Literal 类型、枚举类 |
| 前端类型 | `frontend/src/types/*.ts` | TypeScript 的联合类型 |
| 前端 API | `frontend/src/api/*.ts` | 接口参数中的固定值 |

产出格式：

```typescript
// §1 枚举定义

export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled'
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  // ...
}
```

#### 1.2 提取 API 端点

扫描 `backend/app/api/` 下所有路由注册，提取：

```typescript
// §4 API 端点常量

export const API = {
  orders: {
    list: '/api/v1/orders',
    detail: (id: string) => `/api/v1/orders/${id}`,
    // ...
  }
} as const
```

#### 1.3 提取路由配置

扫描 `frontend/src/router/index.ts`，提取所有命名路由：

```typescript
// §5 路由配置

export const ROUTES = {
  admin: {
    orders: '/admin/orders',
    // ...
  }
} as const
```

#### 1.4 提取核心数据结构

扫描后端模型，生成 TypeScript Interface（只提取字段名和类型，不提取业务逻辑）：

```typescript
// §2 核心数据结构

export interface Order {
  id: number
  order_no: string
  status: OrderStatus
  // ...
}
```

#### 输出

```
✅ shared-schema.ts 已创建：开发文档/06-架构/shared-schema.ts
📊 枚举: {N}个 | API端点: {M}个 | 路由: {K}个 | 数据结构: {L}个
```

---

### 第2步：画地图 — 逆向生成页面清单 × 数据流

从代码中逆向提取每个页面的信息，生成两份文档。

#### 2.1 页面清单（→ `开发文档/02-设计/页面清单.md`）

逐个扫描路由配置，提取每个页面的：

| 提取项 | 来源 | 说明 |
|--------|------|------|
| 路由路径 | router/index.ts | 页面的 URL |
| 入口组件 | import 语句 | 主视图文件 |
| 子组件 | grep import | 页面引用了哪些组件 |
| 调用的 API | grep api/ | 页面调了哪些接口 |
| 页面类型 | 路径前缀 | admin / client / agency / miniprogram |

产出格式：

```markdown
## /admin/orders — 订单管理

| 项目 | 值 |
|------|-----|
| 入口 | views/admin/Orders.vue |
| 子组件 | DispatchTable, OrderDetail, ... |
| API | GET /api/v1/orders, PUT /api/v1/orders/{id}, ... |
| 类型 | admin |

## /agency/entity — 实体管理
...
```

#### 2.2 数据流文档（→ `开发文档/04-数据流/`）

对每个页面，从代码中逆向提取数据流桥接表：

| 提取项 | 来源 | 说明 |
|--------|------|------|
| 显示字段 | 模板中的 `{{ }}` / `:prop` | 页面展示了哪些数据 |
| 表单字段 | `<el-form-item>` / `<input>` | 用户可以编辑哪些字段 |
| API 请求参数 | api 调用的 payload | 提交给后端什么数据 |
| API 响应字段 | 类型定义 / 赋值语句 | 从后端拿到什么数据 |

产出格式（与 `/data-flow` 的输出格式一致）：

```markdown
### 显示字段

| 页面元素 | 字段名 | 来源类型 | 具体来源 | 备注 |
|---------|--------|---------|---------|------|
| 订单号 | order_no | 📥存储 | orders.order_no | 编号，只读 |
| ...

### API 调用

| 操作 | 方法 | 端点 | 入参 | 出参 |
|------|------|------|------|------|
| 获取列表 | GET | /api/v1/orders | {page, status} | {items, total} |
| ...
```

#### 输出

```
✅ 页面清单已生成：开发文档/02-设计/页面清单.md（{N}个页面）
✅ 数据流文档已生成：开发文档/04-数据流/（{M}个文件）
📊 覆盖率：{N}/{total} 页面（{percentage}%）
```

---

### 第3步：设规则 — 向前锁定

接驳完成后，更新 CLAUDE.md 中的**项目状态**和**协作规则**。

#### 3.1 更新 CLAUDE.md 项目状态

```markdown
## 项目状态

- **版本**: vX.X | **分支**: xxx | **阶段**: 体系接驳完成，向前锁定
- **接驳日期**: {日期}
- **schema 版本**: §1-§5 已提取，§3（表结构）待 /tech-spec 补充
- **页面文档覆盖率**: {N}/{total}（{percentage}%）
```

#### 3.2 确立向前规则

在 CLAUDE.md 中追加（或在项目记忆中记录）：

```markdown
## 老项目向前规则（接驳后生效）

### 改已有页面时
1. 先查 `shared-schema.ts` 确认字段命名
2. 改代码前先看 `04-数据流/` 中该页面的文档，确认改动范围
3. 如果发现文档与代码不一致，**以代码为准**更新文档
4. 如果新增了字段/API，同步更新 `shared-schema.ts`

### 新增页面时
走完整链路：`/refine` → `/design-spec` → ... → 编码 → `/check-page`

### 不要求一次性补齐
已有页面的设计规格（02-设计/）、页面描述（02-设计/）、技术规格（05-技术规格/）不需要一次性补齐。
等该页面需要大改时再补，避免文档和代码双重维护负担。
```

---

## 执行方式

### Subagent 模式（第1步、第2步）

第1步和第2步涉及大量文件扫描，必须使用 Agent tool：

```
Agent({
  subagent_type: "general-purpose",
  prompt: "执行 /adopt 第1步：从项目代码中逆向提取 shared-schema.ts..."
})
```

代理在独立上下文中扫描代码，产出文件内容，**主对话只确认结果**。

### 主对话模式（第3步）

第3步（更新规则）在主对话中执行，因为需要修改 CLAUDE.md。

---

## `/adopt status` 接驳进度查看

检查接驳完成度，输出：

```
📊 项目接驳进度

### 基础设施
| 项目 | 状态 |
|------|------|
| shared-schema.ts | ✅ 已创建 / ❌ 缺失 |
| 页面清单 | ✅ {N}个页面 / ❌ 缺失 |
| 数据流文档 | ✅ {M}个 / ❌ 缺失 |
| 向前规则 | ✅ 已写入 CLAUDE.md / ❌ 未写入 |

### Schema 覆盖率
| 模块 | 枚举 | API | 数据结构 |
|------|------|-----|---------|
| §1 枚举定义 | {N}个 | — | — |
| §4 API 端点 | — | {M}个 | — |
| §2 核心数据结构 | — | — | {K}个 |

### 文档覆盖率
| 页面 | 数据流文档 | 设计稿 |
|------|-----------|--------|
| /admin/orders | ✅ / ❌ | ✅ / ❌ |
| /admin/drivers | ✅ / ❌ | ✅ / ❌ |
| ... | ... | ... |
```

---

## 与其他技能的关系

```
/init-project → /adopt → （向前锁定）

/adopt 第1步（schema）    等价于 /init-schema 的逆向版
/adopt 第2步（页面清单）  输入给 /data-flow 的逆向版
/adopt 第3步（向前规则）  输入给 CLAUDE.md

接驳后的完整链路：
已有页面改动：查 schema → 查数据流文档 → 改代码 → 更新 schema/文档
新增页面：    /refine → /design-spec → ... → /check-page → 部署
```

| Skill | 与 /adopt 的关系 |
|-------|-----------------|
| `/init-project` | 前置条件：必须先有技能卡+文档结构+CLAUDE.md |
| `/init-schema` | 第1步的"正向版"：从需求文档提取 schema（新项目用） |
| `/data-flow` | 第2步的"正向版"：从设计稿生成数据流（新项目用） |
| `/project-review` | 接驳后执行，验证文档与代码的一致性 |
| `/check-page` | 接驳后每个改动前执行，对照数据流文档验证 |

---

## 注意事项

1. **不要试图一次性补齐所有文档**：数据流文档是最有价值的（直接指导编码），设计规格可以后续按需补
2. **以代码为准**：逆向提取时如果发现文档与代码不一致，代码是真相源，更新文档而非改代码
3. **Schema 是核心产出**：第1步的 shared-schema.ts 是最有价值的，即使其他步骤没做完也有用
4. **分批执行**：如果项目很大，可以按模块分批执行 `/adopt`（如 `/adopt admin` 只接驳 admin 模块）
5. **接驳不可逆**：一旦执行 `/adopt` 第3步（向前锁定），所有改动都必须遵守新规则
