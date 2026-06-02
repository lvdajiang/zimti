<template>
  <div class="hotspots-page">
    <div class="back-nav">
      <RouterLink to="/topic-workbench" class="back-link">← 返回</RouterLink>
    </div>
    <div class="title-bar">
      <h2>热点追踪</h2>
      <HelpTip title="热点追踪使用指引" :steps="[
        '点击「刷新热点」从各平台抓取最新热门话题',
        '每个热点显示热度趋势和关联平台，可按平台筛选',
        '点击「转为选题」将热点导入选题工作台开始创作',
        '「手动添加」可录入自己发现的热点话题',
      ]" />
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
      <div class="filter-selects">
        <select v-model="timeRange" @change="loadData()" class="filter-select">
          <option value="">全部时间</option>
          <option value="today">今天</option>
          <option value="week">本周</option>
          <option value="month">本月</option>
        </select>
        <select v-model="sortBy" @change="loadData()" class="filter-select">
          <option value="heat_value_desc">热度降序</option>
          <option value="heat_value_asc">热度升序</option>
          <option value="relevance_score_desc">相关度降序</option>
          <option value="created_at_desc">最新发布</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="hotspots.length === 0" class="empty-state"><p>暂无热点数据，点击刷新获取最新热点</p></div>
    <div v-else class="hotspot-list">
      <div v-for="h in hotspots" :key="h.id" class="hotspot-card" :class="{ expired: h.is_expired }">
        <div class="hotspot-header">
          <span class="platform-badge" :class="h.source_platform">{{ h.source_platform_label }}</span>
          <span class="heat-value" :class="h.heat_trend">{{ formatHeat(h.heat_value) }} <span class="trend-icon">{{ trendIcon(h.heat_trend) }}</span></span>
          <span class="usage-badge" :class="h.usage_status">{{ usageLabel(h.usage_status) }}</span>
          <span v-if="h.is_expired" class="expired-badge">已过期</span>
          <span v-else-if="h.valid_until" class="valid-badge">有效至 {{ formatDate(h.valid_until, true) }}</span>
          <div class="hotspot-actions">
            <button class="btn-sm" @click="openEdit(h)">编辑</button>
            <button class="btn-sm" @click="expireHotspot(h.id)" :disabled="h.is_expired">标记过期</button>
          </div>
        </div>
        <h4 class="hotspot-title">{{ h.title }}</h4>
        <div class="hotspot-meta">
          <span>来源: {{ h.source }}</span>
          <span>相关度: {{ (h.relevance_score * 100).toFixed(0) }}%</span>
          <span>{{ formatDate(h.created_at, true) }}</span>
        </div>
        <div v-if="h.keywords && h.keywords.length" class="keyword-tags">
          <span v-for="kw in h.keywords" :key="kw" class="keyword-tag">{{ kw }}</span>
        </div>
        <a v-if="h.source_url" :href="h.source_url" target="_blank" class="source-link">查看原文 &rarr;</a>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > 0" class="pagination">
      <span class="pagination-info">共 {{ total }} 条 第 {{ currentPage }}/{{ totalPages }} 页</span>
      <div class="pagination-btns">
        <button class="btn-sm" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">上一页</button>
        <button class="btn-sm" :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">下一页</button>
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
          <div class="form-field">
            <label>关键词（逗号分隔）</label>
            <input v-model="createForm.keywords" placeholder="关键词1,关键词2" />
          </div>
          <div class="form-field">
            <label>备注</label>
            <textarea v-model="createForm.note" placeholder="备注信息" rows="2" class="form-textarea"></textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="createHotspot">添加</button>
            <button class="btn" @click="showCreate = false">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="showEdit" class="overlay" @click.self="showEdit = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>编辑热点</h3>
          <button class="dialog-close" @click="showEdit = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>使用状态</label>
            <select v-model="editForm.usage_status">
              <option value="unused">未使用</option>
              <option value="used">已使用</option>
              <option value="expired">已过期</option>
            </select>
          </div>
          <div class="form-field">
            <label>关键词（逗号分隔）</label>
            <input v-model="editForm.keywords" placeholder="关键词1,关键词2" />
          </div>
          <div class="form-field">
            <label>备注</label>
            <textarea v-model="editForm.note" placeholder="备注信息" rows="3" class="form-textarea"></textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="updateHotspot">保存</button>
            <button class="btn" @click="showEdit = false">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import HelpTip from '@/components/HelpTip.vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'
