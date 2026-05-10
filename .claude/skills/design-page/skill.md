---
name: design-page
description: 设计文档→Pencil视觉稿，读取设计规格在shejigao.pen中生成页面
origin: project
---

# 设计页面 `/design-page`

> **使用场景**：`/design-detail` 输出页面描述后，将其转为 Pencil 视觉稿。
> **前置**：`/design-detail` 输出的页面描述文件
> **后置**：`/data-flow`（基于设计稿做数据流设计）
> **输出**：shejigao.pen 中的新页面

## 用法

```
/design-page                    # 交互式，选择要生成的设计规格
/design-page 司机订单列表页      # 带页面名称直接生成
```

## 执行流程（4步）

### 第1步：读取页面描述

读取 `开发文档/02-设计/{页面名}-页面描述.md`，提取：
- 区块拆解 → 每个区块的元素、文案、尺寸
- 数据绑定 → 字段溯源标记（📥🔗📊⛔）
- 操作定义 → 交互行为
- 页面状态 → loading/empty/error 设计
- 跨页面关联 → 路由参数

同时读取 `开发文档/02-设计/{页面名}-设计规格.md` 获取7要素参数（颜色/字体/间距/组件/状态/响应式）。

### 第2步：读取设计系统 + 参考同类页面

```
1. get_variables() → 确认59个变量可用
2. batch_get(同类参考页面ID, readDepth:2) → 参考同类结构
```

参考页面ID速查：

| 类型 | 参考ID | 页面名 |
|------|--------|--------|
| 桌面后台页 | `kEXiE` | 派单页 |
| 移动列表页 | `10uo7` | 发票列表 |
| 移动订单页 | `09Ln2` | 订单列表 |
| 移动详情页 | `H4ibN` | 订单详情 |
| 移动表单页 | `ahUT4` | 提交订单 |
| 移动登录页 | `Yg1wx` | 服务端登录 |
| 着陆页 | `XDwNK` | 官网首页 |

### 第3步：生成 Pencil 页面

按设计规格逐层构建：

1. `find_empty_space_on_canvas()` → 找空白区域
2. `batch_design()` → 创建页面容器（`placeholder: true`）
3. 按设计规格逐个填充组件，每次 `batch_design()` ≤25个操作
4. `get_screenshot()` → 截图验证
5. 移除 `placeholder: true`

**关键规则**：
- 所有颜色/字号/间距用 `$变量名` 引用，禁止硬编码
- 组件参数严格按设计规格中的值，不自行发挥
- 超过25个操作时分批，按逻辑区块划分

### 第4步：输出确认

```
✅ Pencil 页面已生成：{页面名称}（ID: {nodeId}）
📐 尺寸：{W}x{H}
📦 组件数：{N}个
→ 下一步：/data-flow（基于设计稿做数据流设计）
```

## 组件规格速查

详细规范见 `开发文档/03-视觉/设计系统规范.md`。

### 按钮

| 尺寸 | 高度 | 圆角 | 内边距 | 字号 | 字重 |
|------|------|------|--------|------|------|
| sm | 32px | 6px | 0 12px | 12px | 600 |
| md | 40px | 8px | 0 16px | 14px | 600 |
| lg | 48px | 8px | 0 20px | 14-16px | 600 |
| mobile | 56px | 16px | 0 20px | 16px | 700 |

变体：primary(#6366F1) / primary-gradient(→#8B5CF6) / secondary(#FFF,border) / danger(#EF4444) / ghost(transparent)

### 输入框

| 尺寸 | 高度 | 圆角 | 内边距 |
|------|------|------|--------|
| sm | 32px | 6px | 0 12px |
| md | 40px | 8px | 0 16px |
| lg | 44px | 8px | 0 20px |
| mobile | 52px | 16px | 0 20px |

### 表格

表头行: 48px, bg=#F8F9FA, 13px, 600
数据行: 48px, odd=#FFF, even=#F8FAFC, 13px, 400

### Badge

桌面: 24px高, radius=4px | 移动: 28px高, radius=8px
成功=#D1FAE5/#059669 | 警告=#FEF3C7/#D97706 | 错误=#FEE2E2/#DC2626

## 状态设计（前端实现参考）

生成 Pencil 稿时只做正常态。以下状态留给前端 CSS 实现：

- **hover**: 按钮 filter:brightness(0.9) + shadow | 行 bg→#F1F5F9 | 卡片 shadow提升
- **disabled**: opacity:0.5, cursor:not-allowed | 输入框 bg:#F3F4F6
- **loading**: 骨架屏 bg=#E2E8F0, pulse 1.5s动画
- **empty**: emoji 48px + 文字 16px + secondary md按钮

## 内含规则（强制）

1. **严格按设计规格**：组件参数以设计规格文件为准，不自行增减
2. **变量强制引用**：所有值用 `$变量名`，禁止硬编码
3. **先placeholder再填充**：创建时 `placeholder:true`，完成第4步移除
4. **最大25操作/次**：分批按逻辑区块
5. **找空位再放**：`find_empty_space_on_canvas` 确认位置
6. **截图必验**：完成后必须截图对照设计规格验证
