<template>
  <div class="assets-page">
    <div class="title-bar">
      <h2>内容资产库</h2>
      <HelpTip title="内容资产库使用指引" :steps="[
        '资产库汇聚所有已创作的视频、脚本、图文内容',
        '支持按状态（草稿/已发布/已归档）、类型、平台、时间筛选',
        '点击资产卡片查看详情，包括数据指标和表现标签',
        '「复用素材」可将已验证的素材快速应用到新项目',
      ]" />
      <button class="btn btn-primary" @click="showCreate = true">+ 新建资产</button>
    </div>

    <div class="filter-bar">
      <div class="filter-tabs">
        <button v-for="tab in statusTabs" :key="tab.value" class="filter-tab" :class="{ active: statusFilter === tab.value }" @click="statusFilter = tab.value; loadData()">
          {{ tab.label }}
        </button>
      </div>
      <div class="filter-tabs">
        <button v-for="tab in typeTabs" :key="tab.value" class="filter-tab" :class="{ active: typeFilter === tab.value }" @click="typeFilter = tab.value; loadData()">
          {{ tab.label }}
        </button>
      </div>
      <div class="filter-tabs">
        <button v-for="tab in platformTabs" :key="tab.value" class="filter-tab" :class="{ active: platformFilter === tab.value }" @click="platformFilter = tab.value; loadData()">
          {{ tab.label }}
        </button>
      </div>
      <div class="filter-tabs">
        <button v-for="tab in timeTabs" :key="tab.value" class="filter-tab" :class="{ active: timeFilter === tab.value }" @click="timeFilter = tab.value; loadData()">
          {{ tab.label }}
        </button>
      </div>
      <input v-model="searchKeyword" class="search-input" placeholder="搜索标题..." @input="debouncedLoad" />
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="assets.length === 0" class="empty-state"><p>暂无内容资产</p></div>
    <div v-else class="asset-grid">
      <div v-for="asset in assets" :key="asset.id" class="asset-card" @click="openDetail(asset)">
        <div class="card-top">
          <span class="type-badge" :class="asset.type">{{ asset.type_label }}</span>
          <span class="status-badge" :class="asset.status">{{ asset.status_label }}</span>
        </div>
        <h4 class="card-title">{{ asset.title }}</h4>
        <div class="card-platforms">
          <span v-for="pl in asset.platform_labels" :key="pl" class="platform-tag">{{ pl }}</span>
        </div>
        <div v-if="asset.performance_tags.length > 0" class="card-perf-tags">
          <span v-for="tag in asset.performance_tags" :key="tag" class="perf-tag">{{ perfLabel(tag) }}</span>
        </div>
        <div class="card-meta">
          <span>{{ asset.custom_tags.length }} 标签</span>
          <span>{{ formatDate(asset.created_at) }}</span>
        </div>
        <div class="card-actions">
          <button class="btn-sm" @click.stop="reuseMaterials(asset)">复用素材</button>
          <button class="btn-sm" @click.stop="reuseScript(asset)">复用脚本</button>
          <button v-if="asset.status === 'draft'" class="btn-sm btn-danger" @click.stop="deleteAsset(asset)">删除</button>
        </div>
      </div>
    </div>

    <!-- 新建资产弹窗 -->
    <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>新建内容资产</h3>
          <button class="dialog-close" @click="showCreate = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>标题 <span class="required">*</span></label>
            <input v-model="createForm.title" placeholder="请输入标题" />
          </div>
          <div class="form-field">
            <label>类型 <span class="required">*</span></label>
            <select v-model="createForm.type">
              <option value="video">视频</option>
              <option value="script">脚本</option>
              <option value="image_text">图文</option>
            </select>
          </div>
          <div class="form-field">
            <label>发布平台</label>
            <div class="platform-checks">
              <label v-for="pl in platformOptions" :key="pl.value" class="check-label">
                <input type="checkbox" :value="pl.value" v-model="createForm.platforms" />
                {{ pl.label }}
              </label>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="createAsset">创建</button>
            <button class="btn" @click="showCreate = false">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detailAsset" class="overlay" @click.self="detailAsset = null">
      <div class="dialog dialog-lg">
        <div class="dialog-header">
          <h3>{{ detailAsset.title }}</h3>
          <button class="dialog-close" @click="detailAsset = null">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="detail-row">
            <span class="detail-label">类型</span>
            <span :class="'type-badge ' + detailAsset.type">{{ detailAsset.type_label }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">状态</span>
            <span :class="'status-badge ' + detailAsset.status">{{ detailAsset.status_label }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">平台</span>
            <span v-for="pl in detailAsset.platform_labels" :key="pl" class="platform-tag">{{ pl }}</span>
            <span v-if="detailAsset.platform_labels.length === 0">未设置</span>
          </div>
          <div class="detail-section metrics-section" v-if="detailAsset.core_metrics && (detailAsset.core_metrics.play_count || detailAsset.core_metrics.interaction_rate)">
            <span class="detail-label">数据指标</span>
            <div class="metrics-grid">
              <div v-if="detailAsset.core_metrics.play_count" class="metric-item">
                <span class="metric-value">{{ formatNumber(detailAsset.core_metrics.play_count) }}</span>
                <span class="metric-label">播放量</span>
              </div>
              <div v-if="detailAsset.core_metrics.interaction_rate" class="metric-item">
                <span class="metric-value">{{ detailAsset.core_metrics.interaction_rate }}%</span>
                <span class="metric-label">互动率</span>
              </div>
              <div v-if="detailAsset.core_metrics.completion_rate" class="metric-item">
                <span class="metric-value">{{ detailAsset.core_metrics.completion_rate }}%</span>
                <span class="metric-label">完播率</span>
              </div>
            </div>
          </div>
          <div v-if="detailAsset.element_highlights.length > 0" class="detail-section">
            <span class="detail-label">亮点元素</span>
            <div class="highlight-list">
              <span v-for="h in detailAsset.element_highlights" :key="h" class="highlight-tag">{{ h }}</span>
            </div>
          </div>
          <div v-if="detailAsset.custom_tags.length > 0" class="detail-section">
            <span class="detail-label">自定义标签</span>
            <div class="highlight-list">
              <span v-for="t in detailAsset.custom_tags" :key="t" class="custom-tag-sm">{{ t }}</span>
            </div>
          </div>
          <div v-if="detailAsset.performance_tags.length > 0" class="detail-section">
            <span class="detail-label">表现标签</span>
            <div class="highlight-list">
              <span v-for="tag in detailAsset.performance_tags" :key="tag" class="perf-tag">{{ perfLabel(tag) }}</span>
            </div>
          </div>
          <div class="detail-row">
            <span class="detail-label">创建时间</span>
            <span>{{ detailAsset.created_at }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import HelpTip from '@/components/HelpTip.vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'
import { formatNumber, formatDate } from '@/utils/format'

interface ContentAsset {
  id: string; title: string; type: string; type_label: string; video_product_id: string | null
  platforms: string[]; platform_labels: string[]; status: string; status_label: string
  core_metrics: Record<string, number>; element_highlights: string[]; custom_tags: string[]
  performance_tags: string[]; published_at: string | null; archived_at: string | null
  created_at: string; updated_at: string
}

const assets = ref<ContentAsset[]>([])
const loading = ref(false)
const statusFilter = ref('all')
const typeFilter = ref('all')
const platformFilter = ref('all')
const timeFilter = ref('all')
const searchKeyword = ref('')
const showCreate = ref(false)
const detailAsset = ref<ContentAsset | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const createForm = reactive({
  title: '',
  type: 'video' as string,
  platforms: [] as string[],
})

const statusTabs = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
]

const typeTabs = [
  { value: 'all', label: '全部类型' },
  { value: 'video', label: '视频' },
  { value: 'script', label: '脚本' },
  { value: 'image_text', label: '图文' },
]

const platformTabs = [
  { value: 'all', label: '全部平台' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'weixin', label: '视频号' },
  { value: 'wechat', label: '微信' },
]

const timeTabs = [
  { value: 'all', label: '全部时间' },
  { value: 'recent_7d', label: '近7天' },
  { value: 'recent_30d', label: '近30天' },
]

const platformOptions = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'weixin', label: '视频号' },
]

