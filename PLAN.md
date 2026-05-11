# 施工图：AI工作室（即梦AI短视频生成）

## 目标
新增 AI 工作室页面模块，覆盖文生图、图生视频、文生视频、图片编辑、数字人、批量生成6种能力，复用现有 AITask 异步架构，生成素材可推送到素材库。

---

## 执行计划

### 阶段一：后端基础（即梦API + 数据模型 + 路由）

- [ ] 1.1 创建即梦 API 客户端服务
  - 文件: packages/server/src/services/ai/jimengClient.ts
  - 依赖: 无
  - 完成标准: 导出 `JimengClient` 类，包含 `submitTask(reqKey, params)` 和 `pollResult(taskId)` 方法，`npx tsc --noEmit` 通过

- [ ] 1.2 新增 Prisma 模型 + 迁移
  - 文件: packages/server/prisma/schema.prisma, packages/server/prisma/migrations/
  - 依赖: 无
  - 完成标准: `AiStudioProject` + `AiStudioAsset` 两张表创建成功，`npx prisma migrate dev` 通过，schema-check 通过

- [ ] 1.3 更新 shared-schema.ts（新增枚举+表接口+API端点+路由）
  - 文件: packages/shared/src/shared-schema.ts
  - 依赖: 1.2
  - 完成标准: 新增 AiStudioProjectStatus(3值)、AiStudioAssetType(2值)、AiStudioAssetStatus(5值)、JimengTaskType(5值) 枚举，AiStudioProjectRecord + AiStudioAssetRecord 接口，API.AI_STUDIO 常量（10个端点），ROUTES.AI_STUDIO + ROUTES.AI_STUDIO_PROJECT，`npx tsx scripts/schema-check.ts` 通过

- [ ] 1.4 创建 AI 工作室后端路由
  - 文件: packages/server/src/routes/modules/aiStudio.ts
  - 依赖: 1.1, 1.2, 1.3
  - 完成标准: 路由注册到 routes/index.ts，包含 CRUD + 5种生成端点 + 任务状态查询 + 推送到素材库，`npx tsc --noEmit` 通过

### 阶段二：前端 API 层 + 状态管理

- [ ] 2.1 创建前端 API 模块
  - 文件: packages/client/src/api/aiStudio.ts
  - 依赖: 1.3
  - 完成标准: 导出所有 AI 工作室 API 调用函数，类型从 shared-schema 导入，`npx tsc --noEmit` 通过

- [ ] 2.2 创建 Pinia Store
  - 文件: packages/client/src/stores/aiStudio.ts
  - 依赖: 2.1
  - 完成标准: 包含 projects 列表、当前项目、assets、tasks 状态，fetchProjects/createProject/fetchAssets/submitGeneration/pollTask actions，TypeScript 编译通过

- [ ] 2.3 注册路由
  - 文件: packages/client/src/router/index.ts
  - 依赖: 1.3
  - 完成标准: `/ai-studio` 和 `/ai-studio/:projectId` 两个路由注册，使用 ROUTES 常量，lazy-load

### 阶段三：前端组件实现

- [ ] 3.1 ProjectListView 项目列表页
  - 文件: packages/client/src/views/AiStudioView.vue
  - 依赖: 2.1, 2.2, 2.3
  - 完成标准: 项目卡片网格，创建/删除项目，空状态引导，TypeScript 编译通过

- [ ] 3.2 ProjectWorkspaceView 项目工作台页（框架+侧栏）
  - 文件: packages/client/src/views/AiStudioProjectView.vue
  - 依赖: 2.2, 2.3
  - 完成标准: 侧栏（项目素材列表+任务队列+推送按钮）+ 主区域（tab切换生成类型），TypeScript 编译通过

- [ ] 3.3 TextToImagePanel 文生图面板
  - 文件: packages/client/src/components/ai-studio/TextToImagePanel.vue
  - 依赖: 2.1
  - 完成标准: 描述输入框、模型选择(Seedream 3.0/4.0/5.0)、尺寸选择、批量数量(1-4)、生成按钮、结果网格预览、选图确认

- [ ] 3.4 ImageToVideoPanel 图生视频面板
  - 文件: packages/client/src/components/ai-studio/ImageToVideoPanel.vue
  - 依赖: 2.1
  - 完成标准: 图片上传/选择、模型选择(3.0/Seaweed/Seedance)、时长选择(5/10秒)、首尾帧模式开关、生成按钮、视频预览播放

