<template>
  <div class="dashboard-page">
    <h2>数据看板</h2>

    <!-- 概览卡片 -->
    <div class="overview-cards" v-if="overview">
      <div class="overview-card">
        <div class="ov-value-row">
          <span class="ov-value">{{ overview.recent_publishes_7d }}</span>
          <span v-if="overview.recent_publishes_7d_trend != null" class="trend-badge" :class="trendClass(overview.recent_publishes_7d_trend)">
            {{ trendIcon(overview.recent_publishes_7d_trend) }} {{ Math.abs(overview.recent_publishes_7d_trend) }}%
          </span>
        </div>
        <span class="ov-label">近7天发布</span>
      </div>
      <div class="overview-card">
        <span class="ov-value">{{ overview.total_plays.toLocaleString() }}</span>
        <span class="ov-label">总播放量</span>
      </div>
      <div class="overview-card">
        <span class="ov-value">{{ overview.avg_completion_rate }}%</span>
        <span class="ov-label">平均完播率</span>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards" v-if="stats">
      <div class="stat-card">
        <div class="stat-value-row">
          <span class="stat-value">{{ stats.total_tasks }}</span>
          <span v-if="stats.task_trend != null" class="trend-badge" :class="trendClass(stats.task_trend)">
            {{ trendIcon(stats.task_trend) }} {{ Math.abs(stats.task_trend) }}%
          </span>
        </div>
        <span class="stat-label">总任务</span>
      </div>
      <div class="stat-card">
        <span class="stat-value text-blue">{{ stats.active_tasks }}</span>
        <span class="stat-label">进行中</span>
      </div>
      <div class="stat-card">
        <div class="stat-value-row">
          <span class="stat-value">{{ stats.total_videos }}</span>
          <span v-if="stats.video_trend != null" class="trend-badge" :class="trendClass(stats.video_trend)">
            {{ trendIcon(stats.video_trend) }} {{ Math.abs(stats.video_trend) }}%
          </span>
        </div>
        <span class="stat-label">总视频</span>
      </div>
      <div class="stat-card">
        <span class="stat-value text-green">{{ stats.published_videos }}</span>
        <span class="stat-label">已发布</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.total_materials }}</span>
        <span class="stat-label">素材数</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.total_assets }}</span>
        <span class="stat-label">资产数</span>
      </div>
    </div>

    <div class="dashboard-tabs">
      <button class="filter-tab" :class="{ active: activeTab === 'workflow' }" @click="activeTab = 'workflow'">工作流</button>
      <button class="filter-tab" :class="{ active: activeTab === 'videos' }" @click="activeTab = 'videos'; loadVideoRecords()">视频记录</button>
      <button class="filter-tab" :class="{ active: activeTab === 'trends' }" @click="activeTab = 'trends'; loadTrends()">趋势</button>
    </div>

    <!-- 工作流 -->
    <div v-if="activeTab === 'workflow'" class="tab-content">
      <div v-if="workflowItems.length === 0" class="empty-state"><p>暂无任务</p></div>
      <div v-else class="workflow-list">
        <div v-for="item in workflowItems" :key="item.id" class="workflow-item">
          <div class="wf-info">
            <span class="wf-title">{{ item.title || '未命名任务' }}</span>
            <span class="wf-date">{{ formatDate(item.created_at) }}</span>
          </div>
          <div class="wf-steps">
            <div class="wf-step" :class="{ done: item.has_topic, current: !item.has_topic }">
              <span class="step-dot"></span>选题
            </div>
            <div class="wf-step" :class="{ done: item.has_script }">
              <span class="step-dot"></span>脚本
            </div>
            <div class="wf-step" :class="{ done: item.has_video }">
              <span class="step-dot"></span>视频
            </div>
            <div class="wf-step" :class="{ done: item.video_status === 'published' }">
              <span class="step-dot"></span>发布
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 视频记录 -->
    <div v-if="activeTab === 'videos'" class="tab-content">
      <div class="filter-tabs" style="margin-bottom: 12px;">
        <button v-for="tab in videoPlatformTabs" :key="tab.value" class="filter-tab" :class="{ active: videoPlatformFilter === tab.value }" @click="videoPlatformFilter = tab.value; loadVideoRecords()">
          {{ tab.label }}
        </button>
      </div>
      <div v-if="videoRecords.length === 0" class="empty-state"><p>暂无发布记录</p></div>
      <div v-else class="records-table-wrap">
        <table class="records-table">
          <thead>
            <tr>
              <th>视频标题</th>
              <th>平台</th>
              <th>状态</th>
              <th>播放量</th>
              <th>完播率</th>
              <th>评论</th>
              <th>发布时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in videoRecords" :key="r.id">
              <td>{{ r.video_title }}</td>
              <td><span class="platform-badge" :class="r.platform">{{ platformLabel(r.platform) }}</span></td>
              <td><span class="status-sm" :class="r.status">{{ publishStatusLabel(r.status) }}</span></td>
              <td>{{ r.latest_metrics?.play_count?.toLocaleString() ?? '-' }}</td>
              <td>{{ r.latest_metrics ? r.latest_metrics.completion_rate + '%' : '-' }}</td>
              <td>{{ r.latest_metrics?.comment_count ?? '-' }}</td>
              <td>{{ r.published_at ? formatDate(r.published_at) : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 趋势 -->
    <div v-if="activeTab === 'trends'" class="tab-content">
      <div v-if="trendPoints.length === 0" class="empty-state"><p>暂无趋势数据，发布视频后将自动采集</p></div>
      <div v-else class="trend-chart">
        <div class="trend-bars">
          <div v-for="point in trendPoints" :key="point.date" class="trend-bar-col">
            <div class="trend-bar" :style="{ height: barHeight(point.play_count) + 'px' }" :title="point.play_count + ' 播放'"></div>
            <span class="bar-label">{{ point.date.slice(5) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'

const activeTab = ref('workflow')
const videoPlatformFilter = ref('all')
const overview = ref<{ recent_publishes_7d: number; total_plays: number; avg_completion_rate: number; recent_publishes_7d_trend: number | null } | null>(null)
const stats = ref<{ total_tasks: number; active_tasks: number; total_videos: number; published_videos: number; total_materials: number; total_assets: number; task_trend: number | null; video_trend: number | null } | null>(null)
const workflowItems = ref<{ id: string; title: string; status: string; current_step: number; has_topic: boolean; has_script: boolean; script_status: string | null; has_video: boolean; video_status: string | null; created_at: string }[]>([])
const videoRecords = ref<{ id: string; video_title: string; platform: string; status: string; published_at: string | null; latest_metrics: { play_count: number; completion_rate: number; comment_count: number } | null }[]>([])
const trendPoints = ref<{ date: string; play_count: number; completion_rate: number; comment_count: number }[]>([])

const platformLabels: Record<string, string> = { xiaohongshu: '小红书', douyin: '抖音', weixin: '视频号' }
const publishStatusLabels: Record<string, string> = { unpublished: '未发布', published: '已发布', failed: '失败' }

const videoPlatformTabs = [
  { value: 'all', label: '全部' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'weixin', label: '视频号' },
]

function platformLabel(p: string): string { return platformLabels[p] ?? p }
function publishStatusLabel(s: string): string { return publishStatusLabels[s] ?? s }
function formatDate(iso: string): string { return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }

function barHeight(count: number): number {
  const max = Math.max(...trendPoints.value.map(p => p.play_count), 1)
  return Math.max(4, (count / max) * 120)
}

function trendClass(trend: number | null): string {
  if (trend == null) return ''
  return trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-flat'
}

function trendIcon(trend: number | null): string {
  if (trend == null) return '—'
  return trend > 0 ? '↑' : trend < 0 ? '↓' : '—'
}

async function loadOverview(): Promise<void> {
  try { overview.value = await api.get<typeof overview.value>('/dashboard/overview') } catch (e) { console.error(e); toast.error('加载概览数据失败') }
}

async function loadStats(): Promise<void> {
  try { stats.value = await api.get<typeof stats.value>('/dashboard/stats') } catch (e) { console.error(e); toast.error('加载统计数据失败') }
}

async function loadWorkflow(): Promise<void> {
  try {
    const res = await api.get<{ items: typeof workflowItems.value }>('/dashboard/workflow')
    workflowItems.value = res.items
  } catch (e) { console.error(e); toast.error('加载工作流失败') }
}

async function loadVideoRecords(): Promise<void> {
  try {
    const params = [`page_size=50`]
    if (videoPlatformFilter.value !== 'all') params.push(`platform=${videoPlatformFilter.value}`)
    const query = params.join('&')
    const res = await api.get<{ items: typeof videoRecords.value }>(`/dashboard/video-records?${query}`)
    videoRecords.value = res.items
  } catch (e) { console.error(e); toast.error('加载视频记录失败') }
}

async function loadTrends(): Promise<void> {
  try {
    const res = await api.get<{ points: typeof trendPoints.value }>('/dashboard/trends')
    trendPoints.value = res.points
  } catch (e) { console.error(e); toast.error('加载趋势数据失败') }
}

onMounted(() => { loadOverview(); loadStats(); loadWorkflow() })
</script>

<style scoped>
.dashboard-page { max-width: 1100px; margin: 0 auto; }
.dashboard-page h2 { margin: 0 0 20px; font-size: 22px; color: #1a1a2e; }
.overview-cards { display: flex; gap: 16px; margin-bottom: 20px; }
.overview-card { background: linear-gradient(135deg, #4a6cf7, #6366f1); border-radius: 10px; padding: 20px 24px; display: flex; flex-direction: column; gap: 4px; flex: 1; color: #fff; }
.ov-value { font-size: 28px; font-weight: 700; }
.ov-label { font-size: 13px; opacity: 0.8; }
.stats-cards { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.stat-card { background: #fff; border-radius: 8px; padding: 16px 24px; border: 1px solid #eee; display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 120px; }
.stat-value { font-size: 22px; font-weight: 700; color: #1a1a2e; }
.stat-value.text-blue { color: #4a6cf7; }
.stat-value.text-green { color: #16a34a; }
.stat-label { font-size: 12px; color: #999; }
.ov-value-row, .stat-value-row { display: flex; align-items: center; gap: 8px; }
.trend-badge { font-size: 12px; font-weight: 600; }
.trend-up { color: #16a34a; }
.trend-down { color: #e53935; }
.trend-flat { color: #999; }
.dashboard-tabs { display: flex; gap: 4px; margin-bottom: 16px; }
.filter-tab { padding: 6px 16px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 13px; }
.filter-tab.active { background: #4a6cf7; color: #fff; border-color: #4a6cf7; }
.tab-content { background: #fff; border-radius: 10px; border: 1px solid #eee; padding: 16px; min-height: 300px; }
.workflow-list { display: flex; flex-direction: column; gap: 8px; }
.workflow-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #f0f0f0; border-radius: 8px; }
.wf-info { display: flex; flex-direction: column; gap: 2px; }
.wf-title { font-size: 14px; font-weight: 500; color: #333; }
.wf-date { font-size: 12px; color: #999; }
.wf-steps { display: flex; gap: 16px; }
.wf-step { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #ccc; }
.wf-step.done { color: #16a34a; }
.wf-step.current { color: #4a6cf7; }
.step-dot { width: 8px; height: 8px; border-radius: 50%; background: #eee; flex-shrink: 0; }
.wf-step.done .step-dot { background: #16a34a; }
.wf-step.current .step-dot { background: #4a6cf7; }
.records-table-wrap { overflow-x: auto; }
.records-table { width: 100%; border-collapse: collapse; }
.records-table th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 500; color: #999; border-bottom: 1px solid #eee; }
.records-table td { padding: 10px 12px; font-size: 13px; color: #333; border-bottom: 1px solid #f5f5f5; }
.platform-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.platform-badge.xiaohongshu { background: #ffe0e6; color: #e53935; }
.platform-badge.douyin { background: #e8f5e9; color: #2e7d32; }
.platform-badge.weixin { background: #e3f2fd; color: #1565c0; }
.status-sm { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.status-sm.published { background: #dcfce7; color: #16a34a; }
.status-sm.unpublished { background: #f5f5f5; color: #999; }
.status-sm.failed { background: #ffebee; color: #e53935; }
.trend-chart { padding: 20px; }
.trend-bars { display: flex; align-items: flex-end; gap: 4px; height: 150px; padding-top: 10px; }
.trend-bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; }
.trend-bar { width: 100%; max-width: 30px; background: #4a6cf7; border-radius: 3px 3px 0 0; min-height: 4px; transition: height 0.3s; }
.bar-label { font-size: 10px; color: #999; margin-top: 4px; }
.empty-state { text-align: center; padding: 60px; color: #999; }
</style>
