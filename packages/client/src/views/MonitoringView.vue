<template>
  <div class="monitor-page">
    <!-- 页面标题 + 时间筛选 -->
    <div class="title-bar">
      <h2>数据监控</h2>
      <div class="time-tabs">
        <button
          v-for="tab in timeTabs"
          :key="tab.value"
          class="tab-btn"
          :class="{ active: timeRange === tab.value }"
          @click="switchTimeRange(tab.value)"
        >{{ tab.label }}</button>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="overview-cards">
      <div class="kpi-card">
        <div class="kpi-label">总播放量</div>
        <div class="kpi-value">{{ formatNumber(overview.total_plays) }}</div>
        <div class="kpi-sub">近7天发布 {{ overview.recent_publishes_7d }} 条</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">平均完播率</div>
        <div class="kpi-value">{{ overview.avg_completion_rate }}%</div>
        <div class="kpi-sub">基于 {{ overview.total_snapshots }} 条快照</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">总互动数</div>
        <div class="kpi-value">{{ formatNumber(overview.total_comments) }}</div>
        <div class="kpi-sub">评论总量</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">快照总数</div>
        <div class="kpi-value">{{ overview.total_snapshots }}</div>
        <div class="kpi-sub">数据记录次数</div>
      </div>
    </div>

    <!-- 双栏布局 -->
    <div class="dual-column">
      <!-- 左栏: 视频数据列表 -->
      <div class="left-column">
        <div class="section-header">
          <h3>视频数据</h3>
          <input
            v-model="searchQuery"
            class="search-input"
            placeholder="搜索视频..."
            @input="onSearch"
          />
        </div>

        <div v-if="videoLoading" class="loading-box">加载中...</div>
        <div v-else-if="videoRecords.length === 0" class="empty-state">
          <p>暂无视频数据</p>
        </div>
        <div v-else class="video-table-wrap">
          <table class="video-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>平台</th>
                <th>播放量</th>
                <th>完播率</th>
                <th>评论数</th>
                <th>发布日期</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in videoRecords" :key="r.id">
                <td class="td-title">{{ r.video_title }}</td>
                <td><span class="platform-tag" :class="r.platform">{{ platformLabel(r.platform) }}</span></td>
                <td>{{ formatNumber(r.latest_metrics?.play_count ?? 0) }}</td>
                <td>{{ r.latest_metrics ? r.latest_metrics.completion_rate + '%' : '--' }}</td>
                <td>{{ r.latest_metrics?.comment_count ?? 0 }}</td>
                <td>{{ formatDate(r.published_at, true) }}</td>
              </tr>
            </tbody>
          </table>

          <!-- 分页 -->
          <div v-if="videoTotal > videoPageSize" class="pagination">
            <button class="btn btn-sm" :disabled="videoPage <= 1" @click="videoPage--; loadVideoRecords()">上一页</button>
            <span class="page-info">{{ videoPage }} / {{ Math.ceil(videoTotal / videoPageSize) }}</span>
            <button class="btn btn-sm" :disabled="videoPage >= Math.ceil(videoTotal / videoPageSize)" @click="videoPage++; loadVideoRecords()">下一页</button>
          </div>
        </div>

        <!-- 关键词监控 (保留在左栏底部) -->
        <div class="section-header" style="margin-top: 28px;">
          <h3>关键词监控</h3>
          <button class="btn btn-primary btn-sm" @click="showAddKeyword = true">+ 添加</button>
        </div>
        <div v-if="monitorLoading" class="loading-box">加载中...</div>
        <div v-else-if="monitors.length === 0" class="empty-state"><p>暂无监控关键词</p></div>
        <div v-else class="monitor-list">
          <div v-for="m in monitors" :key="m.id" class="monitor-card">
            <div class="monitor-info">
              <span class="keyword">{{ m.keyword }}</span>
              <span class="status-dot" :class="m.is_active ? 'active' : 'inactive'"></span>
            </div>
            <button class="btn-sm btn-danger" @click="deleteMonitor(m.id)">删除</button>
          </div>
        </div>
      </div>

      <!-- 右栏: 趋势 + 踩坑日记 -->
      <div class="right-column">
        <!-- 趋势数据 -->
        <div class="section-header">
          <h3>数据趋势</h3>
          <span class="section-sub">最近 30 天</span>
        </div>
        <div v-if="trendLoading" class="loading-box">加载中...</div>
        <div v-else-if="trendPoints.length === 0" class="empty-state"><p>暂无趋势数据</p></div>
        <div v-else class="trend-list">
          <div v-for="(pt, i) in trendPoints" :key="i" class="trend-row">
            <span class="trend-date">{{ pt.date }}</span>
            <span class="trend-val">{{ formatNumber(pt.play_count) }} 播放</span>
            <span class="trend-val">完播 {{ pt.completion_rate }}%</span>
            <span class="trend-val">评论 {{ pt.comment_count }}</span>
          </div>
        </div>

        <!-- 踩坑日记 -->
        <div class="section-header" style="margin-top: 28px;">
          <h3>踩坑日记</h3>
        </div>
        <div class="pitfall-panel">
          <p class="pitfall-hint">记录每周的发现、失误和假设，持续优化内容策略。</p>
          <div class="form-field">
            <label>本周最大意外发现</label>
            <textarea v-model="weeklyForm.surprise" rows="3" placeholder="本周有什么出乎意料的发现？"></textarea>
          </div>
          <div class="form-field">
            <label>本周最大判断失误</label>
            <textarea v-model="weeklyForm.mistake" rows="3" placeholder="本周有什么判断失误？"></textarea>
          </div>
          <div class="form-field">
            <label>下周要测试的新假设</label>
            <textarea v-model="weeklyForm.hypothesis" rows="3" placeholder="下周准备验证什么假设？"></textarea>
          </div>
          <button class="btn btn-primary" :disabled="weeklySubmitting" @click="submitWeeklyLog">
            {{ weeklySubmitting ? '提交中...' : '保存本周总结' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 添加关键词弹窗 -->
    <div v-if="showAddKeyword" class="overlay" @click.self="showAddKeyword = false">
      <div class="dialog dialog-sm">
        <div class="dialog-header">
          <h3>添加监控关键词</h3>
          <button class="dialog-close" @click="showAddKeyword = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>关键词 <span class="required">*</span></label>
            <input v-model="newKeyword" placeholder="输入关键词" @keyup.enter="addMonitor" />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="addMonitor">添加</button>
            <button class="btn" @click="showAddKeyword = false">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'
import { formatNumber, formatDate, platformLabel } from '@/utils/format'

// ─── 类型定义 ───

interface Monitor {
  id: number
  keyword: string
  is_active: boolean
  created_at: string
}

interface OverviewData {
  total_plays: number
  avg_completion_rate: number
  recent_publishes_7d: number
  total_snapshots: number
  total_comments: number
}

interface VideoRecord {
  id: string
  video_title: string
  platform: string
  publish_url: string | null
  published_at: string | null
  latest_metrics: {
    play_count: number
    completion_rate: number
    comment_count: number
  } | null
}

interface TrendPoint {
  date: string
  play_count: number
  completion_rate: number
  comment_count: number
}

type TimeRange = 'today' | 'this_week' | 'this_month'

// ─── 时间筛选 ───

const timeTabs = [
  { label: '今日', value: 'today' as TimeRange },
  { label: '本周', value: 'this_week' as TimeRange },
  { label: '本月', value: 'this_month' as TimeRange },
]
const timeRange = ref<TimeRange>('this_week')

function switchTimeRange(range: TimeRange): void {
  timeRange.value = range
  loadOverview()
  loadVideoRecords()
  loadTrends()
}

// ─── 概览卡片 ───

const overview = reactive<OverviewData>({
  total_plays: 0,
  avg_completion_rate: 0,
  recent_publishes_7d: 0,
  total_snapshots: 0,
  total_comments: 0,
})

async function loadOverview(): Promise<void> {
  try {
    const res = await api.get<OverviewData & { total_comments?: number }>('/dashboard/overview')
    overview.total_plays = res.total_plays
    overview.avg_completion_rate = res.avg_completion_rate
    overview.recent_publishes_7d = res.recent_publishes_7d
    overview.total_snapshots = res.total_snapshots
    overview.total_comments = (res as unknown as Record<string, unknown>).total_comments as number ?? 0
  } catch (e) {
    console.error(e)
    // toast.error 已由拦截器处理
  }
}

// ─── 视频数据列表 ───

const videoRecords = ref<VideoRecord[]>([])
const videoLoading = ref(false)
const videoTotal = ref(0)
const videoPage = ref(1)
const videoPageSize = 20
const searchQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function loadVideoRecords(): Promise<void> {
  videoLoading.value = true
  try {
    const res = await api.get<{ items: VideoRecord[]; total: number }>('/dashboard/video-records', {
      params: { page: videoPage.value, page_size: videoPageSize, search: searchQuery.value || undefined, time_range: timeRange.value },
    })
    videoRecords.value = res.items
    videoTotal.value = res.total
  } catch (e) {
    console.error(e)
    toast.error('加载视频记录失败')
  } finally {
    videoLoading.value = false
  }
}

function onSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    videoPage.value = 1
    loadVideoRecords()
  }, 300)
}