- [ ] 3.5 TextToVideoPanel 文生视频面板
  - 文件: packages/client/src/components/ai-studio/TextToVideoPanel.vue
  - 依赖: 2.1
  - 完成标准: 文本描述输入、模型选择、生成按钮、视频预览

- [ ] 3.6 ImageEditPanel 图片编辑面板
  - 文件: packages/client/src/components/ai-studio/ImageEditPanel.vue
  - 依赖: 2.1
  - 完成标准: 图片上传/从素材选择、编辑指令输入（"把背景换成海滩"）、生成按钮、编辑前后对比

- [ ] 3.7 DigitalHumanPanel 数字人面板
  - 文件: packages/client/src/components/ai-studio/DigitalHumanPanel.vue
  - 依赖: 2.1
  - 完成标准: 人物照片上传、TTS文本输入（或上传音频）、模型选择(OmniHuman 1.0/1.5)、生成按钮、口播视频预览

- [ ] 3.8 TaskQueuePanel 任务队列组件
  - 文件: packages/client/src/components/ai-studio/TaskQueuePanel.vue
  - 依赖: 2.1
  - 完成标准: 任务列表（状态图标+进度条+操作按钮）、自动轮询进行中任务、失败重试

- [ ] 3.9 AssetGridPanel 素材网格组件
  - 文件: packages/client/src/components/ai-studio/AssetGridPanel.vue
  - 依赖: 2.1
  - 完成标准: 图片/视频网格展示、点击预览大图、勾选、批量操作（推送素材库/删除）

### 阶段四：页面组装与联调

- [ ] 4.1 组装工作台页面
  - 文件: packages/client/src/views/AiStudioProjectView.vue（更新）
  - 依赖: 3.2-3.9
  - 完成标准: 侧栏+主区域完整渲染，tab切换5种生成面板+素材面板，TypeScript 编译通过，浏览器无 console.error

- [ ] 4.2 AITask 类型扩展 + 任务轮询
  - 文件: packages/server/src/services/ai/taskManager.ts
  - 依赖: 1.4
  - 完成标准: AITaskType 新增 5 种即梦类型，生成端点调用 JimengClient 后创建 AITask，轮询接口返回任务状态

- [ ] 4.3 推送到素材库实现
  - 文件: packages/server/src/routes/modules/aiStudio.ts（更新）
  - 依赖: 4.2
  - 完成标准: POST /api/v1/ai-studio/assets/:id/push-to-materials 创建 Material 记录，返回 material_id

- [ ] 4.4 推送到脚本分镜实现
  - 文件: packages/server/src/routes/modules/aiStudio.ts（更新）
  - 依赖: 4.2
  - 完成标准: POST /api/v1/ai-studio/assets/:id/push-to-segment 将素材关联到 StoryboardSegment.material_ids

---

## 验证节点

| 节点 | 时机 | 验证方式 |
|------|------|---------|
| V1 | 阶段一完成后 | `npx tsc --noEmit` + `npx tsx scripts/schema-check.ts` |
| V2 | 阶段二完成后 | `npx tsc --noEmit` + 前端 dev server 启动无报错 |
| V3 | 阶段三完成后 | 浏览器访问 /ai-studio，项目列表正常渲染 |
| V4 | 阶段四完成后 | /ai-studio/:projectId 工作台完整功能可用 |

---

## [决策] 决策点

- [决策] 即梦 API 认证方式：火山引擎 Ark API（REST风格，需 accessKey + secretKey）还是豆包 API（更简单的 API Key 模式）？推荐 Ark API（功能更全）。

---

## 风险评估

- 即梦 API 需要火山引擎账号 + 开通服务，初期可用 MockJimengClient 开发
- 视频文件较大（5-10秒视频 ~5-20MB），需考虑存储方案（本地暂存/OSS）
- 即梦异步任务结果24小时过期，需定期清理过期素材

## 测试计划

- 单元测试：JimengClient 的 submitTask/pollResult
- 集成测试：AI工作室 CRUD 端点
- E2E验证：前端页面创建项目 → 生成图片 → 推送素材库
