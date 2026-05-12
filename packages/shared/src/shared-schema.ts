/**
 * shared-schema.ts — 唯一真相源
 *
 * 所有字段名、枚举、API端点、表结构、跨页面参数只在此定义。
 * 前端/后端代码直接 import 使用，不允许在业务代码中硬编码。
 *
 * 生成日期: 2026-05-10
 * 覆盖: 15个页面 / 37个枚举 / 28张表 / 134个API端点
 */

// ============================================================
// §1 枚举定义
// ============================================================

// --- 1.1 平台 ---
export type Platform = 'xiaohongshu' | 'douyin' | 'weixin'
export const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  weixin: '视频号',
}

// --- 1.2 任务状态（仪表盘工作流） ---
export type TaskStatus =
  | 'todo'         // 待办
  | 'collecting'   // 采集
  | 'selecting'    // 选题
  | 'producing'    // 制作
  | 'publishing'   // 发布
  | 'monitoring'   // 监控
  | 'completed'    // 已完成
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待办', collecting: '采集', selecting: '选题', producing: '制作',
  publishing: '发布', monitoring: '监控', completed: '已完成',
}

// --- 1.3 任务筛选 ---
export type TaskFilter = 'all' | 'todo' | 'in_progress' | 'done'

// --- 1.4 采集任务状态 ---
export type CollectTaskStatus =
  | 'pending'   // 等待中
  | 'running'   // 采集中
  | 'paused'    // 已暂停
  | 'completed' // 已完成
  | 'failed'    // 采集失败
export const COLLECT_TASK_STATUS_LABELS: Record<CollectTaskStatus, string> = {
  pending: '等待中', running: '采集中', paused: '已暂停',
  completed: '已完成', failed: '采集失败',
}

// --- 1.5 采集任务类型 ---
export type CollectType = 'video' | 'account_info'
export const COLLECT_TYPE_LABELS: Record<CollectType, string> = {
  video: '视频采集', account_info: '账号信息',
}

// --- 1.6 监控状态 ---
export type MonitorStatus = 'active' | 'paused'
export const MONITOR_STATUS_LABELS: Record<MonitorStatus, string> = {
  active: '监控中', paused: '已暂停',
}

// --- 1.7 素材类型 ---
export type MaterialType = 'image' | 'video' | 'music' | 'sfx' | 'map_animation'
export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  image: '图片', video: '视频', music: '音乐', sfx: '音效', map_animation: '地图动画',
}

// --- 1.8 素材来源 ---
export type MaterialSource = 'pexels' | 'ai_generated' | 'self_shot' | 'purchased' | 'external_import'
export const MATERIAL_SOURCE_LABELS: Record<MaterialSource, string> = {
  pexels: 'Pexels', ai_generated: 'AI生成', self_shot: '自拍', purchased: '购买', external_import: '外部导入',
}

// --- 1.9 版权状态 ---
export type CopyrightStatus = 'free_commercial' | 'purchased' | 'ai_generated' | 'pending'
export const COPYRIGHT_STATUS_LABELS: Record<CopyrightStatus, string> = {
  free_commercial: '免费商用', purchased: '已购买', ai_generated: 'AI生成', pending: '待确认',
}

// --- 1.10 视频产品状态 ---
export type VideoProductStatus = 'draft' | 'rendering' | 'completed' | 'failed'
export const VIDEO_PRODUCT_STATUS_LABELS: Record<VideoProductStatus, string> = {
  draft: '草稿', rendering: '渲染中', completed: '已完成', failed: '失败',
}

// --- 1.11 视频产品平台变体 ---
export type VideoProductPlatform = 'main' | 'douyin' | 'weixin' | 'image_text'
export const VIDEO_PRODUCT_PLATFORM_LABELS: Record<VideoProductPlatform, string> = {
  main: '主版', douyin: '抖音', weixin: '视频号', image_text: '图文版',
}

// --- 1.12 发布状态 ---
export type PublishStatus = 'unpublished' | 'pending' | 'published' | 'failed'
export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  unpublished: '未发布', pending: '待发布', published: '已发布', failed: '发布失败',
}

// --- 1.13 转化目标 ---
export type ConversionGoal = 'awareness' | 'trust' | 'conversion'
export const CONVERSION_GOAL_LABELS: Record<ConversionGoal, string> = {
  awareness: '认知型', trust: '信任型', conversion: '转化型',
}

// --- 1.14 内容资产状态 ---
export type ContentAssetStatus = 'draft' | 'published' | 'archived'
export const CONTENT_ASSET_STATUS_LABELS: Record<ContentAssetStatus, string> = {
  draft: '草稿', published: '已发布', archived: '已归档',
}

// --- 1.15 内容资产类型 ---
export type ContentAssetType = 'script' | 'video' | 'image_text'
export const CONTENT_ASSET_TYPE_LABELS: Record<ContentAssetType, string> = {
  script: '脚本', video: '视频', image_text: '图文',
}

// --- 1.16 选题提案状态 ---
export type TopicProposalStatus = 'generated' | 'selected' | 'merged' | 'discarded'
export const TOPIC_PROPOSAL_STATUS_LABELS: Record<TopicProposalStatus, string> = {
  generated: '已生成', selected: '已选中', merged: '已合并', discarded: '已丢弃',
}

