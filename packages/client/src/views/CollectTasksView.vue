<template>
  <div class="collect-page">
    <div class="title-bar">
      <h2>数据采集任务</h2>
      <button class="btn btn-primary" @click="openCreate">+ 新建任务</button>
    </div>

    <div class="stats-bar" v-if="stats">
      <div class="stat-card"><span class="stat-value">{{ stats.total }}</span><span class="stat-label">总任务</span></div>
      <div class="stat-card"><span class="stat-value">{{ stats.pending }}</span><span class="stat-label">等待中</span></div>
      <div class="stat-card"><span class="stat-value">{{ stats.running }}</span><span class="stat-label">采集中</span></div>
      <div class="stat-card"><span class="stat-value">{{ stats.completed }}</span><span class="stat-label">已完成</span></div>
      <div class="stat-card"><span class="stat-value text-danger">{{ stats.failed }}</span><span class="stat-label">失败</span></div>
    </div>

    <div class="filter-bar">
      <div class="filter-tabs">
        <button v-for="tab in statusTabs" :key="tab.value" class="filter-tab" :class="{ active: statusFilter === tab.value }" @click="statusFilter = tab.value">
          {{ tab.label }} ({{ tabCount(tab.value) }})
        </button>
      </div>
      <div class="filter-tabs" style="margin-left: 12px;">
        <button v-for="tab in typeTabs" :key="tab.value" class="filter-tab" :class="{ active: typeFilter === tab.value }" @click="typeFilter = tab.value">
          {{ tab.label }}
        </button>
      </div>
      <input class="search-input" type="text" placeholder="搜索账号名称..." v-model="searchInput" />
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="tasks.length === 0" class="empty-state"><p>暂无采集任务</p></div>
    <div v-else class="task-table-wrap">
      <table class="task-table">
        <thead>
          <tr>
            <th style="width:50px"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></th>
            <th>目标账号</th>
            <th>类型</th>
            <th>状态</th>
            <th>进度</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.id" :class="{ 'row-selected': selected.includes(task.id) }">
            <td><input type="checkbox" :checked="selected.includes(task.id)" @change="toggleSelect(task.id)" /></td>
            <td>
              <div class="account-info">
                <span class="account-name">{{ task.account_name }}</span>
                <span class="platform-badge" :class="task.platform">{{ platformLabel(task.platform) }}</span>
              </div>
            </td>
            <td><span class="type-tag">{{ taskTypeLabel(task.task_type) }}</span></td>
            <td><span class="status-tag" :class="task.status">{{ statusLabel(task.status) }}</span></td>
            <td>
              <div class="progress-cell">
                <div class="progress-bar"><div class="progress-fill" :style="{ width: progressPercent(task) + '%', background: progressColor(task) }"></div></div>
                <span class="progress-text">{{ task.collected_count }}/{{ task.max_count }}</span>
              </div>
            </td>
            <td>{{ formatDate(task.created_at) }}</td>
            <td>
              <div class="row-actions">
                <button v-if="task.status === 'pending'" class="btn-sm" @click="executeTask(task.id)">执行</button>
                <button v-if="task.status === 'running'" class="btn-sm" @click="pauseTask(task.id)">暂停</button>
                <button v-if="task.status === 'failed'" class="btn-sm" @click="retryTask(task.id)">重试</button>
                <button v-if="task.status === 'completed' || task.status === 'failed'" class="btn-sm" @click="rerunTask(task.id)">重新采集</button>
                <button v-if="task.status === 'pending'" class="btn-sm btn-edit" @click="openEdit(task)">编辑</button>
                <button class="btn-sm" @click="viewLogs(task.id)">日志</button>
                <button class="btn-sm btn-danger" @click="deleteTask(task)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="selected.length > 0" class="batch-bar">
        <span>已选 {{ selected.length }} 项</span>
        <button class="btn-sm btn-danger" @click="batchDelete">批量删除</button>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > 0" class="pagination-bar">
      <span class="pagination-info">共 {{ total }} 条 第 {{ page }}/{{ totalPages }} 页</span>
      <button class="btn-sm" :disabled="page <= 1" @click="page--; loadData()">上一页</button>
      <button class="btn-sm" :disabled="page >= totalPages" @click="page++; loadData()">下一页</button>
    </div>

    <!-- 新建/编辑任务弹窗 -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingId ? '编辑采集任务' : '新建采集任务' }}</h3>
          <button class="dialog-close" @click="showForm = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>目标账号 <span class="required">*</span></label>
            <select v-model="form.target_account_id">
              <option value="">请选择账号</option>
              <option v-for="acc in accountOptions" :key="acc.id" :value="acc.id">{{ acc.account_name }} ({{ platformLabel(acc.platform) }})</option>
            </select>
          </div>
          <div class="form-field">
            <label>采集类型 <span class="required">*</span></label>
            <select v-model="form.task_type">
              <option value="video">视频采集</option>
              <option value="transcript">文案提取</option>
              <option value="hotspot">热点采集</option>
            </select>
          </div>
          <div class="form-field">
            <label>最大采集数</label>
            <input v-model.number="form.max_count" type="number" min="1" max="500" />
          </div>
          <div class="form-field">
            <label>日期范围（可选）</label>
            <div class="date-range">
              <input v-model="form.date_range_start" type="date" />
              <span>~</span>
              <input v-model="form.date_range_end" type="date" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="submitForm">{{ editingId ? '保存' : '创建' }}</button>
            <button class="btn" @click="showForm = false">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 日志弹窗 -->
    <div v-if="showLogs" class="overlay" @click.self="showLogs = false">
      <div class="dialog dialog-wide">
        <div class="dialog-header">
          <h3>任务日志</h3>
          <button class="dialog-close" @click="showLogs = false">&times;</button>
        </div>
        <div class="dialog-body log-body">
          <div v-if="logsLoading" class="loading">加载中...</div>
          <div v-else-if="logs.length === 0" class="empty-state" style="padding: 30px;">暂无日志</div>
          <pre v-else class="log-terminal"><span v-for="(log, i) in logs" :key="i" class="log-line">{{ formatLogLine(log) }}</span></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'
