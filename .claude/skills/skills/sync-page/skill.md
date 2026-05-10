---
name: sync-page
description: H5→小程序页面对齐 - 自动对比H5和小程序代码，逐项修复差异，确保视觉和功能完全一致
origin: project
---

# H5→小程序页面对齐 `/sync-page`

> **使用场景**：确保小程序端页面的视觉呈现和功能与H5端完全一致。
> **目标**：逐项对比模板结构、样式、功能逻辑，输出差异清单并自动修复。

## 用法

```
/sync-page agency/ocr          # 对齐单个页面
/sync-page driver              # 对齐整个模块（driver下所有页面）
/sync-page all                 # 对齐所有页面
/sync-page tourist/home        # 对齐游客首页
/sync-page service/upload      # 对齐服务发票上传
```

## 页面映射表

| 模块 | H5路径前缀 | 小程序路径前缀 |
|------|-----------|--------------|
| 登录 | `frontend/src/views/miniprogram/` | `miniprogram/src/pages/login/` |
| 游客 | `frontend/src/views/miniprogram/Tourist*.vue` | `miniprogram/src/pages/tourist/` |
| 司机 | `frontend/src/views/miniprogram/Driver*.vue` | `miniprogram/src/pages/driver/` |
| 旅行社 | `frontend/src/views/miniprogram/Agency*.vue` | `miniprogram/src/pages/agency/` |
| 服务 | `frontend/src/views/service/` | `miniprogram/src/pages/service/` |

### 文件名映射

| H5文件 | 小程序文件 |
|--------|-----------|
| `Login.vue` | `login.vue` |
| `AgencyLogin.vue` | `agency-login.vue` |
| `TouristHome.vue` | `home.vue` |
| `TouristOrderDetail.vue` | `order-detail.vue` |
| `TouristMessages.vue` | `messages.vue` |
| `TouristProfile.vue` | `profile.vue` |
| `DriverOrders.vue` | `orders.vue` |
| `DriverTrips.vue` | `trips.vue` |
| `DriverStats.vue` | `stats.vue` |
| `AgencyOCR.vue` | `ocr.vue` |
| `AgencyWeather.vue` | `weather.vue` |
| `AgencyNews.vue` | `news.vue` |
| `AgencyProfile.vue` | `profile.vue` |
| `Home.vue`（service） | `home.vue` |
| `InvoiceList.vue` | `invoices.vue` |
| `OrderList.vue` | `orders.vue` |
| `InvoiceUpload.vue` | `upload.vue` |
| `Profile.vue`（service） | `profile.vue` |

## 执行步骤

### 第1步：确认对齐范围（5秒）

根据输入确定需要对比的H5和小程序文件对。

输出格式：
```
📋 对齐范围
  H5:    frontend/src/views/miniprogram/TouristHome.vue
  小程序: miniprogram/src/pages/tourist/home.vue
```

### 第2步：全量代码读取（20秒）

用并行的 Agent 读取两个文件的完整代码（Read 工具），确保读取全部内容（不设行数限制）。

### 第3步：7维对比分析（核心步骤）

逐项对比以下7个维度，输出差异清单：

#### 维度1：模板结构对比
- **逐层对比**：从外到内，逐层对比 DOM 树结构
- **检查项**：
  - [ ] H5 有但小程序缺失的元素（整个区块）
  - [ ] 元素嵌套层级是否一致
  - [ ] 条件渲染（v-if/v-else）逻辑是否一致
  - [ ] 列表渲染（v-for）是否一致
  - [ ] 事件绑定是否完整（每个 @click 是否都有对应 @tap）
  - [ ] 表单元素类型是否匹配（input/button/textarea/picker）
- **输出格式**：每项差异标注 `[缺失]`、`[不一致]`、`[多余]`

#### 维度2：布局对比
- **逐区块对比**：从页面整体到每个卡片的内部布局
- **检查项**：
  - [ ] 页面整体布局：单列/多列、是否有最大宽度限制
  - [ ] 卡片排列：纵向堆叠/横向排列/网格布局
  - [ ] 行内元素排列：flex方向（row/column）、对齐方式（align/justify）
  - [ ] 元素间距：区块间距、元素间距是否与H5一致
  - [ ] 元素位置：固定定位/绝对定位元素的位置
  - [ ] 元素宽度：全宽/半宽/固定宽度/auto
  - [ ] 元素比例：头像/图标/文字的大小比例关系
  - [ ] 内部对齐：左对齐/居中/右对齐/两端对齐
  - [ ] 换行/不换行：flex-wrap 是否一致
  - [ ] 响应式：是否有媒体查询或条件布局
- **对比方法**：逐区块截取H5页面截图，描述每个区块的布局特征，然后对照小程序代码验证