// --- 1.17 脚本状态 ---
export type ScriptStatus = 'draft' | 'confirmed'
export const SCRIPT_STATUS_LABELS: Record<ScriptStatus, string> = {
  draft: '草稿', confirmed: '已确认',
}

// --- 1.18 通用异步任务状态 ---
export type GenerateStatus = 'idle' | 'generating' | 'completed' | 'failed'
export const GENERATE_STATUS_LABELS: Record<GenerateStatus, string> = {
  idle: '空闲', generating: '生成中', completed: '已完成', failed: '失败',
}

// --- 1.19 热点来源平台 ---
export type HotspotSourcePlatform = 'douyin' | 'xiaohongshu' | 'weibo' | 'bilibili' | 'manual'
export const HOTSPOT_SOURCE_LABELS: Record<HotspotSourcePlatform, string> = {
  douyin: '抖音', xiaohongshu: '小红书', weibo: '微博', bilibili: 'B站', manual: '手动添加',
}

// --- 1.20 热点相关度等级 ---
export type RelevanceLevel = 'high' | 'medium' | 'low'

// --- 1.21 趋势方向 ---
export type TrendDirection = 'up' | 'down' | 'flat'

// --- 1.22 视频类型 ---
export type VideoType = 'knowledge' | 'story' | 'list' | 'contrast'
export const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  knowledge: '知识科普', story: '故事叙事', list: '清单盘点', contrast: '对比评测',
}

// --- 1.23 分辨率 ---
export type Resolution = '1080p' | '4k'

// --- 1.24 转场类型 ---
export type TransitionType = 'none' | 'fade' | 'dissolve' | 'slide_left' | 'slide_right' | 'wipe'
export const TRANSITION_TYPE_LABELS: Record<TransitionType, string> = {
  none: '无', fade: '淡入淡出', dissolve: '溶解', slide_left: '左滑', slide_right: '右滑', wipe: '擦除',
}

// --- 1.25 人设样本类型 ---
export type SampleType = 'text' | 'audio'

// --- 1.26 趋势时间范围 ---
export type TimeRange = 'today' | 'recent_7d' | 'recent_30d' | 'this_week' | 'this_month' | 'custom'

// --- 1.27 排序方向 ---
export type SortOrder = 'asc' | 'desc'

// --- 1.28 SEO检查级别 ---
export type SeoLevel = 'pass' | 'warning' | 'error'

// --- 1.29 内容骨架类型 ---
export type StructureType = 'knowledge' | 'story' | 'list' | 'contrast'

// --- 1.30 表现标签 ---
export type PerformanceTag = 'high_completion' | 'high_interaction' | 'high_conversion'

// --- 1.31 平台筛选 ---
export type PlatformFilter = 'all' | Platform

// --- 1.32 爆款视频排序字段 ---
export type VideoSortField = 'published_at' | 'play_count' | 'like_count' | 'interaction_rate'

// --- 1.33 素材排序字段 ---
export type MaterialSortField = 'created_at' | 'use_count' | 'name' | 'file_size'

// --- 1.34 AI工作室项目状态 ---
export type AiStudioProjectStatus = 'draft' | 'active' | 'archived'
export const AI_STUDIO_PROJECT_STATUS_LABELS: Record<AiStudioProjectStatus, string> = {
  draft: '草稿', active: '进行中', archived: '已归档',
}

// --- 1.35 AI工作室素材类型 ---
export type AiStudioAssetType = 'image' | 'video'

// --- 1.36 AI工作室素材状态 ---
export type AiStudioAssetStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'expired'
export const AI_STUDIO_ASSET_STATUS_LABELS: Record<AiStudioAssetStatus, string> = {
  pending: '等待中', generating: '生成中', completed: '已完成', failed: '失败', expired: '已过期',
}

// --- 1.37 即梦任务类型 ---
export type JimengTaskType = 'jimeng_t2i' | 'jimeng_i2v' | 'jimeng_t2v' | 'jimeng_edit' | 'jimeng_digital_human'
export const JIMENG_TASK_TYPE_LABELS: Record<JimengTaskType, string> = {
  jimeng_t2i: '文生图', jimeng_i2v: '图生视频', jimeng_t2v: '文生视频',
  jimeng_edit: '图片编辑', jimeng_digital_human: '数字人',
}

// --- 1.38 渲染任务状态 ---
export type RenderStatus = 'idle' | 'rendering' | 'completed' | 'failed' | 'cancelled'
export const RENDER_STATUS_LABELS: Record<RenderStatus, string> = {
  idle: '空闲', rendering: '渲染中', completed: '已完成', failed: '失败', cancelled: '已取消',
}


// ============================================================
// §2 核心数据结构
// ============================================================

// --- 2.1 内容骨架（选题→脚本传递） ---
export interface ContentSkeleton {
  hook: string
  main_points: string[]
  visual_direction: string
  structure_type: StructureType
}

// --- 2.2 分镜段落 ---
export interface StoryboardSegment {
  id: number
  script_id: number
  segment_index: number
  segment_type: 'oral' | 'visual' | 'transition'
  oral_text?: string
  visual_description: string
  duration: number
  material_ids: string[]
  oral_audio_url?: string
  transition_type?: TransitionType
  created_at: string
  updated_at: string
}