import { formatDate, platformLabel } from '@/utils/format'

interface CollectTask {
  id: string
  target_account_id: string
  account_name: string
  platform: string
  task_type: string
  status: string
  max_count: number
  collected_count: number
  date_range_start: string | null
  date_range_end: string | null
  created_at: string
}

interface TaskLog {
  id: string
  level: string
  message: string
  created_at: string
  [key: string]: unknown
}

interface Stats { total: number; pending: number; running: number; completed: number; failed: number }

const tasks = ref<CollectTask[]>([])
const stats = ref<Stats | null>(null)
const loading = ref(false)
const statusFilter = ref('all')
const typeFilter = ref('')
const searchInput = ref('')
const keyword = ref('')
const selected = ref<string[]>([])
const showForm = ref(false)
const editingId = ref<string | null>(null)
const accountOptions = ref<{ id: string; account_name: string; platform: string }[]>([])

const page = ref(1)
const page_size = 20
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / page_size)))

const form = reactive({
  target_account_id: '',
  task_type: 'video',
  max_count: 50,
  date_range_start: '',
  date_range_end: '',
})

const showLogs = ref(false)
const logs = ref<TaskLog[]>([])
const logsLoading = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    keyword.value = val.trim()
    page.value = 1
    loadData()
  }, 500)
})

watch(statusFilter, () => { page.value = 1; loadData() })
watch(typeFilter, () => { page.value = 1; loadData() })

const statusTabs = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '等待中' },
  { value: 'running', label: '采集中' },
  { value: 'paused', label: '已暂停' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
]

const typeTabs = [
  { value: '', label: '全部类型' },
  { value: 'video', label: '视频采集' },
  { value: 'transcript', label: '文案提取' },
  { value: 'hotspot', label: '热点采集' },
]

const statusLabels: Record<string, string> = {
  pending: '等待中', running: '采集中', paused: '已暂停', completed: '已完成', failed: '采集失败',
}
const taskTypeLabels: Record<string, string> = { video: '视频采集', transcript: '文案提取', hotspot: '热点采集' }

function statusLabel(s: string): string { return statusLabels[s] ?? s }
function taskTypeLabel(t: string): string { return taskTypeLabels[t] ?? t }

function tabCount(value: string): number {
  if (value === 'all') return tasks.value.length
  return tasks.value.filter(t => t.status === value).length
}

function progressPercent(task: CollectTask): number {
  if (task.max_count === 0) return 0
  return Math.round((task.collected_count / task.max_count) * 100)
}

function progressColor(task: CollectTask): string {
  if (task.status === 'failed') return '#e53935'
  if (task.status === 'completed') return '#4caf50'
  return '#4fc3f7'
}

