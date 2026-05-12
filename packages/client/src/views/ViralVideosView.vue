<template>
  <div class="viral-page">
    <div class="title-bar">
      <h2>爆款视频库</h2>
      <div class="title-actions">
        <button class="btn btn-sm" @click="analyzeSelected" :disabled="selected.length === 0">
          批量分析 ({{ selected.length }})
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-tabs">
        <button v-for="tab in platformTabs" :key="tab.value" class="filter-tab" :class="{ active: platformFilter === tab.value }" @click="platformFilter = tab.value; loadData()">
          {{ tab.label }}
        </button>
      </div>
      <input v-model="searchKeyword" class="search-input" placeholder="搜索视频标题..." @input="debouncedLoad" />
      <select v-model="sortOption" class="filter-select" @change="loadData(true)">
        <option value="play_count_desc">热度降序</option>
        <option value="like_count_desc">点赞数降序</option>
        <option value="comment_count_desc">评论数降序</option>
        <option value="created_at_desc">最新发布</option>
      </select>
      <select v-model="timeRange" class="filter-select" @change="loadData(true)">
        <option value="all">全部时间</option>
        <option value="7d">近7天</option>
        <option value="30d">近30天</option>
      </select>
      <span class="total-count">共 {{ totalCount }} 个视频</span>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="videos.length === 0" class="empty-state"><p>暂无爆款视频，采集对标账号视频后将自动入库</p></div>
    <div v-else class="video-table-wrap">
      <table class="video-table">
        <thead>
          <tr>
            <th style="width:40px"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></th>
            <th>封面</th>
            <th>标题</th>
            <th>平台</th>
            <th>播放</th>
            <th>互动率</th>
            <th>文案</th>
            <th>分析</th>
            <th>发布时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in videos" :key="v.id" :class="{ 'row-selected': selected.includes(v.id) }">
            <td><input type="checkbox" :checked="selected.includes(v.id)" @change="toggleSelect(v.id)" /></td>
            <td>
              <div class="cover-thumb">
                <img v-if="v.cover_url" :src="v.cover_url" :alt="v.title" loading="lazy" />
                <div v-else class="cover-placeholder">{{ v.duration }}s</div>
              </div>
            </td>
            <td><span class="video-title" :title="v.title">{{ v.title }}</span></td>
            <td><span class="platform-badge" :class="v.platform">{{ v.platform_label }}</span></td>
            <td>{{ formatNumber(v.play_count) }}</td>
            <td>{{ v.interaction_rate ? v.interaction_rate + '%' : '-' }}</td>
            <td>
              <span v-if="v.has_transcript" class="tag-ok">有</span>
              <span v-else class="tag-no">无</span>
            </td>
            <td>
              <span v-if="v.has_analysis" class="tag-ok">已分析</span>
              <span v-else class="tag-no">未分析</span>
            </td>
            <td>{{ formatDate(v.published_at) }}</td>
            <td>
              <div class="row-actions">
                <button class="btn-sm" @click="$router.push(`/viral-videos/${v.id}`)">详情</button>
                <button v-if="!v.has_transcript" class="btn-sm" @click="extractTranscript(v.id)">提取文案</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalCount > 0" class="pagination">
      <span class="page-info">共 {{ totalCount }} 条 第 {{ currentPage }}/{{ totalPages }} 页</span>
      <button class="btn-sm" :disabled="currentPage <= 1" @click="currentPage--; loadData()">上一页</button>
      <button class="btn-sm" :disabled="currentPage >= totalPages" @click="currentPage++; loadData()">下一页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'
import { formatNumber, formatDate } from '@/utils/format'

interface ViralVideo {
  id: number; account_id: string; platform: string; platform_label: string
  title: string; cover_url: string | null; duration: number; play_count: number
  like_count: number; comment_count: number; collect_count: number; share_count: number
  interaction_rate: number | null; has_transcript: boolean; has_analysis: boolean
  published_at: string; collected_at: string
}

const videos = ref<ViralVideo[]>([])
const loading = ref(false)
const platformFilter = ref('all')
const searchKeyword = ref('')
const currentPage = ref(1)
const totalCount = ref(0)
const sortOption = ref('play_count_desc')
const timeRange = ref('all')
const selected = ref<number[]>([])
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const platformTabs = [
  { value: 'all', label: '全部' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'weixin', label: '视频号' },
]