const perfLabels: Record<string, string> = {
  high_completion: '高完播', high_interaction: '高互动', high_conversion: '高转化',
}

function perfLabel(tag: string): string { return perfLabels[tag] ?? tag }

function debouncedLoad(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadData, 300)
}

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const params: string[] = []
    if (statusFilter.value !== 'all') params.push(`status=${statusFilter.value}`)
    if (typeFilter.value !== 'all') params.push(`type=${typeFilter.value}`)
    if (platformFilter.value !== 'all') params.push(`platform=${platformFilter.value}`)
    if (timeFilter.value !== 'all') params.push(`time_filter=${timeFilter.value}`)
    if (searchKeyword.value) params.push(`keyword=${encodeURIComponent(searchKeyword.value)}`)
    const query = params.length ? `?${params.join('&')}` : ''
    const res = await api.get<{ items: ContentAsset[]; total: number }>(`/content-assets${query}`)
    assets.value = res.items
  } catch (e) { console.error(e); toast.error('加载资产列表失败') }
  finally { loading.value = false }
}

async function createAsset(): Promise<void> {
  if (!createForm.title) { toast.warning('请输入标题'); return }
  try {
    await api.post('/content-assets/auto-create', createForm)
    showCreate.value = false
    createForm.title = ''
    createForm.type = 'video'
    createForm.platforms = []
    await loadData()
  } catch (e) { console.error(e); toast.error('创建失败') }
}