import { formatDate } from '@/utils/format'

interface Hotspot {
  id: number; title: string; source_platform: string; source_platform_label: string
  source: string; source_url: string | null; relevance_score: number
  valid_until: string | null; is_expired: boolean; created_at: string
  heat_value: number; heat_trend: string; keywords: string[]; usage_status: string; note: string | null
}

const hotspots = ref<Hotspot[]>([])
const loading = ref(false)
const refreshing = ref(false)
const platformFilter = ref('all')
const timeRange = ref('')
const sortBy = ref('heat_value_desc')
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20
const showCreate = ref(false)
const showEdit = ref(false)
const editForm = reactive({ id: 0, note: '', usage_status: 'unused', keywords: '' })
const createForm = reactive({ title: '', source_platform: 'xiaohongshu', source: '', source_url: '', valid_until: '', keywords: '', note: '' })

const platformTabs = [
  { value: 'all', label: '全部' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'weibo', label: '微博' },
]

// 格式化热度值：>=10000 显示 "X.X万"，>1000000 显示 "100万+"，否则直接显示
function formatHeat(n: number): string {
  if (n >= 1000000) return '100万+'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

// 热度趋势图标
function trendIcon(trend: string): string {
  if (trend === 'up') return '↑'
  if (trend === 'down') return '↓'
  return '—'
}

// 使用状态标签
function usageLabel(status: string): string {
  const map: Record<string, string> = { unused: '未使用', used: '已使用', expired: '已过期' }
  return map[status] || status
}

// 总页数
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

// 跳转页码
function goPage(p: number): void {
  currentPage.value = p
  loadData()
}

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const params: string[] = []
    if (platformFilter.value !== 'all') params.push(`platform=${platformFilter.value}`)
    if (timeRange.value) params.push(`time_range=${timeRange.value}`)
    // 解析排序字段和方向（取最后一个下划线后为 asc/desc）
    const lastUnderscore = sortBy.value.lastIndexOf('_')
    const sortField = sortBy.value.substring(0, lastUnderscore)
    const sortOrder = sortBy.value.substring(lastUnderscore + 1)
    params.push(`sort_by=${sortField}`, `order=${sortOrder}`)
    params.push(`page=${currentPage.value}`, `page_size=${pageSize}`)
    const query = `?${params.join('&')}`
    const res = await api.get<{ items: Hotspot[]; total: number }>(`/hotspots${query}`)
    hotspots.value = res.items
    total.value = res.total
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
  if (!createForm.title || !createForm.source) { toast.error('请填写标题和来源'); return }
  try {
    await api.post('/hotspots', {
      title: createForm.title,
      source_platform: createForm.source_platform,
      source: createForm.source,
      source_url: createForm.source_url || null,
      valid_until: createForm.valid_until || null,
      keywords: createForm.keywords ? createForm.keywords.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
      note: createForm.note || null,
    })
    showCreate.value = false
    createForm.title = ''; createForm.source = ''; createForm.source_url = ''; createForm.valid_until = ''; createForm.keywords = ''; createForm.note = ''
    toast.success('热点添加成功')
    await loadData()
  } catch (e) { console.error(e); toast.error('添加热点失败') }
}

async function expireHotspot(id: number): Promise<void> {
  try {
    await api.post(`/hotspots/${id}/expire`)
    toast.success('已标记过期')
    await loadData()
  } catch (e) { console.error(e); toast.error('标记过期失败') }
}

// 打开编辑对话框
function openEdit(h: Hotspot): void {
  editForm.id = h.id
  editForm.note = h.note || ''
  editForm.usage_status = h.usage_status || 'unused'
  editForm.keywords = (h.keywords || []).join(', ')
  showEdit.value = true
}