// ============================================================
// §3 数据库表结构（TypeScript Interface）
// ============================================================

// --- 3.1 users ---
export interface UserRecord {
  id: string                        // UUID PK
  username: string                  // VARCHAR(100) UNIQUE NOT NULL
  avatar_url: string | null         // VARCHAR(500)
  created_at: string
  updated_at: string
}

// --- 3.2 tasks ---
export interface TaskRecord {
  id: string                        // UUID PK
  user_id: string                   // UUID FK→users NOT NULL
  title: string                     // VARCHAR(200) NOT NULL
  description: string | null        // TEXT
  status: TaskStatus                // VARCHAR(20) NOT NULL DEFAULT 'todo'
  current_step: number              // SMALLINT NOT NULL DEFAULT 1 CHECK(1-5)
  created_at: string
  updated_at: string
}

// --- 3.3 benchmark_accounts ---
export interface BenchmarkAccountRecord {
  id: string                        // UUID PK
  user_id: string                   // UUID FK→users NOT NULL
  account_name: string              // VARCHAR(100) NOT NULL
  platform: Platform                // VARCHAR(20) NOT NULL
  homepage_url: string              // VARCHAR(500) NOT NULL
  follower_count: number            // INTEGER DEFAULT 0
  content_direction: string         // TEXT NOT NULL
  monitor_status: MonitorStatus     // VARCHAR(20) DEFAULT 'active'
  last_collected_at: string | null  // TIMESTAMPTZ
  created_at: string
  updated_at: string
}

// --- 3.4 collect_tasks ---
export interface CollectTaskRecord {
  id: string                        // UUID PK
  user_id: string                   // UUID FK→users NOT NULL
  target_account_id: string         // UUID FK→benchmark_accounts NOT NULL
  task_type: CollectType            // VARCHAR(20) NOT NULL
  status: CollectTaskStatus         // VARCHAR(20) NOT NULL DEFAULT 'pending'
  max_count: number                 // INTEGER DEFAULT 50
  collected_count: number           // INTEGER DEFAULT 0
  date_range_start: string | null   // DATE
  date_range_end: string | null     // DATE
  created_at: string
  updated_at: string
}

// --- 3.5 viral_videos ---
export interface ViralVideoRecord {
  id: number                        // SERIAL PK
  account_id: string                // UUID FK→benchmark_accounts NOT NULL
  platform: Platform                // VARCHAR(20) NOT NULL
  platform_video_id: string         // VARCHAR(100) NOT NULL
  title: string                     // VARCHAR(500) NOT NULL
  cover_url: string                 // VARCHAR(500)
  video_url: string                 // VARCHAR(500)
  duration: number                  // INTEGER 秒
  play_count: number                // INTEGER DEFAULT 0
  like_count: number                 // INTEGER DEFAULT 0
  comment_count: number              // INTEGER DEFAULT 0
  collect_count: number              // INTEGER DEFAULT 0
  share_count: number                // INTEGER DEFAULT 0
  interaction_rate: number | null    // DECIMAL(5,2)
  transcript: string | null          // TEXT
  analysis_json: Record<string, unknown> | null // JSONB
  published_at: string               // TIMESTAMPTZ
  collected_at: string               // TIMESTAMPTZ
  task_id: string | null             // UUID FK→collect_tasks
}

// --- 3.6 hotspots ---
export interface HotspotRecord {
  id: number                        // SERIAL PK
  title: string                     // VARCHAR(200) NOT NULL
  source_platform: HotspotSourcePlatform // VARCHAR(20) NOT NULL
  source: string                    // VARCHAR(100)
  source_url: string | null         // VARCHAR(500)
  relevance_score: number           // DECIMAL(3,2) DEFAULT 0
  valid_until: string | null        // TIMESTAMPTZ
  created_at: string
}

// --- 3.7 keyword_monitors ---
export interface KeywordMonitorRecord {
  id: number                        // SERIAL PK
  keyword: string                   // VARCHAR(100) NOT NULL UNIQUE
  is_active: boolean                // BOOLEAN DEFAULT true
  created_at: string
}

// --- 3.8 topic_proposals ---
export interface TopicProposalRecord {
  id: number                        // SERIAL PK
  task_id: string                   // UUID FK→tasks NOT NULL
  title: string                     // VARCHAR(200) NOT NULL
  content_skeleton: ContentSkeleton // JSONB NOT NULL
  voice_ratio: number               // DECIMAL(3,2)
  status: TopicProposalStatus       // VARCHAR(20) DEFAULT 'generated'
  hotspot_ids: number[]             // INTEGER[]
  video_ids: number[]               // INTEGER[]
  persona_id: number | null         // INTEGER
  created_at: string
  updated_at: string
}

// --- 3.9 scripts ---
export interface ScriptRecord {
  id: number                        // SERIAL PK
  topic_id: number                  // INTEGER FK→topic_proposals NOT NULL
  task_id: string                   // UUID FK→tasks NOT NULL
  full_text: string                 // TEXT NOT NULL
  video_type: VideoType             // VARCHAR(20)
  oral_ratio: number                // DECIMAL(3,2) DEFAULT 0.6
  status: ScriptStatus              // VARCHAR(20) DEFAULT 'draft'
  created_at: string
  updated_at: string
}

