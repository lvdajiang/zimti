<template>
  <div class="hotspots-page">
    <div class="title-bar">
      <h2>热点追踪</h2>
      <div class="title-actions">
        <button class="btn btn-sm" @click="refreshHotspots" :disabled="refreshing">{{ refreshing ? '刷新中...' : '刷新热点' }}</button>
        <button class="btn btn-primary" @click="showCreate = true">+ 手动添加</button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-tabs">
        <button v-for="tab in platformTabs" :key="tab.value" class="filter-tab" :class="{ active: platformFilter === tab.value }" @click="platformFilter = tab.value; loadData()">
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="hotspots.length === 0" class="empty-state"><p>暂无热点数据，点击刷新获取最新热点</p></div>
    <div v-else class="hotspot-list">
      <div v-for="h in hotspots" :key="h.id" class="hotspot-card" :class="{ expired: h.is_expired }">
        <div class="hotspot-header">
          <span class="platform-badge" :class="h.source_platform">{{ h.source_platform_label }}</span>
          <span v-if="h.is_expired" class="expired-badge">已过期</span>
          <span v-else-if="h.valid_until" class="valid-badge">有效至 {{ formatDate(h.valid_until) }}</span>
          <button class="btn-sm" @click="expireHotspot(h.id)" :disabled="h.is_expired">标记过期</button>
        </div>
        <h4 class="hotspot-title">{{ h.title }}</h4>
        <div class="hotspot-meta">
          <span>来源: {{ h.source }}</span>
          <span>相关度: {{ (h.relevance_score * 100).toFixed(0) }}%</span>
          <span>{{ formatDate(h.created_at) }}</span>
        </div>
        <a v-if="h.source_url" :href="h.source_url" target="_blank" class="source-link">查看原文 &rarr;</a>
      </div>
    </div>

    <!-- 手动添加弹窗 -->
    <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>添加热点</h3>
          <button class="dialog-close" @click="showCreate = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>热点标题 <span class="required">*</span></label>
            <input v-model="createForm.title" placeholder="请输入热点标题" />
          </div>
          <div class="form-field">
            <label>来源平台 <span class="required">*</span></label>
            <select v-model="createForm.source_platform">
              <option value="xiaohongshu">小红书</option>
              <option value="douyin">抖音</option>
              <option value="weibo">微博</option>
              <option value="weixin">视频号</option>
            </select>
          </div>
          <div class="form-field">
            <label>来源 <span class="required">*</span></label>
            <input v-model="createForm.source" placeholder="来源名称" />
          </div>
          <div class="form-field">
            <label>来源链接</label>
            <input v-model="createForm.source_url" placeholder="https://..." />
          </div>
          <div class="form-field">
            <label>有效截止时间</label>
            <input v-model="createForm.valid_until" type="datetime-local" />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="createHotspot">添加</button>
            <button class="btn" @click="showCreate = false">取消</button>
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

interface Hotspot {
  id: number; title: string; source_platform: string; source_platform_label: string
  source: string; source_url: string | null; relevance_score: number
  valid_until: string | null; is_expired: boolean; created_at: string
}

const hotspots = ref<Hotspot[]>([])
const loading = ref(false)
const refreshing = ref(false)
const platformFilter = ref('all')
const showCreate = ref(false)
const createForm = reactive({ title: '', source_platform: 'xiaohongshu', source: '', source_url: '', valid_until: '' })

const platformTabs = [
  { value: 'all', label: '全部' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'weibo', label: '微博' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const params: string[] = []
    if (platformFilter.value !== 'all') params.push(`platform=${platformFilter.value}`)
    const query = params.length ? `?${params.join('&')}` : ''
    const res = await api.get<{ items: Hotspot[]; total: number }>(`/hotspots${query}`)
    hotspots.value = res.items
  } catch (e) { console.error(e); toast.error('加载列表失败') }
  finally { loading.value = false }
}

async function refreshHotspots(): Promise<void> {
  refreshing.value = true
  try {
    await api.post('/hotspots/refresh')
    await loadData()
  } catch (e) { console.error(e); toast.error('刷新热点失败') }
  finally { refreshing.value = false }
}

async function createHotspot(): Promise<void> {
  if (!createForm.title || !createForm.source) { alert('请填写标题和来源'); return }
  try {
    await api.post('/hotspots', {
      title: createForm.title,
      source_platform: createForm.source_platform,
      source: createForm.source,
      source_url: createForm.source_url || null,
      valid_until: createForm.valid_until || null,
    })
    showCreate.value = false
    createForm.title = ''; createForm.source = ''; createForm.source_url = ''; createForm.valid_until = ''
    await loadData()
  } catch (e) { console.error(e); alert('添加失败') }
}

async function expireHotspot(id: number): Promise<void> {
  try {
    await api.post(`/hotspots/${id}/expire`)
    await loadData()
  } catch (e) { console.error(e); toast.error('标记过期失败') }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.hotspots-page { max-width: 900px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-bar h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.title-actions { display: flex; gap: 8px; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.filter-bar { margin-bottom: 16px; }
.filter-tabs { display: flex; gap: 4px; }
.filter-tab { padding: 6px 16px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 13px; }
.filter-tab.active { background: #4a6cf7; color: #fff; border-color: #4a6cf7; }
.hotspot-list { display: flex; flex-direction: column; gap: 8px; }
.hotspot-card { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 16px; }
.hotspot-card.expired { opacity: 0.5; }
.hotspot-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.platform-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.platform-badge.xiaohongshu { background: #ffe0e6; color: #e53935; }
.platform-badge.douyin { background: #e8f5e9; color: #2e7d32; }
.platform-badge.weibo { background: #fff3e0; color: #e65100; }
.platform-badge.weixin { background: #e3f2fd; color: #1565c0; }
.expired-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; background: #f5f5f5; color: #999; }
.valid-badge { font-size: 11px; color: #16a34a; }
.hotspot-title { margin: 0 0 6px; font-size: 15px; font-weight: 600; color: #333; }
.hotspot-meta { display: flex; gap: 16px; font-size: 12px; color: #999; margin-bottom: 4px; }
.source-link { font-size: 12px; color: #4a6cf7; text-decoration: none; }
.source-link:hover { text-decoration: underline; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #fff; border-radius: 12px; width: 480px; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.dialog-body { padding: 20px; }
.form-field { margin-bottom: 16px; }
.form-field label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; font-weight: 500; }
.required { color: #e53935; }
.form-field input, .form-field select { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.form-field input:focus, .form-field select:focus { outline: none; border-color: #4a6cf7; }
.form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
.empty-state, .loading { text-align: center; padding: 60px; color: #999; background: #fff; border-radius: 10px; }
</style>