// 提交编辑
async function updateHotspot(): Promise<void> {
  try {
    const keywords = editForm.keywords ? editForm.keywords.split(/[,，]/).map(s => s.trim()).filter(Boolean) : []
    await api.put(`/hotspots/${editForm.id}`, {
      note: editForm.note || null,
      usage_status: editForm.usage_status,
      keywords,
    })
    showEdit.value = false
    toast.success('热点更新成功')
    await loadData()
  } catch (e) { console.error(e); toast.error('更新热点失败') }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.back-nav { margin-bottom: var(--space-3); }
.back-link { font-size: var(--font-size-sm); color: var(--color-text-secondary); text-decoration: none; }
.back-link:hover { color: var(--color-primary); }
.hotspots-page { max-width: 900px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5); }
.title-bar h2 { margin: 0; font-size: var(--font-size-xl); color: var(--color-sidebar); }
.title-actions { display: flex; gap: var(--space-2); }
.btn { padding: var(--space-2) var(--space-5); border-radius: var(--radius-sm); border: none; cursor: pointer; font-size: var(--font-size-base); font-weight: 500; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-sm { padding: var(--space-1) var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-border); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-xs); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.filter-bar { margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.filter-tabs { display: flex; gap: var(--space-1); }
.filter-tab { padding: var(--space-1) var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-xl); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-sm); }
.filter-tab.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.filter-selects { display: flex; gap: var(--space-2); }
.filter-select { padding: var(--space-1) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-sm); background: var(--color-bg); cursor: pointer; }
.filter-select:focus { outline: none; border-color: var(--color-primary); }
.hotspot-list { display: flex; flex-direction: column; gap: var(--space-2); }
.hotspot-card { background: var(--color-bg); border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); padding: var(--space-4); }
.hotspot-card.expired { opacity: 0.5; }
.hotspot-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); flex-wrap: wrap; }
.hotspot-actions { display: flex; gap: var(--space-1); margin-left: auto; }
.platform-badge { padding: 2px var(--space-2); border-radius: var(--radius-lg); font-size: 11px; }
.platform-badge.xiaohongshu { background: #ffe0e6; color: #e53935; }
.platform-badge.douyin { background: #e8f5e9; color: #2e7d32; }
.platform-badge.weibo { background: #fff3e0; color: #e65100; }
.platform-badge.weixin { background: #e3f2fd; color: #1565c0; }
.expired-badge { padding: 2px var(--space-2); border-radius: var(--radius-lg); font-size: 11px; background: var(--color-bg-secondary); color: var(--color-text-tertiary); }
.valid-badge { font-size: 11px; color: var(--color-success); }
.hotspot-title { margin: 0 0 6px; font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); }
.hotspot-meta { display: flex; gap: var(--space-4); font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-1); }
.source-link { font-size: var(--font-size-xs); color: var(--color-primary); text-decoration: none; }
.source-link:hover { text-decoration: underline; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: var(--color-bg); border-radius: var(--radius-lg); width: 480px; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border-light); }
.dialog-header h3 { margin: 0; font-size: var(--font-size-lg); }
.dialog-close { background: none; border: none; font-size: var(--font-size-xl); cursor: pointer; color: var(--color-text-tertiary); }
.dialog-body { padding: var(--space-5); }
.form-field { margin-bottom: var(--space-4); }
.form-field label { display: block; margin-bottom: var(--space-1); font-size: var(--font-size-sm); color: var(--color-text-secondary); font-weight: 500; }
.required { color: var(--color-danger); }
.form-field input, .form-field select { width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-base); box-sizing: border-box; }
.form-field input:focus, .form-field select:focus { outline: none; border-color: var(--color-primary); }
.form-actions { display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: var(--space-2); }
.empty-state, .loading { text-align: center; padding: 60px; color: var(--color-text-tertiary); background: var(--color-bg); border-radius: var(--radius-lg); }

/* 热度值及趋势 */
.heat-value { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text); }
.heat-value.up { color: var(--color-danger); }
.heat-value.down { color: var(--color-success); }
.heat-value.flat, .heat-value.stable { color: var(--color-text-tertiary); }
.trend-icon { font-size: var(--font-size-base); }

/* 使用状态标签 */
.usage-badge { padding: 2px var(--space-2); border-radius: var(--radius-lg); font-size: 11px; }
.usage-badge.unused { background: var(--color-bg-secondary); color: var(--color-text-tertiary); }
.usage-badge.used { background: var(--color-success-bg); color: var(--color-success); }
.usage-badge.expired { background: #ffe0e6; color: var(--color-danger); }

/* 关键词标签 */
.keyword-tags { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-top: 6px; }
.keyword-tag { padding: 1px var(--space-2); border-radius: var(--radius-lg); font-size: 11px; background: var(--color-primary-light); color: var(--color-primary); }

/* 分页 */
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-4); margin-top: var(--space-4); padding: var(--space-3) 0; }
.pagination-info { font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.pagination-btns { display: flex; gap: var(--space-2); }

/* 表单文本域 */
.form-textarea { width: 100%; padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-base); box-sizing: border-box; resize: vertical; font-family: inherit; }
.form-textarea:focus { outline: none; border-color: var(--color-primary); }
</style>