#### 维度3：样式对比
- **逐选择器对比**：对比每个 CSS 类的属性
- **检查项**：
  - [ ] 背景色/渐变方向是否一致（注意：H5深色需转浅色）
  - [ ] 字体大小（px→rpx 换算是否正确）
  - [ ] 间距（padding/margin/gap）
  - [ ] 圆角（border-radius）
  - [ ] 边框（border）
  - [ ] 阴影（box-shadow）
  - [ ] 颜色值是否映射正确（深色主题→浅色主题）
- **浅色主题映射表**（H5深色→小程序浅色）：

| H5深色值 | 小程序浅色值 | 用途 |
|----------|------------|------|
| `#0F172A` | `#F8F9FF` | 页面背景 |
| `#1E293B` | `#FFFFFF` | 卡片背景 |
| `#16213E` | `#FFFFFF` | 头部/导航背景 |
| `#1A1A2E` | `#F8F9FF` | 页面背景 |
| `#00FF88` | `#6366F1` | 激活/高亮色 |
| `#F1F5F9` | `#1E1B4B` | 主文字 |
| `#CBD5E1` | `#374151` | 标签文字 |
| `#64748B` | `#6B7280` | 次要文字 |
| `#94A3B8` | `#9CA3AF` | 描述文字 |
| `#334155` | `#E5E7EB` | 边框 |
| `#3B82F6` | `#6366F1` | 主色调 |

#### 维度3：功能逻辑对比
- **检查项**：
  - [ ] H5 有但小程序缺失的函数/方法
  - [ ] API 调用是否完整（每个 authFetch 是否有对应 API 函数）
  - [ ] 计算属性是否完整
  - [ ] 数据初始化是否一致
  - [ ] 生命周期钩子是否正确转换（onMounted→onLoad/onShow）
  - [ ] 路由跳转是否完整（每个 router.push 是否有对应 uni.navigateTo）
  - [ ] localStorage 操作是否转换为 uni.getStorageSync

#### 维度4：交互功能对比
- **检查项**：
  - [ ] 弹窗/对话框（H5 的自定义弹窗 → 小程序是否保留）
  - [ ] 下拉刷新
  - [ ] 图片选择/上传
  - [ ] 拨打电话
  - [ ] 复制文本
  - [ ] 日期/时间选择器
  - [ ] 滚动加载/分页

#### 维度5：TabBar对比
- **检查项**：
  - [ ] 是否有底部导航栏
  - [ ] TabBar 的标签页数量和名称是否与H5的Layout组件一致
  - [ ] TabBar 的图标和颜色是否一致
  - [ ] TabBar 的跳转链接是否正确

#### 维度6：数据字段对比
- **检查项**：
  - [ ] 表单字段数量是否一致
  - [ ] 接口返回的数据字段是否完整使用
  - [ ] 显示格式是否一致（日期、金额、状态等）

### 第4步：输出差异清单

格式如下：
```
📋 差异清单：TouristHome.vue → home.vue

## 🔴 缺失元素（3项）
1. [缺失] 欢迎信息区（H5第12-18行）→ 小程序应添加
2. [缺失] 天气出行建议 weatherTip()（H5第45行）→ 小程序应添加
3. [缺失] 未读消息气泡 badge（H5第67行）→ 小程序应添加

## 🟠 布局差异（4项）
1. [不一致] 头部区域：H5用 flex row 两端对齐 → 小程序用纵向排列
2. [不一致] 统计卡片：H5用 grid 3列 → 小程序用 flex
3. [不一致] 服务团队卡片：H5左右布局（司机|计调）→ 小程序纵向
4. [不一致] 天气卡片：H5用两栏 grid → 小程序用横向滚动

## 🟡 样式差异（5项）
1. [不一致] 卡片圆角：H5 16px → 小程序应为 32rpx（当前 20rpx）
2. [不一致] 标题字号：H5 16px → 小程序应为 32rpx（当前 28rpx）
...

## 🔵 功能差异（2项）
1. [缺失] 轮询实时动态（H5 30秒）→ 小程序改用 onShow 刷新
2. [缺失] 司机评分显示（H5 getDriverDetailedStats）→ 小程序应添加
```

### 第5步：自动修复

根据差异清单，逐项修复小程序代码：
1. **缺失元素**：从H5转换模板结构并添加到小程序
2. **样式差异**：统一为H5的样式值（px→rpx，深色→浅色）
3. **功能差异**：补充缺失的函数和API调用
4. **TabBar**：确保每个模块页面都有正确的底部导航

修复原则：
- 每修复一项，在差异清单中标记 ✅
- 遇到需要用户决策的项，使用 AskUserQuestion 询问

