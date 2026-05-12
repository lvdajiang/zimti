<template>
  <div class="publish-page">
    <div class="title-bar">
      <h2>发布工作台</h2>
      <span v-if="autoSaveHint" class="auto-save-hint">{{ autoSaveHint }}</span>
    </div>
    <div class="filter-bar">
      <div class="filter-tabs">
        <button v-for="tab in statusTabs" :key="tab.value" class="filter-tab" :class="{ active: statusFilter === tab.value }" @click="statusFilter = tab.value; loadData()">
          {{ tab.label }}
        </button>
      </div>
    </div>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="records.length === 0" class="empty-state"><p>暂无发布记录</p></div>
    <div v-else class="record-list">
      <div v-for="r in records" :key="r.id" class="record-card">
        <div class="record-header">
          <span class="platform-badge" :class="r.platform">{{ platformLabel(r.platform) }}</span>
          <span class="status-sm" :class="r.status">{{ statusLabel(r.status) }}</span>
          <span v-if="r.seo_score" class="seo-badge">SEO {{ r.seo_score }}</span>
        </div>
        <h4 class="record-title">{{ r.title || r.video_title || '未命名' }}</h4>
        <p v-if="r.description" class="record-desc">{{ r.description }}</p>
        <div v-if="r.tags.length > 0" class="record-tags">
          <span v-for="tag in r.tags" :key="tag" class="tag">#{{ tag }}</span>
        </div>
        <!-- 转化目标选择 -->
        <div class="conversion-row">
          <label class="conversion-label">转化目标:</label>
          <select class="conversion-select" :value="r.conversion_type" @change="updateConversionType(r.id, ($event.target as HTMLSelectElement).value)">
            <option value="">请选择</option>
            <option value="cognitive">认知型</option>
            <option value="trust">信任型</option>
            <option value="conversion">转化型</option>
          </select>
          <span v-if="r.conversion_type" class="conversion-tag">{{ conversionLabel(r.conversion_type) }}</span>
        </div>
        <!-- AIGC 确认勾选 -->
        <div class="aigc-row">
          <label class="aigc-check">
            <input type="checkbox" :checked="aigcChecked[r.id] ?? r.aigc_confirmed" @change="toggleAigc(r.id)" />
            <span>我确认此内容由 AI 辅助生成，已人工审核</span>
          </label>
        </div>
        <!-- SEO 检查结果面板 -->
        <div v-if="seoResults[r.id]" class="seo-panel">
          <div class="seo-panel-header">SEO 检查结果 ({{ seoResults[r.id].score }}分)</div>
          <ul class="seo-issues">
            <li v-for="(issue, idx) in seoResults[r.id].issues" :key="idx" class="seo-issue" :class="issue.severity">
              <span class="severity-icon">{{ severityIcon(issue.severity) }}</span>
              <span class="issue-field">[{{ issue.field }}]</span>
              <span class="issue-msg">{{ issue.message }}</span>
            </li>
          </ul>
        </div>
        <div class="record-meta">
          <span>{{ r.published_at ? formatDate(r.published_at) : '未发布' }}</span>
        </div>
        <div class="record-actions">
          <button v-if="r.status === 'unpublished'" class="btn-sm btn-primary" :disabled="!isPublishable(r)" @click="publishRecord(r.id)">发布</button>
          <button class="btn-sm" @click="generateCopy(r.id)">AI 生成文案</button>
          <button class="btn-sm" @click="checkSeo(r.id)">SEO 检查</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'
import { formatDate, platformLabel } from '@/utils/format'

interface SeoIssue { field: string; message: string; severity: string }
interface SeoResult { score: number; issues: SeoIssue[] }

interface PublishRecord {
  id: string; video_product_id: string; platform: string; conversion_type: string
  title: string | null; description: string | null; tags: string[]
  seo_score: number | null; publish_url: string | null; status: string
  aigc_confirmed: boolean; published_at: string | null; created_at: string; video_title: string
}

const records = ref<PublishRecord[]>([])
const loading = ref(false)
const statusFilter = ref('all')
const aigcChecked = reactive<Record<string, boolean>>({})
const seoResults = reactive<Record<string, SeoResult>>({})
const autoSaveHint = ref('')
let autoSaveTimer: ReturnType<typeof setInterval> | null = null

const conversionLabels: Record<string, string> = { cognitive: '认知型', trust: '信任型', conversion: '转化型' }

const statusTabs = [
  { value: 'all', label: '全部' },
  { value: 'unpublished', label: '未发布' },
  { value: 'published', label: '已发布' },
]

const statusLabels: Record<string, string> = { unpublished: '未发布', published: '已发布', failed: '失败' }

function statusLabel(s: string): string { return statusLabels[s] ?? s }
function conversionLabel(t: string): string { return conversionLabels[t] ?? t }
function severityIcon(s: string): string { return s === 'warning' ? '⚠' : s === 'error' ? '✕' : 'ℹ' }
function isPublishable(r: PublishRecord): boolean { return aigcChecked[r.id] === true }

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const params: string[] = []
    if (statusFilter.value !== 'all') params.push(`status=${statusFilter.value}`)
    const query = params.length ? `?${params.join('&')}` : ''
    const res = await api.get<{ items: PublishRecord[]; total: number }>(`/publish-records${query}`)
    records.value = res.items
  } catch (e) { console.error(e); toast.error('加载发布记录失败') }
  finally { loading.value = false }
}