function openDetail(asset: ContentAsset): void { detailAsset.value = asset }

async function reuseMaterials(asset: ContentAsset): Promise<void> {
  if (!confirm(`确认复用「${asset.title}」的素材？`)) return
  try {
    const materialIds = (asset as any).video_product?.materials?.map((m: any) => m.id) ?? []
    if (materialIds.length === 0) { toast.warning('该资产无可用素材'); return }
    await api.post(`/content-assets/${asset.id}/reuse-materials`, { material_ids: materialIds })
    toast.success('素材复用成功')
    await loadData()
  } catch (e) { console.error(e); toast.error('素材复用失败') }
}

async function reuseScript(asset: ContentAsset): Promise<void> {
  if (!confirm(`确认复用「${asset.title}」的脚本结构？`)) return
  try {
    const taskId = (asset as any).video_product?.taskId
    const topicId = (asset as any).video_product?.topicId
    if (!taskId || !topicId) { toast.warning('该资产无关联任务/选题'); return }
    await api.post(`/content-assets/${asset.id}/reuse-script`, { target_task_id: taskId, target_topic_id: topicId })
    toast.success('脚本复用成功')
    await loadData()
  } catch (e) { console.error(e); toast.error('脚本复用失败') }
}

async function deleteAsset(asset: ContentAsset): Promise<void> {
  if (!confirm(`确定要删除「${asset.title}」吗？`)) return
  try {
    await api.delete(`/content-assets/${asset.id}`)
    await loadData()
  } catch (e) { console.error(e); toast.error('删除失败') }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.assets-page { max-width: 1100px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); }