// ─── 趋势数据 ───

const trendPoints = ref<TrendPoint[]>([])
const trendLoading = ref(false)

async function loadTrends(): Promise<void> {
  trendLoading.value = true
  try {
    const res = await api.get<{ points: TrendPoint[] }>('/dashboard/trends')
    trendPoints.value = res.points ?? []
  } catch (e) {
    console.error(e)
    toast.error('加载趋势数据失败')
  } finally {
    trendLoading.value = false
  }
}

// ─── 踩坑日记 ───

const weeklyForm = reactive({
  surprise: '',
  mistake: '',
  hypothesis: '',
})
const weeklySubmitting = ref(false)

async function submitWeeklyLog(): Promise<void> {
  if (!weeklyForm.surprise.trim() && !weeklyForm.mistake.trim() && !weeklyForm.hypothesis.trim()) {
    toast.warning('请至少填写一项内容')
    return
  }
  weeklySubmitting.value = true
  try {
    await api.post('/experience-logs', {
      biggest_surprise: weeklyForm.surprise,
      biggest_mistake: weeklyForm.mistake,
      next_hypothesis: weeklyForm.hypothesis,
      tags: [],
    })
    weeklyForm.surprise = ''
    weeklyForm.mistake = ''
    weeklyForm.hypothesis = ''
    toast.success('踩坑日记已保存')
  } catch (e) {
    console.error(e)
    toast.error('保存踩坑日记失败')
  } finally {
    weeklySubmitting.value = false
  }
}