function formatLogLine(log: TaskLog): string {
  const time = log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : ''
  const level = log.level ? `[${log.level.toUpperCase()}]` : ''
  return time ? `${time} ${level} ${log.message}` : `${level} ${log.message}`
}

const allSelected = computed(() => tasks.value.length > 0 && selected.value.length === tasks.value.length)

function toggleSelect(id: string): void {
  const idx = selected.value.indexOf(id)
  if (idx === -1) selected.value.push(id)
  else selected.value.splice(idx, 1)
}

function toggleAll(): void {
  if (allSelected.value) selected.value = []
  else selected.value = tasks.value.map(t => t.id)
}

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const params: string[] = []
    if (statusFilter.value !== 'all') params.push(`status=${statusFilter.value}`)
    if (typeFilter.value) params.push(`task_type=${typeFilter.value}`)
    if (keyword.value) params.push(`keyword=${encodeURIComponent(keyword.value)}`)
    params.push(`page=${page.value}`)
    params.push(`page_size=${page_size}`)
    const query = `?${params.join('&')}`
    const res = await api.get<{ items: CollectTask[]; total: number }>(`/collect-tasks${query}`)
    tasks.value = res.items
    total.value = res.total
    selected.value = []
  } catch (e) { console.error(e); toast.error('加载列表失败') }
  finally { loading.value = false }
}

async function loadStats(): Promise<void> {
  try { stats.value = await api.get('/collect-tasks/stats') } catch (e) { console.error(e); toast.error('加载统计数据失败') }
}

async function loadAccounts(): Promise<void> {
  try {
    const data = await api.get<{ items: { id: string; account_name: string; platform: string }[] }>('/benchmark-accounts?page_size=100')
    accountOptions.value = data.items ?? []
  } catch (e) { console.error(e); toast.error('加载账号列表失败') }
}

function resetForm(): void {
  form.target_account_id = ''
  form.task_type = 'video'
  form.max_count = 50
  form.date_range_start = ''
  form.date_range_end = ''
  editingId.value = null
}

function openCreate(): void {
  resetForm()
  showForm.value = true
}

function openEdit(task: CollectTask): void {
  editingId.value = task.id
  form.target_account_id = task.target_account_id
  form.task_type = task.task_type
  form.max_count = task.max_count
  form.date_range_start = task.date_range_start ?? ''
  form.date_range_end = task.date_range_end ?? ''
  showForm.value = true
}

async function submitForm(): Promise<void> {
  if (!form.target_account_id || !form.task_type) {
    toast.error('请选择目标账号和采集类型')
    return
  }
  try {
    if (editingId.value) {
      await api.put(`/collect-tasks/${editingId.value}`, form)
      toast.success('任务已更新')
    } else {
      await api.post('/collect-tasks', form)
      toast.success('任务已创建')
    }
    showForm.value = false
    resetForm()
    await loadData()
    await loadStats()
  } catch (e) {
    console.error(e)
    toast.error(editingId.value ? '更新失败' : '创建失败')
  }
}

async function executeTask(id: string): Promise<void> {
  try { await api.post(`/collect-tasks/${id}/execute`); await loadData(); await loadStats() } catch (e) { console.error(e); toast.error('操作失败') }
}

async function pauseTask(id: string): Promise<void> {
  try { await api.post(`/collect-tasks/${id}/pause`); await loadData(); await loadStats() } catch (e) { console.error(e); toast.error('操作失败') }
}

async function retryTask(id: string): Promise<void> {
  try { await api.post(`/collect-tasks/${id}/retry`); await loadData(); await loadStats() } catch (e) { console.error(e); toast.error('操作失败') }
}

async function rerunTask(id: string): Promise<void> {
  try { await api.post(`/collect-tasks/${id}/rerun`); await loadData(); await loadStats() } catch (e) { console.error(e); toast.error('操作失败') }
}

function deleteTask(task: CollectTask): void {
  if (!confirm(`确定要删除采集任务吗？`)) return
  doDelete(task.id)
}

async function doDelete(id: string): Promise<void> {
  try { await api.delete(`/collect-tasks/${id}`); await loadData(); await loadStats() } catch (e) { console.error(e); toast.error('删除失败') }
}

async function batchDelete(): Promise<void> {
  if (!confirm(`确定删除选中的 ${selected.value.length} 个任务吗？`)) return
  try {
    await api.delete('/collect-tasks/batch', { data: { ids: selected.value } })
    selected.value = []
    await loadData()
    await loadStats()
  } catch (e) { console.error(e); toast.error('批量删除失败') }
}