async function publishRecord(id: string): Promise<void> {
  if (!aigcChecked[id]) { toast.error('请先勾选 AIGC 确认'); return }
  try {
    await api.post(`/publish-records/${id}/publish`)
    await loadData()
  } catch (e) { console.error(e); toast.error('发布失败') }
}

async function generateCopy(id: string): Promise<void> {
  try { await api.post(`/publish-records/${id}/generate-copy`, {}); toast.success('文案生成任务已提交') } catch (e) { console.error(e); toast.error('生成文案失败') }
}

async function checkSeo(id: string): Promise<void> {
  try {
    const res = await api.post<SeoResult>(`/publish-records/${id}/seo-check`, {})
    seoResults[id] = res
    toast.info(`SEO 得分: ${res.score}，${res.issues.length} 个问题`)
  } catch (e) { console.error(e); toast.error('SEO检查失败') }
}

async function toggleAigc(id: string): Promise<void> {
  const newVal = !aigcChecked[id]
  aigcChecked[id] = newVal
  if (newVal) {
    try { await api.post(`/publish-records/${id}/aigc-confirm`, {}) } catch (e) { console.error(e); toast.error('AIGC确认失败') }
  }
}

async function updateConversionType(id: string, type: string): Promise<void> {
  try { await api.put(`/publish-records/${id}/conversion-type`, { conversion_type: type }); await loadData() } catch (e) { console.error(e); toast.error('更新转化目标失败') }
}

async function autoSave(): Promise<void> {
  for (const r of records.value) {
    if (r.status !== 'published' && r.id) {
      try {
        await api.post(`/publish-records/${r.id}/auto-save`, { title: r.title, description: r.description, tags: r.tags })
      } catch (e) { console.error(e); toast.error(`自动保存失败: ${r.title}`) }
    }
  }
  autoSaveHint.value = '已自动保存'
  setTimeout(() => { autoSaveHint.value = '' }, 3000)
}

onMounted(() => {
  loadData()
  autoSaveTimer = setInterval(autoSave, 5000)
})

onUnmounted(() => {
  if (autoSaveTimer) clearInterval(autoSaveTimer)
})
</script>

<style scoped>
.publish-page { max-width: 900px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-bar h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.auto-save-hint { font-size: 12px; color: #16a34a; background: #dcfce7; padding: 2px 10px; border-radius: 10px; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.btn-sm.btn-primary { border: none; color: #fff; }
.btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }
.filter-bar { margin-bottom: 16px; }
.filter-tabs { display: flex; gap: 4px; }
.filter-tab { padding: 6px 16px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 13px; }
.filter-tab.active { background: #4a6cf7; color: #fff; border-color: #4a6cf7; }
.record-list { display: flex; flex-direction: column; gap: 12px; }
.record-card { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 16px; }
.record-header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.platform-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.platform-badge.xiaohongshu { background: #ffe0e6; color: #e53935; }
.platform-badge.douyin { background: #e8f5e9; color: #2e7d32; }
.platform-badge.weixin { background: #e3f2fd; color: #1565c0; }
.status-sm { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.status-sm.unpublished { background: #f5f5f5; color: #999; }
.status-sm.published { background: #dcfce7; color: #16a34a; }
.seo-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; background: #f0f4ff; color: #4a6cf7; }
.record-title { margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #333; }
.record-desc { margin: 0 0 8px; font-size: 13px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.record-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
.tag { font-size: 12px; color: #4a6cf7; }
.record-meta { display: flex; gap: 16px; font-size: 12px; color: #999; margin-bottom: 12px; }
.record-actions { display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid #f0f0f0; }
.empty-state, .loading { text-align: center; padding: 60px; color: #999; background: #fff; border-radius: 10px; }
/* 转化目标 */
.conversion-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.conversion-label { font-size: 12px; color: #999; }
.conversion-select { padding: 2px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; background: #fff; }
.conversion-tag { font-size: 11px; padding: 1px 6px; border-radius: 8px; background: #f0f4ff; color: #4a6cf7; }
/* AIGC 确认 */
.aigc-row { margin-bottom: 8px; }
.aigc-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #666; cursor: pointer; }
.aigc-check input[type="checkbox"] { accent-color: #4a6cf7; }
/* SEO 面板 */
.seo-panel { margin-bottom: 12px; border: 1px solid #f0f4ff; border-radius: 8px; padding: 10px 12px; background: #fafbff; }
.seo-panel-header { font-size: 12px; font-weight: 600; color: #4a6cf7; margin-bottom: 6px; }
.seo-issues { margin: 0; padding-left: 18px; }
.seo-issue { font-size: 12px; color: #555; line-height: 1.8; }
.seo-issue .severity-icon { margin-right: 4px; }
.seo-issue .issue-field { color: #999; margin-right: 4px; }
.seo-issue.warning { color: #b45309; }
.seo-issue.error { color: #dc2626; }
.seo-issue.info { color: #2563eb; }
</style>
