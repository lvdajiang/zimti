<template>
  <div class="publish-page">
    <div class="title-bar">
      <h2>发布工作台</h2>
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
        <div class="record-meta">
          <span v-if="r.conversion_type">转化: {{ r.conversion_type }}</span>
          <span>{{ r.published_at ? formatDate(r.published_at) : '未发布' }}</span>
        </div>
        <div class="record-actions">
          <button v-if="r.status === 'unpublished'" class="btn-sm btn-primary" @click="publishRecord(r.id)">发布</button>
          <button class="btn-sm" @click="generateCopy(r.id)">AI 生成文案</button>
          <button class="btn-sm" @click="checkSeo(r.id)">SEO 检查</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'

interface PublishRecord {
  id: string; video_product_id: string; platform: string; conversion_type: string
  title: string | null; description: string | null; tags: string[]
  seo_score: number | null; publish_url: string | null; status: string
  aigc_confirmed: boolean; published_at: string | null; created_at: string; video_title: string
}

const records = ref<PublishRecord[]>([])
const loading = ref(false)
const statusFilter = ref('all')

const statusTabs = [
  { value: 'all', label: '全部' },
  { value: 'unpublished', label: '未发布' },
  { value: 'published', label: '已发布' },
]

const platformLabels: Record<string, string> = { xiaohongshu: '小红书', douyin: '抖音', weixin: '视频号' }
const statusLabels: Record<string, string> = { unpublished: '未发布', published: '已发布', failed: '失败' }

function platformLabel(p: string): string { return platformLabels[p] ?? p }
function statusLabel(s: string): string { return statusLabels[s] ?? s }
function formatDate(iso: string): string { return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }

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
  try { await api.post(`/publish-records/${id}/publish`); await loadData() } catch (e) { console.error(e); alert('发布失败') }
}

async function generateCopy(id: string): Promise<void> {
  try { await api.post(`/publish-records/${id}/generate-copy`, {}); alert('文案生成任务已提交') } catch (e) { console.error(e); toast.error('生成文案失败') }
}

async function checkSeo(id: string): Promise<void> {
  try {
    const res = await api.get<{ score: number; issues: { field: string; message: string; severity: string }[] }>(`/publish-records/${id}/seo-check`)
    alert(`SEO 得分: ${res.score}\n${res.issues.map(i => `[${i.severity}] ${i.field}: ${i.message}`).join('\n')}`)
  } catch (e) { console.error(e); toast.error('SEO检查失败') }
}

onMounted(loadData)
</script>

<style scoped>
.publish-page { max-width: 900px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-bar h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.btn-sm.btn-primary { border: none; color: #fff; }
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
</style>