// --- 3.10 storyboard_segments ---
export interface StoryboardSegmentRecord {
  id: number                        // SERIAL PK
  script_id: number                 // INTEGER FK→scripts NOT NULL
  segment_index: number             // INTEGER NOT NULL
  segment_type: 'oral' | 'visual' | 'transition' // VARCHAR(20) NOT NULL
  oral_text: string | null          // TEXT
  visual_description: string        // TEXT NOT NULL
  duration: number                  // DECIMAL(5,2) DEFAULT 3.0 秒
  material_ids: string[]            // UUID[]
  oral_audio_url: string | null     // VARCHAR(500)
  transition_type: TransitionType | null // VARCHAR(20)
  created_at: string
  updated_at: string
}

// --- 3.11 materials ---
export interface MaterialRecord {
  id: string                        // UUID PK
  user_id: string                   // UUID FK→users NOT NULL
  name: string                      // VARCHAR(200) NOT NULL
  type: MaterialType                // VARCHAR(20) NOT NULL
  source: MaterialSource            // VARCHAR(20) NOT NULL
  copyright_status: CopyrightStatus // VARCHAR(20) NOT NULL
  file_url: string                  // VARCHAR(500) NOT NULL
  thumbnail_url: string | null      // VARCHAR(500)
  file_size: number                 // BIGINT 字节数
  tags: string[]                    // VARCHAR(50)[] 标签数组
  use_count: number                 // INTEGER DEFAULT 0
  metadata: Record<string, unknown> | null // JSONB 宽/高/时长等
  created_at: string
  updated_at: string
}

// --- 3.12 video_materials（多对多关联） ---
export interface VideoMaterialRecord {
  id: string                        // UUID PK
  video_product_id: string          // UUID FK→video_products NOT NULL
  material_id: string               // UUID FK→materials NOT NULL
  usage_type: 'main' | 'bgm' | 'sfx' | 'subtitle' // VARCHAR(20)
}

// --- 3.13 video_products ---
export interface VideoProductRecord {
  id: string                        // UUID PK
  task_id: string                   // UUID FK→tasks NOT NULL
  script_id: number                 // INTEGER FK→scripts NOT NULL
  title: string                     // VARCHAR(200)
  status: VideoProductStatus        // VARCHAR(20) DEFAULT 'draft'
  platform: VideoProductPlatform    // VARCHAR(20) DEFAULT 'main'
  resolution: Resolution            // VARCHAR(10) DEFAULT '1080p'
  video_url: string | null          // VARCHAR(500)
  duration: number | null           // DECIMAL(8,2) 秒
  render_config: Record<string, unknown> | null // JSONB
  created_at: string
  updated_at: string
}

// --- 3.14 publish_records ---
export interface PublishRecord {
  id: string                        // UUID PK
  video_product_id: string          // UUID FK→video_products NOT NULL
  platform: Platform                // VARCHAR(20) NOT NULL
  conversion_type: ConversionGoal   // VARCHAR(20) DEFAULT 'awareness'
  title: string | null              // VARCHAR(200)
  description: string | null        // TEXT
  tags: string[]                    // VARCHAR(50)[]
  comment_guide: string[]           // TEXT[]
  reply_templates: string[]         // TEXT[]
  seo_score: number | null          // INTEGER
  publish_url: string | null        // VARCHAR(500)
  status: PublishStatus             // VARCHAR(20) DEFAULT 'unpublished'
  aigc_confirmed: boolean           // BOOLEAN DEFAULT false
  geo_info: Record<string, unknown> | null // JSONB 地理位置
  published_at: string | null       // TIMESTAMPTZ
  created_at: string
  updated_at: string
}

// --- 3.15 content_assets ---
export interface ContentAssetRecord {
  id: string                        // UUID PK
  user_id: string                   // UUID FK→users NOT NULL
  title: string                     // VARCHAR(200) NOT NULL
  type: ContentAssetType            // VARCHAR(20) NOT NULL
  video_product_id: string | null   // UUID FK→video_products
  platforms: Platform[]             // VARCHAR(20)[]
  status: ContentAssetStatus        // VARCHAR(20) DEFAULT 'draft'
  core_metrics: Record<string, number> | null // JSONB play_count/interaction_rate/completion_rate等
  element_highlights: string[]      // TEXT[]
  custom_tags: string[]             // VARCHAR(50)[]
  performance_tags: PerformanceTag[] // VARCHAR(30)[]
  published_at: string | null       // TIMESTAMPTZ
  archived_at: string | null        // TIMESTAMPTZ
  created_at: string
  updated_at: string
}

// --- 3.16 video_metrics ---
export interface VideoMetricRecord {
  id: string                        // UUID PK
  user_id: string                   // UUID FK→users NOT NULL
  video_id: string                  // UUID FK→videos NOT NULL
  date: string                      // DATE NOT NULL
  play_count: number                // INTEGER DEFAULT 0
  like_count: number                 // INTEGER DEFAULT 0
  comment_count: number              // INTEGER DEFAULT 0
  collect_count: number              // INTEGER DEFAULT 0
  interaction_rate: number | null    // DECIMAL(5,2)
}
// UNIQUE(user_id, video_id, date)