async function viewLogs(id: string): Promise<void> {
  showLogs.value = true
  logs.value = []
  logsLoading.value = true
  try {
    const data = await api.get<TaskLog[]>(`/collect-tasks/${id}/logs`)
    logs.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
    toast.error('加载日志失败')
    logs.value = []
  } finally {
    logsLoading.value = false
  }
}

onMounted(() => { loadData(); loadStats(); loadAccounts() })
</script>

<style scoped>
.collect-page { max-width: 1100px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-bar h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4fc3f7; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sm.btn-danger { border-color: #ffcdd2; color: #e53935; }
.btn-sm.btn-edit { border-color: #c8e6c9; color: #2e7d32; }
.stats-bar { display: flex; gap: 12px; margin-bottom: 20px; }
.stat-card { background: #fff; border-radius: 8px; padding: 12px 20px; border: 1px solid #eee; display: flex; flex-direction: column; gap: 2px; }
.stat-value { font-size: 22px; font-weight: 700; color: #1a1a2e; }
.stat-label { font-size: 12px; color: #999; }
.text-danger { color: #e53935; }
.filter-bar { display: flex; align-items: center; gap: 4px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-tabs { display: flex; gap: 4px; }
.filter-tab { padding: 6px 16px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 13px; }
.filter-tab.active { background: #4a6cf7; color: #fff; border-color: #4a6cf7; }
.search-input { padding: 6px 14px; border: 1px solid #ddd; border-radius: 20px; font-size: 13px; width: 200px; margin-left: auto; outline: none; }
.search-input:focus { border-color: #4fc3f7; }
.task-table-wrap { background: #fff; border-radius: 10px; border: 1px solid #eee; overflow: hidden; }
.task-table { width: 100%; border-collapse: collapse; }
.task-table th { text-align: left; padding: 12px 16px; font-size: 13px; font-weight: 500; color: #666; background: #fafafa; border-bottom: 1px solid #eee; }
.task-table td { padding: 12px 16px; font-size: 13px; color: #333; border-bottom: 1px solid #f5f5f5; }
.task-table tbody tr:hover { background: #f9fbff; }
.row-selected { background: #e3f2fd !important; }
.account-info { display: flex; align-items: center; gap: 8px; }
.account-name { font-weight: 500; }
.platform-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
.platform-badge.xiaohongshu { background: #ffe0e6; color: #e53935; }
.platform-badge.douyin { background: #e8f5e9; color: #2e7d32; }
.platform-badge.weixin { background: #e3f2fd; color: #1565c0; }
.type-tag { padding: 2px 8px; border-radius: 10px; background: #f0f4ff; color: #4a6cf7; font-size: 11px; }
.status-tag { padding: 2px 8px; border-radius: 10px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; }
.status-tag.pending { background: #f5f5f5; color: #999; }
.status-tag.running { background: #e3f2fd; color: #1565c0; }
.status-tag.paused { background: #fff3e0; color: #f57c00; }
.status-tag.completed { background: #e8f5e9; color: #2e7d32; }
.status-tag.failed { background: #ffebee; color: #e53935; }
.progress-cell { display: flex; align-items: center; gap: 8px; }
.progress-bar { width: 120px; height: 6px; background: #eee; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.progress-text { font-size: 12px; color: #999; white-space: nowrap; }
.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.batch-bar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 12px 16px; border-top: 1px solid #f0f0f0; }
.empty-state, .loading { text-align: center; padding: 60px; color: #999; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #fff; border-radius: 12px; width: 480px; }
.dialog-wide { width: 680px; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.dialog-body { padding: 20px; }
.form-field { margin-bottom: 16px; }
.form-field label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; font-weight: 500; }
.required { color: #e53935; }
.form-field input, .form-field select { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.form-field input:focus, .form-field select:focus { outline: none; border-color: #4fc3f7; }
.date-range { display: flex; align-items: center; gap: 8px; }
.date-range input { flex: 1; }
.form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
.pagination-bar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 16px; padding: 8px 0; }
.pagination-info { font-size: 13px; color: #666; }
.log-body { padding: 0; }
.log-terminal { background: #1a1a1a; color: #33ff33; font-family: 'Courier New', Consolas, monospace; font-size: 13px; line-height: 1.6; padding: 20px; margin: 0; max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.log-line { display: block; }
</style>