// ─── 关键词监控（保留原有功能） ───

const monitors = ref<Monitor[]>([])
const monitorLoading = ref(false)
const showAddKeyword = ref(false)
const newKeyword = ref('')

async function loadMonitors(): Promise<void> {
  monitorLoading.value = true
  try {
    const res = await api.get<{ items: Monitor[] }>('/keyword-monitors')
    monitors.value = res.items
  } catch (e) {
    console.error(e)
    toast.error('加载监控列表失败')
  } finally {
    monitorLoading.value = false
  }
}

async function addMonitor(): Promise<void> {
  if (!newKeyword.value.trim()) return
  try {
    await api.post('/keyword-monitors', { keyword: newKeyword.value })
    newKeyword.value = ''
    showAddKeyword.value = false
    await loadMonitors()
  } catch (e) {
    console.error(e)
    toast.error('添加监控失败')
  }
}

async function deleteMonitor(id: number): Promise<void> {
  if (!confirm('确定删除此监控？')) return
  try {
    await api.delete(`/keyword-monitors/${id}`)
    await loadMonitors()
  } catch (e) {
    console.error(e)
    toast.error('删除监控失败')
  }
}

// ─── 初始化 ───

onMounted(() => {
  loadOverview()
  loadVideoRecords()
  loadTrends()
  loadMonitors()
})
</script>