### 第6步：构建验证

```
cd miniprogram && npx uni build -p mp-weixin
```

确认构建通过，无编译错误。

### 第7步：输出报告

```
✅ 对齐完成：TouristHome.vue → home.vue
  修复项：3个缺失元素 + 5个样式差异 + 2个功能差异
  构建：通过
  待验证：微信开发者工具中打开确认视觉效果
```

## 转换规则速查

### 模板转换
| H5 | 小程序 | 说明 |
|----|--------|------|
| `<div>` | `<view>` | 容器 |
| `<span>/<p>/<h1-h6>` | `<text>` | 文本 |
| `<img :src="x">` | `<image :src="x" mode="aspectFit">` | 图片 |
| `<a href="tel:x">` | `@tap` + `uni.makePhoneCall()` | 电话 |
| `@click` | `@tap` | 事件 |
| `<input type="file">` | `uni.chooseImage()` | 文件选择 |
| `<input type="date">` | `<picker mode="date">` | 日期 |
| `<input type="time">` | `<picker mode="time">` | 时间 |
| `<input type="password">` | `<input password>` | 密码 |
| `@keyup.enter` | `@confirm` | 回车 |
| `v-html` | `<rich-text>` | 富文本 |

### 脚本转换
| H5 | 小程序 | 说明 |
|----|--------|------|
| `useRouter()/useRoute()` | 删除 | 不需要 |
| `router.push(url)` | `uni.navigateTo({url})` | 跳转 |
| `router.back()` | `uni.navigateBack()` | 返回 |
| `route.params.id` | `onLoad(options)` → `options.id` | 页面参数 |
| `onMounted` | `onLoad`/`onShow` | 生命周期 |
| `onUnmounted` | `onHide` | 生命周期 |
| `fetch('/api/v1/...')` | 已有API函数 | 网络请求 |
| `authFetch('/api/v1/...')` | 已有API函数 | 认证请求 |
| `localStorage` | `uni.getStorageSync/setStorageSync` | 本地存储 |
| `alert(msg)` | `uni.showToast({title, icon:'none'})` | 提示 |
| `document.createElement('input')` | `uni.chooseImage()` | 文件选择 |
| `new FormData()` | `uni.uploadFile()` | 文件上传 |
| `window.open(url)` | `uni.setClipboardData()` | 外部链接 |
| `new Date().toLocaleDateString()` | 原生 Date 格式化 | 日期 |

### API映射
| H5 authFetch | 小程序 API |
|--------------|-----------|
| `/api/v1/auth/login` | `login()` from `@/api/auth` |
| `/api/v1/auth/mini/code/login` | `codeLogin()` from `@/api/auth` |
| `/api/v1/auth/me` | `fetchCurrentUser()` from `@/api/auth` |
| `/api/v1/order-flow/orders/tracking` | `getMyOrders()` from `@/api/order` |
| `/api/v1/order-flow/orders/tracking/:id` | `getOrderDetail(id)` from `@/api/order` |
| `/api/v1/weather?city=` | `getWeather(city)` from `@/api/order` |
| `/api/v1/news/` | `getNews(page, pageSize)` from `@/api/order` |
| `/api/v1/fleet/messages` | `getMessages()` from `@/api/order` |
| `/api/v1/fleet/messages/read-all` | `markAllRead()` from `@/api/order` |
| `/api/v1/fleet/messages/unread-count` | `getUnreadCount()` from `@/api/order` |
| `/api/v1/fleet/tasks` | `getDriverTasks()` from `@/api/fleet` |
| `/api/v1/fleet/tasks/:id` | `getTaskDetail(id)` from `@/api/fleet` |
| `/api/v1/fleet/tasks/:id/progress` | `updateTaskProgress(id, step)` from `@/api/fleet` |
| `/api/v1/fleet/tasks/:id/luggage` | `saveLuggageInfo(id, data)` from `@/api/fleet` |
| `/api/v1/fleet/driver-detailed-stats` | `getDriverStats()` from `@/api/fleet` |
| `/api/v1/fleet/driver-income` | `get('/fleet/driver-income')` from `@/api/request` |
| `/api/v1/fleet/driver-schedule` | `getDriverSchedule()` from `@/api/fleet` |
| `/api/v1/fleet/live-events` | `get('/fleet/live-events')` from `@/api/request` |
| `/api/v1/invoices/` | `getInvoices()` from `@/api/invoice` |
| `/api/v1/ocr/ticket` | `uni.uploadFile({url: BASE_URL+'/ocr/ticket'})` |
| `/api/v1/ocr/general` | `uni.uploadFile({url: BASE_URL+'/ocr/general'})` |