// --- 3.17 data_snapshots ---
export interface DataSnapshotRecord {
  id: number                        // SERIAL PK
  user_id: string                   // UUID FK→users NOT NULL
  publish_record_id: string         // UUID FK→publish_records NOT NULL
  snapshot_at: string               // TIMESTAMPTZ NOT NULL
  play_count: number                 // INTEGER
  completion_rate: number            // DECIMAL(5,2)
  three_second_bounce_rate: number   // DECIMAL(5,2)
  comment_count: number              // INTEGER
  private_message_count: number      // INTEGER
  created_at: string
}

// --- 3.18 experience_logs ---
export interface ExperienceLogRecord {
  id: number                        // SERIAL PK
  user_id: string                   // UUID FK→users NOT NULL
  task_id: string                   // UUID FK→tasks NOT NULL
  week_number: number               // INTEGER NOT NULL
  biggest_surprise: string          // TEXT NOT NULL
  biggest_mistake: string           // TEXT NOT NULL
  next_hypothesis: string           // TEXT NOT NULL
  tags: string[]                    // VARCHAR(50)[]
  created_at: string
}

// --- 3.19 notifications ---
export interface NotificationRecord {
  id: string                        // UUID PK
  user_id: string                   // UUID FK→users NOT NULL
  title: string                     // VARCHAR(200) NOT NULL
  content: string | null            // TEXT
  type: string                      // VARCHAR(50) NOT NULL
  is_read: boolean                  // BOOLEAN DEFAULT false
  created_at: string
}

// --- 3.20 pending_items ---
export interface PendingItemRecord {
  id: string                        // UUID PK
  user_id: string                   // UUID FK→users NOT NULL
  source_type: string               // VARCHAR(50) NOT NULL
  source_id: string                 // UUID NOT NULL
  status: string                    // VARCHAR(20) DEFAULT 'pending'
  created_at: string
}

// --- 3.21 persona_configs ---
export interface PersonaConfigRecord {
  id: number                        // SERIAL PK
  user_id: string                   // UUID FK→users NOT NULL UNIQUE
  language_style: string            // TEXT NOT NULL
  catchphrases: string[]            // VARCHAR(100)[]
  narrative_perspective: 'first_person' | 'third_person' | 'second_person'
  taboo_words: string[]             // VARCHAR(100)[]
  tone: string                      // VARCHAR(50)
  sample_files: SampleFileRecord[]  // JSONB
  created_at: string
  updated_at: string
}

// --- 3.22 sample_files（persona子结构） ---
export interface SampleFileRecord {
  id: number
  file_name: string
  file_url: string
  type: SampleType
  uploaded_at: string
}

// --- 3.23 keyword_trends ---
export interface KeywordTrendRecord {
  id: number                        // SERIAL PK
  keyword_id: number                // INTEGER FK→keyword_monitors NOT NULL
  date: string                      // DATE NOT NULL
  hot_value: number                 // INTEGER
  platform_rank: number | null      // INTEGER
}

// --- 3.24 schedule_config（采集调度，非持久化表） ---
export interface ScheduleConfig {
  frequency: string                 // 'daily' | 'weekly'
  execute_time: string              // HH:mm
  is_enabled: boolean
}

// --- 3.25 collect_task_logs ---
export interface CollectTaskLogRecord {
  id: number                        // SERIAL PK
  task_id: string                   // UUID FK→collect_tasks NOT NULL
  level: 'info' | 'warn' | 'error'
  message: string
  created_at: string
}