<style scoped>
.monitor-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px;
}

/* ─── 标题栏 ─── */
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.title-bar h2 {
  margin: 0;
  font-size: 22px;
  color: #1a1a2e;
}
.time-tabs {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
}
.tab-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #64748b;
  transition: all 0.2s;
}
.tab-btn.active {
  background: #fff;
  color: #1a1a2e;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ─── 概览卡片 ─── */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.kpi-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 18px 20px;
}
.kpi-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
}
.kpi-value {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
}
.kpi-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 6px;
}

/* ─── 双栏布局 ─── */
.dual-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.left-column,
.right-column {
  min-width: 0;
}

/* ─── 区块头 ─── */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.section-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1a1a2e;
}
.section-sub {
  font-size: 12px;
  color: #94a3b8;
}

/* ─── 搜索 ─── */
.search-input {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  width: 180px;
  box-sizing: border-box;
}
.search-input:focus {
  outline: none;
  border-color: #4a6cf7;
}

/* ─── 视频表格 ─── */
.video-table-wrap {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}
.video-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.video-table th {
  text-align: left;
  padding: 10px 14px;
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid #e2e8f0;
}
.video-table td {
  padding: 10px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}
.video-table tbody tr:hover {
  background: #f8fafc;
}
.video-table tbody tr:last-child td {
  border-bottom: none;
}
.td-title {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.platform-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.platform-tag.xiaohongshu {
  background: #fee2e2;
  color: #dc2626;
}
.platform-tag.douyin {
  background: #e0e7ff;
  color: #4338ca;
}
.platform-tag.weixin {
  background: #d1fae5;
  color: #059669;
}

/* ─── 分页 ─── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
}
.page-info {
  font-size: 13px;
  color: #64748b;
}

/* ─── 趋势列表 ─── */
.trend-list {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  max-height: 400px;
  overflow-y: auto;
}
.trend-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  font-size: 13px;
  border-bottom: 1px solid #f1f5f9;
}
.trend-row:last-child {
  border-bottom: none;
}
.trend-date {
  color: #64748b;
  font-size: 12px;
  min-width: 80px;
}
.trend-val {
  color: #334155;
  white-space: nowrap;
}

/* ─── 踩坑日记 ─── */
.pitfall-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 18px 20px;
}
.pitfall-hint {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

/* ─── 关键词监控 ─── */
.monitor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.monitor-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.keyword {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}
.monitor-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-dot.active { background: #22c55e; }
.status-dot.inactive { background: #ccc; }

/* ─── 弹窗 ─── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #fff;
  border-radius: 12px;
  width: 480px;
}
.dialog-sm { width: 400px; }
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}
.dialog-header h3 {
  margin: 0;
  font-size: 16px;
}
.dialog-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}
.dialog-body {
  padding: 20px;
}

/* ─── 表单 ─── */
.form-field {
  margin-bottom: 14px;
}
.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #475569;
  font-weight: 500;
}
.required { color: #e53935; }
.form-field input,
.form-field textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
  font-family: inherit;
  resize: vertical;
}
.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #4a6cf7;
}
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

/* ─── 通用按钮 ─── */
.btn {
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  background: #f1f5f9;
  color: #334155;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: #4a6cf7;
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: #3b5de7;
}
.btn-sm {
  padding: 5px 14px;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #475569;
}
.btn-sm.btn-danger {
  border-color: #fecaca;
  color: #dc2626;
  background: #fff;
}
.btn-sm.btn-danger:hover {
  background: #fef2f2;
}

/* ─── 空态 / 加载 ─── */
.empty-state,
.loading-box {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
}

/* ─── 响应式 ─── */
@media (max-width: 860px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  .dual-column {
    grid-template-columns: 1fr;
  }
}
</style>
