---
name: tech-spec
description: 数据流→技术规格，把设计稿翻译为开发者可直接编码的技术蓝图
origin: project
---

# 技术规格 `/tech-spec`

> **使用场景**：`/data-flow` 完成数据流设计后，生成"设计→代码"的翻译文档。
> **前置**：页面描述 + Pencil设计稿 + 数据流文档
> **后置**：`/plan-first`（拆任务）或直接编码
> **输出**：`开发文档/05-技术规格/{页面名}-技术规格.md`

## 用法

```
/tech-spec                    # 交互式，选择页面
/tech-spec 司机订单列表页      # 带页面名称直接生成
```

## 执行流程（3步）

### 第1步：收集输入

读取以下文件，确保齐全：

| 输入 | 路径 | 提取什么 |
|------|------|---------|
| 页面描述 | `02-设计/{页面名}-页面描述.md` | 区块、字段、操作、状态 |
| Pencil设计稿 | shejigao.pen | 组件层级、视觉结构 |
| 数据流文档 | `04-数据流/{页面名}.md` | API契约、字段溯源、状态流转 |
| 设计系统 | `03-视觉/设计系统规范.md` | CSS变量、组件规格 |

缺任何一份则提示先完成前置步骤。

### 第2步：生成技术规格

按以下6章模板生成：

```markdown
# 技术规格：{页面名称}

> 生成日期：{日期}
> 前置文档：页面描述 / 数据流 / 设计系统

## 1. 前端组件层级

从 Pencil 设计稿推导 Vue 组件树，每个节点标注组件名和职责。

```
{PageName}.vue                    ← 页面入口
├── {PageName}Header.vue          ← 页面标题区（如有）
├── {PageName}Filter.vue          ← 筛选/搜索区（如有）
├── {PageName}List.vue            ← 列表/表格区
│   └── {PageName}Card.vue        ← 单条卡片/行
│       └── StatusBadge.vue       ← 状态标签（通用）
└── {PageName}Empty.vue           ← 空状态（通用）
```

每个组件标注：属于新增还是复用已有组件。

## 2. 组件 Props 定义

为每个组件定义输入/输出接口。

### {ComponentName}.vue

| Prop | 类型 | 必填 | 说明 | 来源字段 |
|------|------|------|------|---------|
| data | `Array<{Type}>` | 是 | 列表数据 | API /xxx |
| loading | `boolean` | 是 | 加载状态 | 组件内 |
| onAction | `(id: string) => void` | 否 | 操作回调 | 父组件 |

### 数据类型定义

```typescript
interface {TypeName} {
  id: string
  orderNo: string       // 📥存储
  status: string        // 📥存储
  route: string         // 🔗调用 = start + '→' + end
  createdAt: string     // 📥存储
}
```

字段溯源标记（与 /data-flow 对应）：
- 📥存储：直接从API获取
- 🔗调用：前端拼接/计算
- 📊计算：实时计算
- ⛔禁止：不传到前端

## 3. API 服务函数

从数据流文档提取，按前端可直接使用的格式输出。

```typescript
// api/{module}.ts

/** 获取{资源}列表 */
export function get{Resource}List(params: {
  page: number
  pageSize: number
  status?: string
}): Promise<{ data: {TypeName}[]; total: number }>

/** 创建{资源} */
export function create{Resource}(data: Create{TypeName}DTO): Promise<{TypeName}>
```

| 函数名 | 方法 | 端点 | 请求参数 | 响应类型 | 说明 |
|--------|------|------|---------|---------|------|
| get{Resource}List | GET | /api/v1/{resource} | page,pageSize,status | PaginatedResponse | 列表查询 |
| create{Resource} | POST | /api/v1/{resource} | CreateDTO | {TypeName} | 创建 |

## 4. 数据库表结构

从字段溯源中提取 📥存储 字段，生成建表参考。

### {table_name}

| 字段 | 类型 | 约束 | 索引 | 说明 |
|------|------|------|------|------|
| id | UUID | PK | ✅ | 主键 |
| order_no | VARCHAR(32) | UNIQUE NOT NULL | ✅ | 订单编号 |
| status | VARCHAR(20) | NOT NULL | ✅ | 状态 |
| created_at | TIMESTAMP | NOT NULL | ✅ | 创建时间 |

外键关系：{table_name}.xxx → {other_table}.id

## 5. 状态管理

标注每个数据的归属：页面组件内 / Pinia Store / 路由参数。

| 数据 | 归属 | 说明 |
|------|------|------|
| 列表数据 | 组件内 ref | 页面级，不需要跨页面共享 |
| 筛选条件 | URL查询参数 | 支持分享链接 |
| 当前用户 | Pinia userStore | 全局共享 |
| 分页状态 | 组件内 ref | 页面级 |

加载策略：
- 进入页面 → 调用 API 获取列表
- 筛选变更 → 重置分页 → 重新获取
- 上拉加载 → 页码+1 → 追加数据

## 6. 路由配置

```typescript
// router/modules/{module}.ts
{
  path: '/{path}',
  name: '{RouteName}',
  component: () => import('@/views/{path}.vue'),
  meta: { title: '{页面标题}', auth: true }
}
```

| 路径 | 组件 | 权限 | 参数 |
|------|------|------|------|
| /{path} | {PageName}.vue | 需登录 | — |
| /{path}/:id | {PageName}Detail.vue | 需登录 | id |
```

### 第3步：保存文件

将技术规格保存到：`开发文档/05-技术规格/{页面名}-技术规格.md`

### 第4步：扩展共享定义文件

读取 `开发文档/06-架构/shared-schema.ts`，将本页面的技术规格结果扩展进去：

| 扩展内容 | 来源 | 写入位置 |
|---------|------|---------|
| 数据库表结构 | §4 数据库表结构 | §3 数据库表结构（TypeScript Interface） |
| 新增类型定义 | §2 Props/数据类型 | §2 核心数据结构 |
| 路由配置 | §6 路由配置 | §5 路由配置 |

**规则**：
- 已存在于 schema 中的表不允许重复定义，只引用
- 外键类型必须与被引用表的 ID 类型一致
- 如发现 schema 中的命名与技术规格冲突，以 schema 为准并调整技术规格

输出确认：
```
✅ 技术规格已生成：开发文档/05-技术规格/{页面名}-技术规格.md
📊 6章：组件层级 / Props / API / 数据库 / 状态管理 / 路由
📦 shared-schema.ts 已扩展：+{N}张表 / +{M}个路由
→ 下一步：/plan-first（拆编码任务）或直接编码
```

## 内含规则（强制）

1. **与数据流对齐**：字段名、API端点、类型定义必须与 /data-flow 输出一致，不允许同名不同义
2. **TypeScript类型必须完整**：每个接口、每个Prop都有类型定义，不允许 any
3. **区分新增与复用**：组件层级中标注每个组件是新写还是复用已有
4. **不给实现代码**：只定义接口和结构，不写具体实现（那是编码阶段的事）
5. **溯源标记保留**：字段 📥🔗📊⛔ 标记贯穿全文，方便回溯到数据流文档
6. **命名必须与 shared-schema.ts 一致**，不允许自行创造新字段名（遗漏的先注册到 schema 再使用）