const allSelected = computed(() => videos.value.length > 0 && selected.value.length === videos.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / 20)))

function toggleSelect(id: number): void {
  const idx = selected.value.indexOf(id)
  if (idx === -1) selected.value.push(id)
  else selected.value.splice(idx, 1)
}

function toggleAll(): void {
  if (allSelected.value) selected.value = []
  else selected.value = videos.value.map(v => v.id)
}

function debouncedLoad(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => loadData(true), 300)
}

async function loadData(reset = false): Promise<void> {
  loading.value = true
  try {
    if (reset) currentPage.value = 1
    const params: string[] = []
    if (platformFilter.value !== 'all') params.push(`platform=${platformFilter.value}`)
    if (searchKeyword.value.trim()) params.push(`keyword=${encodeURIComponent(searchKeyword.value.trim())}`)
    params.push(`page=${currentPage.value}`)
    params.push('page_size=20')
    const sortBy = sortOption.value.replace(/_(asc|desc)$/, '')
    const order = sortOption.value.includes('_asc') ? 'asc' : 'desc'
    params.push(`sort_by=${sortBy}`)
    params.push(`order=${order}`)
    if (timeRange.value !== 'all') params.push(`time_range=${timeRange.value}`)
    const query = `?${params.join('&')}`
    const res = await api.get<{ items: ViralVideo[]; total: number }>(`/viral-videos${query}`)
    videos.value = res.items
    totalCount.value = res.total
    selected.value = []
  } catch (e) { console.error(e); toast.error('加载视频列表失败') }
  finally { loading.value = false }
}

async function extractTranscript(id: number): Promise<void> {
  try {
    await api.post(`/viral-videos/${id}/transcript/extract`)
    toast.success('文案提取任务已提交')
  } catch (e) { console.error(e); toast.error('提取失败') }
}

async function analyzeSelected(): Promise<void> {
  try {
    await api.post('/viral-videos/analyze-batch', { ids: selected.value })
    toast.success(`已提交 ${selected.value.length} 个视频分析任务`)
    selected.value = []
  } catch (e) { console.error(e); toast.error('分析失败') }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.viral-page { max-width: 1200px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-bar h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.title-actions { display: flex; gap: 8px; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.filter-bar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.filter-tabs { display: flex; gap: 4px; }
.filter-tab { padding: 6px 16px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 13px; }
.filter-tab.active { background: #4a6cf7; color: #fff; border-color: #4a6cf7; }
.search-input { padding: 7px 14px; border: 1px solid #ddd; border-radius: 20px; font-size: 13px; outline: none; width: 220px; }
.search-input:focus { border-color: #4a6cf7; }
.filter-select { padding: 7px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; outline: none; background: #fff; cursor: pointer; color: #333; }
.filter-select:focus { border-color: #4a6cf7; }
.total-count { margin-left: auto; font-size: 13px; color: #999; }
.video-table-wrap { background: #fff; border-radius: 10px; border: 1px solid #eee; overflow-x: auto; }
.video-table { width: 100%; border-collapse: collapse; min-width: 800px; }
.video-table th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 500; color: #666; background: #fafafa; border-bottom: 1px solid #eee; }
.video-table td { padding: 10px 12px; font-size: 13px; color: #333; border-bottom: 1px solid #f5f5f5; }
.video-table tbody tr:hover { background: #f9fbff; }
.row-selected { background: #e3f2fd !important; }
.cover-thumb { width: 60px; height: 40px; border-radius: 4px; overflow: hidden; background: #f5f5f5; }
.cover-thumb img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 11px; color: #999; }
.video-title { max-width: 200px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.platform-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.platform-badge.xiaohongshu { background: #ffe0e6; color: #e53935; }
.platform-badge.douyin { background: #e8f5e9; color: #2e7d32; }
.platform-badge.weixin { background: #e3f2fd; color: #1565c0; }
.tag-ok { padding: 2px 8px; border-radius: 10px; font-size: 11px; background: #dcfce7; color: #16a34a; }
.tag-no { padding: 2px 8px; border-radius: 10px; font-size: 11px; background: #f5f5f5; color: #999; }
.row-actions { display: flex; gap: 4px; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 16px; }
.page-info { font-size: 13px; color: #999; }
.empty-state, .loading { text-align: center; padding: 60px; color: #999; background: #fff; border-radius: 10px; }
</style>