.title-bar h2 { margin: 0; font-size: var(--font-size-xl); color: var(--color-text); }
.btn { padding: var(--space-2) var(--space-5); border-radius: var(--radius); border: none; cursor: pointer; font-size: var(--font-size-base); font-weight: 500; }
.btn-primary { background: var(--color-primary); color: var(--color-bg); }
.btn-sm { padding: var(--space-1) var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-border); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-xs); }
.btn-sm.btn-danger { border-color: #ffcdd2; color: var(--color-danger); }
.filter-bar { display: flex; gap: var(--space-3); align-items: center; margin-bottom: var(--space-5); flex-wrap: wrap; }
.filter-tabs { display: flex; gap: var(--space-1); }
.filter-tab { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: 20px; background: var(--color-bg); cursor: pointer; font-size: var(--font-size-sm); }
.filter-tab.active { background: var(--color-primary); color: var(--color-bg); border-color: var(--color-primary); }
.search-input { padding: 7px 14px; border: 1px solid var(--color-border); border-radius: 20px; font-size: var(--font-size-sm); outline: none; width: 200px; }
.search-input:focus { border-color: var(--color-primary); }
.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }
.asset-card { background: var(--color-bg); border: 1px solid var(--color-border-light); border-radius: var(--radius-xl); padding: var(--space-4); cursor: pointer; transition: box-shadow var(--transition); }
.asset-card:hover { box-shadow: var(--shadow); }
.card-top { display: flex; justify-content: space-between; margin-bottom: var(--space-2); }
.type-badge { padding: 2px var(--space-2); border-radius: 10px; font-size: var(--font-size-xs); }
.type-badge.video { background: #e0e7ff; color: #4338ca; }
.type-badge.script { background: #dcfce7; color: #16a34a; }
.type-badge.image_text { background: #fef3c7; color: var(--color-warning); }
.status-badge { padding: 2px var(--space-2); border-radius: 10px; font-size: var(--font-size-xs); }
.status-badge.draft { background: var(--color-bg-secondary); color: var(--color-text-tertiary); }
.status-badge.published { background: #dcfce7; color: var(--color-success); }
.status-badge.archived { background: var(--color-bg-secondary); color: var(--color-text-secondary); }
.card-title { margin: 0 0 var(--space-2); font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); }
.card-platforms { display: flex; gap: var(--space-1); flex-wrap: wrap; margin-bottom: var(--space-2); }
.platform-tag { padding: 1px 6px; border-radius: var(--radius); font-size: var(--font-size-xs); background: #f0f4ff; color: var(--color-primary); }
.card-perf-tags { display: flex; gap: var(--space-1); margin-bottom: var(--space-2); }
.perf-tag { padding: 1px 6px; border-radius: var(--radius); font-size: var(--font-size-xs); background: #f3e8ff; color: #7c3aed; }
.card-meta { display: flex; justify-content: space-between; font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-3); }
.card-actions { display: flex; gap: 6px; padding-top: var(--space-3); border-top: 1px solid var(--color-border-light); }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: var(--color-bg); border-radius: var(--radius-lg); width: 480px; }
.dialog-lg { width: 560px; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border-light); }
.dialog-header h3 { margin: 0; font-size: var(--font-size-lg); }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-tertiary); }
.dialog-body { padding: var(--space-5); }
.form-field { margin-bottom: var(--space-4); }
.form-field label { display: block; margin-bottom: 6px; font-size: var(--font-size-sm); color: var(--color-text-secondary); font-weight: 500; }
.required { color: var(--color-danger); }
.form-field input, .form-field select { width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius); font-size: var(--font-size-base); box-sizing: border-box; }
.form-field input:focus, .form-field select:focus { outline: none; border-color: var(--color-primary); }
.platform-checks { display: flex; gap: var(--space-4); }
.check-label { display: flex; align-items: center; gap: var(--space-1); font-size: var(--font-size-sm); cursor: pointer; }
.form-actions { display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: var(--space-2); }
.detail-row { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
.detail-label { font-size: var(--font-size-sm); color: var(--color-text-tertiary); min-width: 80px; }
.detail-section { margin-bottom: var(--space-4); }
.highlight-list { display: flex; gap: var(--space-1); flex-wrap: wrap; margin-top: var(--space-1); }
.highlight-tag { padding: 2px var(--space-2); border-radius: var(--radius); font-size: var(--font-size-xs); background: #e0f2fe; color: #0369a1; }
.custom-tag-sm { padding: 2px var(--space-2); border-radius: var(--radius); font-size: var(--font-size-xs); background: var(--color-bg-secondary); color: var(--color-text-secondary); }
.metrics-section { margin-bottom: var(--space-4); }
.metrics-grid { display: flex; gap: var(--space-5); margin-top: var(--space-2); }
.metric-item { display: flex; flex-direction: column; gap: 2px; padding: 10px var(--space-4); background: #f8f9fc; border-radius: var(--radius); }
.metric-item .metric-value { font-size: 18px; font-weight: 700; color: var(--color-text); }
.metric-item .metric-label { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.empty-state, .loading { text-align: center; padding: 60px; color: var(--color-text-tertiary); background: var(--color-bg); border-radius: var(--radius-xl); }
</style>