// --- 3.26 render_tasks ---
export interface RenderTaskRecord {
  id: string                        // UUID PK
  video_product_id: string          // UUID FK→video_products NOT NULL
  status: GenerateStatus
  progress: number                  // DECIMAL(5,2)
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

// --- 3.27 ai_studio_projects ---
export interface AiStudioProjectRecord {
  id: string                        // UUID PK
  user_id: string                   // UUID FK→users NOT NULL
  title: string                     // VARCHAR(200) NOT NULL
  description: string | null        // TEXT
  status: AiStudioProjectStatus     // VARCHAR(20) NOT NULL DEFAULT 'draft'
  created_at: string
  updated_at: string
}

// --- 3.28 ai_studio_assets ---
export interface AiStudioAssetRecord {
  id: string                        // UUID PK
  project_id: string                // UUID FK→ai_studio_projects NOT NULL
  type: AiStudioAssetType           // VARCHAR(20) NOT NULL
  task_type: JimengTaskType         // VARCHAR(50) NOT NULL
  status: AiStudioAssetStatus       // VARCHAR(20) NOT NULL DEFAULT 'pending'
  input_params: Record<string, unknown> // JSONB NOT NULL
  file_url: string | null           // VARCHAR(500)
  thumbnail_url: string | null      // VARCHAR(500)
  width: number | null              // INTEGER
  height: number | null             // INTEGER
  duration: number | null           // INTEGER 秒
  file_size: number | null          // BIGINT
  error: string | null              // TEXT
  jimeng_task_id: string | null     // VARCHAR(100)
  created_at: string
  updated_at: string
}

// --- 2.X 渲染配置（VideoProduct.render_config） ---
export interface RenderConfig {
  subtitle_style?: {
    font_size?: number      // 默认 48
    color?: string          // 默认 '#FFFFFF'
    position?: 'top' | 'center' | 'bottom'
    bg_color?: string       // 默认 '#000000'
    bg_opacity?: number     // 0-1，默认 0.6
  }
  bgm_volume?: number       // 0-1，默认 0.3
  voice_volume?: number     // 0-1，默认 1.0
}


// ============================================================
// §4 API 端点常量
// ============================================================

export const API = {
  // --- 用户 ---
  USERS: {
    ME: '/users/me',
  },

  // --- 通知 ---
  NOTIFICATIONS: {
    UNREAD_COUNT: '/notifications/unread-count',
  },

  // --- 仪表盘 ---
  DASHBOARD: {
    WORKFLOW: '/dashboard/workflow',
    STATS: '/dashboard/stats',
    OVERVIEW: '/dashboard/overview',
    VIDEO_RECORDS: '/dashboard/video-records',
    TRENDS: '/dashboard/trends',
    SNAPSHOTS: '/dashboard/snapshots',
    AI_ANALYSIS: '/dashboard/ai-analysis',
    AI_ANALYSIS_STATUS: (taskId: string) => `/dashboard/ai-analysis/${taskId}`,
  },

  // --- 任务 ---
  TASKS: {
    LIST: '/tasks',
    CREATE: '/tasks',
    CONVERSION_GOAL: (taskId: string) => `/tasks/${taskId}/conversion-goal`,
    IMPORT_INSTRUCTIONS: (taskId: string) => `/tasks/${taskId}/import-instructions`,
    IMPORT_EXPERIENCE: (taskId: string) => `/tasks/${taskId}/import-experience`,
  },

  // --- 对标账号 ---
  BENCHMARK_ACCOUNTS: {
    LIST: '/benchmark-accounts',
    STATS: '/benchmark-accounts/stats',
    CREATE: '/benchmark-accounts',
    UPDATE: (id: string) => `/benchmark-accounts/${id}`,
    DELETE: (id: string) => `/benchmark-accounts/${id}`,
    TOGGLE_MONITOR: (id: string) => `/benchmark-accounts/${id}/monitor`,
  },

  // --- 采集任务 ---
  COLLECT_TASKS: {
    LIST: '/collect-tasks',
    STATS: '/collect-tasks/stats',
    CREATE: '/collect-tasks',
    UPDATE: (id: string) => `/collect-tasks/${id}`,
    DELETE: (id: string) => `/collect-tasks/${id}`,
    BATCH_DELETE: '/collect-tasks/batch',
    EXECUTE: (id: string) => `/collect-tasks/${id}/execute`,
    PAUSE: (id: string) => `/collect-tasks/${id}/pause`,
    RETRY: (id: string) => `/collect-tasks/${id}/retry`,
    RERUN: (id: string) => `/collect-tasks/${id}/rerun`,
    LOGS: (id: string) => `/collect-tasks/${id}/logs`,
    SCHEDULE: '/collect-tasks/schedule',
  },

  // --- 爆款视频 ---
  VIRAL_VIDEOS: {
    LIST: '/viral-videos',
    DETAIL: (id: number) => `/viral-videos/${id}`,
    ANALYZE_BATCH: '/viral-videos/analyze-batch',
    EXPORT: '/viral-videos/export',
    TRANSCRIPT_EXTRACT: (id: number) => `/viral-videos/${id}/transcript/extract`,
    ANALYZE: (id: number) => `/viral-videos/${id}/analyze`,
    SAVE_TRANSCRIPT: (id: number) => `/viral-videos/${id}/transcript`,
    DOWNLOAD: (id: number) => `/viral-videos/${id}/download`,
  },

  // --- 热点 ---
  HOTSPOTS: {
    LIST: '/hotspots',
    REFRESH: '/hotspots/refresh',
    CREATE: '/hotspots',
    UPDATE: (id: number) => `/hotspots/${id}`,
    EXPIRE: (id: number) => `/hotspots/${id}/expire`,
    RECOMMENDED: '/hotspots/recommended',
  },

  // --- 关键词监控 ---
  KEYWORD_MONITORS: {
    LIST: '/keyword-monitors',
    TRENDS: '/keyword-monitors/trends',
    CREATE: '/keyword-monitors',
    DELETE: (id: number) => `/keyword-monitors/${id}`,
  },

  // --- 选题提案 ---
  TOPIC_PROPOSALS: {
    GENERATE: '/topic-proposals/generate',
    GENERATE_STATUS: (taskId: string) => `/topic-proposals/generate/${taskId}/status`,
    SELECT: (topicId: number) => `/topic-proposals/${topicId}/select`,
    MERGE: '/topic-proposals/merge',
    ADD_VIDEOS: '/topic-proposals/add-videos',
  },

  // --- 人设配置 ---
  PERSONA: {
    GET: '/persona',
    SAVE: '/persona',
    UPLOAD_SAMPLE: '/persona/samples',
    DELETE_SAMPLE: (id: number) => `/persona/samples/${id}`,
    PREVIEW: '/persona/preview',
  },

  // --- 脚本 ---
  SCRIPTS: {
    GET: (id: number) => `/scripts/${id}`,
    CREATE: '/scripts',
    SAVE: (id: number) => `/scripts/${id}`,
    SEGMENTS: (id: number) => `/scripts/${id}/segments`,
    GENERATE_STORYBOARD: (id: number) => `/scripts/${id}/generate-storyboard`,
    STORYBOARD_STATUS: (scriptId: number, taskId: string) =>
      `/scripts/${scriptId}/generate-storyboard/${taskId}/status`,
    SAVE_SEGMENT: (scriptId: number, segmentId: number) =>
      `/scripts/${scriptId}/segments/${segmentId}`,
    ADD_SEGMENT: (id: number) => `/scripts/${id}/segments`,
    DELETE_SEGMENT: (scriptId: number, segmentId: number) =>
      `/scripts/${scriptId}/segments/${segmentId}`,
    REORDER_SEGMENTS: (id: number) => `/scripts/${id}/segments/reorder`,
    AI_CHECK: (id: number) => `/scripts/${id}/ai-check`,
    APPLY_SUGGESTION: (id: number) => `/scripts/${id}/apply-suggestion`,
    GENERATE_VOICEOVER: (id: number) => `/scripts/${id}/generate-voiceover`,
    VOICEOVER_STATUS: (scriptId: number, taskId: string) =>
      `/scripts/${scriptId}/generate-voiceover/${taskId}/status`,
    PREVIEW_AUDIO: (id: number) => `/scripts/${id}/preview-audio`,
    MATERIALS: (id: number) => `/scripts/${id}/materials`,
    CONFIRM: (id: number) => `/scripts/${id}/status`,
    STORYBOARD: (scriptId: string) => `/scripts/${scriptId}/storyboard`,
    UPDATE_TRANSITION: (scriptId: string, segmentId: string) =>
      `/scripts/${scriptId}/segments/${segmentId}/transition`,
    REPLACE_MATERIALS: (scriptId: string, segmentId: string) =>
      `/scripts/${scriptId}/segments/${segmentId}/materials`,
    RENDER_CONFIG: (scriptId: string) => `/scripts/${scriptId}/render-config`,
    SAVE_PROGRESS: (scriptId: string) => `/scripts/${scriptId}/save-progress`,
    COMPOSITION: (scriptId: string) => `/scripts/${scriptId}/composition`,
  },

  // --- 素材 ---
  MATERIALS: {
    LIST: '/materials',
    STATS: '/materials/stats',
    UPLOAD: '/materials',
    GENERATE: '/materials/generate',
    GENERATE_STATUS: (taskId: string) => `/materials/generate/${taskId}/status`,
    GENERATE_CONFIRM: (taskId: string) => `/materials/generate/${taskId}/confirm`,
    PEXELS_SEARCH: '/materials/pexels-search',
    PEXELS_IMPORT: '/materials/pexels-import',
    UPDATE: (id: string) => `/materials/${id}`,
    DELETE: (id: string) => `/materials/${id}`,
    REFERENCES: (id: string) => `/materials/${id}/references`,
    DOWNLOAD: (id: string) => `/materials/${id}/download`,
  },

  // --- 视频产品 ---
  VIDEO_PRODUCTS: {
    PUBLISH_WORKSPACE: (id: string) => `/video-products/${id}/publish-workspace`,
    GENERATE_COPY_BATCH: (id: string) => `/video-products/${id}/generate-copy/batch`,
    PREVIEW: (id: string) => `/video-products/${id}/preview`,
    RENDER: '/video-products/render',
    RENDER_STATUS: (id: string) => `/video-products/${id}/render-status`,
    RENDER_CANCEL: (id: string) => `/video-products/${id}/render-cancel`,
    DERIVE: (id: string) => `/video-products/${id}/derive`,
  },

  // --- 发布记录 ---
  PUBLISH_RECORDS: {
    GET: '/publish-records',
    GENERATE_COPY: (id: string) => `/publish-records/${id}/generate-copy`,
    SAVE_CONTENT: (id: string) => `/publish-records/${id}/content`,
    SEO_CHECK: (id: string) => `/publish-records/${id}/seo-check`,
    AUTO_SAVE: (id: string) => `/publish-records/${id}/auto-save`,
    ADD_TAG: (id: string) => `/publish-records/${id}/tags`,
    REMOVE_TAG: (recordId: string, tag: string) => `/publish-records/${recordId}/tags/${tag}`,
    GENERATE_GEO: (id: string) => `/publish-records/${id}/generate-geo`,
    PUBLISH: (id: string) => `/publish-records/${id}/publish`,
    AIGC_CONFIRM: (id: string) => `/publish-records/${id}/aigc-confirm`,
    CONVERSION_TYPE: (id: string) => `/publish-records/${id}/conversion-type`,
  },

  // --- 内容资产 ---
  CONTENT_ASSETS: {
    LIST: '/content-assets',
    DETAIL: (id: string) => `/content-assets/${id}`,
    MATERIALS: (id: string) => `/content-assets/${id}/materials`,
    TRENDS: (id: string) => `/content-assets/${id}/trends`,
    CREATE_HIGHLIGHT: (id: string) => `/content-assets/${id}/highlights`,
    REUSE_MATERIALS: (id: string) => `/content-assets/${id}/reuse-materials`,
    REUSE_SCRIPT: (id: string) => `/content-assets/${id}/reuse-script`,
    DELETE: (id: string) => `/content-assets/${id}`,
    EXPORT: (id: string) => `/content-assets/${id}/export`,
    AUTO_CREATE: '/content-assets/auto-create',
  },

  // --- 经验日志 ---
  EXPERIENCE_LOGS: {
    CREATE: '/experience-logs',
  },

  // --- 周报 ---
  REPORTS: {
    WEEKLY: '/reports/weekly',
  },

  // --- AI工作室 ---
  AI_STUDIO: {
    PROJECTS: '/ai-studio/projects',
    PROJECT: (id: string) => `/ai-studio/projects/${id}`,
    PROJECT_ASSETS: (projectId: string) => `/ai-studio/projects/${projectId}/assets`,
    ASSET: (id: string) => `/ai-studio/assets/${id}`,
    GENERATE: '/ai-studio/generate',
    TASK_STATUS: (id: string) => `/ai-studio/tasks/${id}/status`,
    PUSH_TO_MATERIALS: (id: string) => `/ai-studio/assets/${id}/push-to-materials`,
    PUSH_TO_SEGMENT: (id: string) => `/ai-studio/assets/${id}/push-to-segment`,
  },
} as const


// ============================================================
// §5 路由配置
// ============================================================

export const ROUTES = {
  DASHBOARD: '/dashboard',
  HOTSPOTS: '/hotspots',
  BENCHMARK_ACCOUNTS: '/benchmark-accounts',
  COLLECT_TASKS: '/collect-tasks',
  VIRAL_VIDEOS: '/viral-videos',
  VIRAL_VIDEO_DETAIL: '/viral-videos/:id',
  TOPIC_WORKBENCH: '/topic-workbench',
  PERSONA: '/persona',
  SCRIPT_EDITOR: '/scripts/:id',
  MATERIALS: '/materials',
  VIDEO_PREVIEW: '/video-preview/:scriptId?',
  PUBLISH: '/publish/:videoProductId',
  MONITORING: '/monitoring',
  CONTENT_ASSETS: '/content-assets',
  AI_STUDIO: '/ai-studio',
  AI_STUDIO_PROJECT: '/ai-studio/:projectId',
} as const


// ============================================================
// §6 跨页面参数
// ============================================================

export interface CrossPageParams {
  // 热点追踪 → 选题工作台
  hotspot_to_topic: {
    hotspot_ids: number[]
    hotspot_titles: string[]
    ai_suggestions: string[]
  }

  // 仪表盘 → 选题工作台（单个热点，接收方封装为数组）
  dashboard_to_topic: {
    hotspot_id: string
    hotspot_title: string
  }

  // 爆款视频库 → 选题工作台
  videos_to_topic: {
    video_ids: number[]
  }

  // 视频详情 → 选题工作台
  video_detail_to_topic: {
    video_id: number
    video_title: string
    transcript: string
  }

  // 选题工作台 → 脚本编辑器
  topic_to_script: {
    topic_id: number
    topic_title: string
    script_text: string
    content_skeleton: ContentSkeleton
    voice_ratio: number
  }

  // 脚本编辑器 → 视频预览与渲染
  script_to_preview: {
    script_id: number
    storyboard_segments: StoryboardSegment[]
    materials: { id: string; type: MaterialType }[]
  }

  // 视频预览与渲染 → 发布工作台
  preview_to_publish: {
    video_id: string
    video_url: string
    script_text: string
  }

  // 发布工作台 → 数据监控面板
  publish_to_monitor: {
    video_id: string
  }

  // 数据监控面板 → 选题工作台
  monitor_to_topic: {
    improvement_instructions: string[]
    experience_log: {
      biggest_surprise: string
      biggest_mistake: string
      next_hypothesis: string
    }
  }

  // 对标账号管理 → 爆款视频库
  account_to_videos: {
    account_id: string
    platform: Platform
  }

  // 爆款视频库 → 数据采集任务
  videos_to_collect: {
    task_id: string
    account_id: string
  }

  // 内容资产库 → 素材库（复用素材）
  asset_to_materials: {
    material_ids: string[]
  }

  // 内容资产库 → 脚本编辑器（复用结构）
  asset_to_script: {
    script_structure: ContentSkeleton
  }

  // 脚本编辑器/视频预览 → 素材库
  to_materials: {
    material_ids: string[]
  }
}


// ============================================================
// §7 互动率公式（全局统一定义）
// ============================================================

/**
 * 互动率 = (点赞 + 评论 + 收藏) / 播放量 × 100
 * 播放量为0时返回 null
 */
export function calcInteractionRate(params: {
  like_count: number
  comment_count: number
  collect_count: number
  play_count: number
}): number | null {
  if (params.play_count === 0) return null
  return Number(
    ((params.like_count + params.comment_count + params.collect_count) / params.play_count * 100).toFixed(1)
  )
}
