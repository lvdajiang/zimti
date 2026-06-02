<template>
  <div class="benchmark-page">
    <div class="title-bar">
      <h2>对标账号管理</h2>
      <HelpTip title="对标账号使用指引" :steps="[
        '添加竞品或行业标杆账号，填写平台和主页链接',
        '开启「监控」后系统会定期采集该账号的最新内容',
        '采集的内容自动进入爆款视频库，用于分析和学习',
        '支持按平台筛选和查看采集统计数据',
      ]" />
      <button class="btn btn-primary" @click="showForm = true; editingAccount = null">
        + 添加账号
      </button>
    </div>

    <div class="sub-nav">
      <RouterLink to="/collect-tasks" class="sub-nav-link">数据采集</RouterLink>
    </div>

    <div class="stats-bar" v-if="stats">
      <div class="stat-card">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">总账号</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.monitoring }}</span>
        <span class="stat-label">监控中</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.paused }}</span>
        <span class="stat-label">已暂停</span>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-tabs">
        <button
          v-for="tab in platformTabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: platformFilter === tab.value }"
          @click="platformFilter = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <input
        v-model="searchKeyword"
        class="search-input"
        placeholder="搜索账号名称..."
        @input="debouncedLoad"
      />
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="accounts.length === 0" class="empty-state">
      <p>暂无对标账号，点击上方按钮添加</p>
    </div>
    <div v-else class="card-grid">
      <div v-for="account in accounts" :key="account.id" class="account-card">
        <div class="card-header">
          <span class="platform-badge" :class="account.platform">{{ platformLabel(account.platform) }}</span>
          <label class="monitor-switch">
            <input
              type="checkbox"
              :checked="account.monitor_status === 'active'"
              @change="toggleMonitor(account)"
            />
            <span class="switch-text">{{ account.monitor_status === 'active' ? '监控中' : '已暂停' }}</span>
          </label>
        </div>
        <div class="card-body">
          <h4 class="account-name">{{ account.account_name }}</h4>
          <p class="account-url" :title="account.homepage_url">{{ account.homepage_url }}</p>
          <div class="account-meta">
            <span>粉丝 {{ formatNumber(account.follower_count) }}</span>
            <span>{{ account.content_direction || '未设置方向' }}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-sm" @click="startCollect(account)">采集</button>
          <button class="btn-sm" @click="editingAccount = account; showForm = true">编辑</button>
          <button class="btn-sm btn-danger" @click="deleteAccount(account)">删除</button>
        </div>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingAccount ? '编辑账号' : '添加账号' }}</h3>
          <button class="dialog-close" @click="showForm = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>账号名称 <span class="required">*</span></label>
            <input v-model="form.account_name" placeholder="请输入账号名称" />
          </div>
          <div class="form-field">
            <label>平台 <span class="required">*</span></label>
            <select v-model="form.platform">
              <option value="">请选择平台</option>
              <option value="xiaohongshu">小红书</option>
              <option value="douyin">抖音</option>
              <option value="weixin">视频号</option>
            </select>
          </div>
          <div class="form-field">
            <label>主页链接 <span class="required">*</span></label>
            <input v-model="form.homepage_url" placeholder="https://..." />
          </div>
          <div class="form-field">
            <label>粉丝数</label>
            <input v-model.number="form.follower_count" type="number" placeholder="0" />
          </div>
          <div class="form-field">
            <label>内容方向 <span class="required">*</span></label>
            <input v-model="form.content_direction" placeholder="例如：美妆测评、知识科普" />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="saveAccount">保存</button>
            <button class="btn" @click="showForm = false">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deletingAccount" class="overlay" @click.self="deletingAccount = null">
      <div class="dialog dialog-sm">
        <div class="dialog-header">
          <h3>确认删除</h3>
          <button class="dialog-close" @click="deletingAccount = null">&times;</button>
        </div>
        <div class="dialog-body">
          <p>确定要删除「{{ deletingAccount.account_name }}」吗？关联的采集数据将保留。</p>
          <div class="form-actions">
            <button class="btn btn-danger" @click="confirmDelete">确认删除</button>
            <button class="btn" @click="deletingAccount = null">取消</button>
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
import { formatNumber, platformLabel } from '@/utils/format'

interface BenchmarkAccount {
  id: string
  account_name: string
  platform: string
  homepage_url: string
  follower_count: number
  content_direction: string
  monitor_status: string
  last_collected_at: string | null
  created_at: string
}

const accounts = ref<BenchmarkAccount[]>([])
const stats = ref<{ total: number; monitoring: number; paused: number } | null>(null)
const loading = ref(false)
const platformFilter = ref('all')
const searchKeyword = ref('')
const showForm = ref(false)
const editingAccount = ref<BenchmarkAccount | null>(null)
const deletingAccount = ref<BenchmarkAccount | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const form = reactive({
  account_name: '',
  platform: '',
  homepage_url: '',
  follower_count: 0,
  content_direction: '',
})

const platformTabs = [
  { value: 'all', label: '全部' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'weixin', label: '视频号' },
]

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const params: string[] = []
    if (platformFilter.value !== 'all') params.push(`platform=${platformFilter.value}`)
    if (searchKeyword.value) params.push(`keyword=${encodeURIComponent(searchKeyword.value)}`)
    const query = params.length ? `?${params.join('&')}` : ''
    const res: { items: BenchmarkAccount[]; total: number } = await api.get(`/benchmark-accounts${query}`)
    accounts.value = res.items
  } catch (e) {
    console.error(e)
    toast.error('加载账号列表失败')
  } finally {
    loading.value = false
  }
}

async function loadStats(): Promise<void> {
  try {
    stats.value = await api.get('/benchmark-accounts/stats')
  } catch (e) {
    console.error(e)
    toast.error('加载统计数据失败')
  }
}

function debouncedLoad(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadData, 500)
}

async function saveAccount(): Promise<void> {
  if (!form.account_name || !form.platform || !form.homepage_url || !form.content_direction) {
    toast.error('请填写所有必填字段')
    return
  }
  try {
    if (editingAccount.value) {
      await api.put(`/benchmark-accounts/${editingAccount.value.id}`, form)
    } else {
      await api.post('/benchmark-accounts', form)
    }
    showForm.value = false
    await loadData()
    await loadStats()
  } catch (e) {
    console.error(e)
    toast.error('保存失败')
  }
}

async function toggleMonitor(account: BenchmarkAccount): Promise<void> {
  const newStatus = account.monitor_status === 'active' ? 'paused' : 'active'
  try {
    await api.put(`/benchmark-accounts/${account.id}/monitor`, { monitor_status: newStatus })
    account.monitor_status = newStatus
    await loadStats()
  } catch (e) {
    console.error(e)
    toast.error('切换监控状态失败')
  }
}

function deleteAccount(account: BenchmarkAccount): void {
  deletingAccount.value = account
}

async function confirmDelete(): Promise<void> {
  if (!deletingAccount.value) return
  try {
    await api.delete(`/benchmark-accounts/${deletingAccount.value.id}`)
    deletingAccount.value = null
    await loadData()
    await loadStats()
  } catch (e) {
    console.error(e)
    toast.error('删除失败')
  }
}

async function startCollect(account: BenchmarkAccount): Promise<void> {
  try {
    await api.post('/collect-tasks', {
      target_account_id: account.id,
      task_type: 'video_list',
      max_count: 100,
    })
    toast.success(`已为「${account.account_name}」创建采集任务`)
  } catch (e) {
    console.error(e)
    toast.error('创建采集任务失败')
  }
}

onMounted(() => {
  Promise.all([loadData(), loadStats()])
})
</script>

<style scoped>
.benchmark-page {
  max-width: 1100px;
  margin: 0 auto;
}
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}
.title-bar h2 { margin: 0; font-size: var(--font-size-xl); color: var(--color-sidebar); }
.btn {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: 500;
}
.btn-primary {
  background: #4fc3f7;
  color: #fff;
}
.btn-danger {
  background: var(--color-danger);
  color: #fff;
}
.btn-sm {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  cursor: pointer;
  font-size: var(--font-size-xs);
}
.btn-sm.btn-danger { border-color: #ffcdd2; color: var(--color-danger); }
.stats-bar {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.stat-card {
  background: var(--color-bg);
  border-radius: var(--radius);
  padding: var(--space-4) var(--space-6);
  border: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.stat-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-sidebar); }
.stat-label { font-size: var(--font-size-sm); color: var(--color-text-tertiary); }
.filter-bar {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  align-items: center;
}
.filter-tabs { display: flex; gap: var(--space-1); }
.filter-tab {
  padding: var(--space-1) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-bg);
  cursor: pointer;
  font-size: var(--font-size-sm);
}
.filter-tab.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.search-input {
  padding: 7px var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  font-size: var(--font-size-sm);
  outline: none;
  width: 220px;
}
.search-input:focus { border-color: #4fc3f7; }
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}
.account-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: box-shadow var(--transition);
}
.account-card:hover { box-shadow: var(--shadow); }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}
.platform-badge {
  padding: 2px 10px;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-xs);
  font-weight: 500;
}
.platform-badge.xiaohongshu { background: #ffe0e6; color: #e53935; }
.platform-badge.douyin { background: #e8f5e9; color: #2e7d32; }
.platform-badge.weixin { background: #e3f2fd; color: #1565c0; }
.monitor-switch {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  cursor: pointer;
}
.monitor-switch input[type="checkbox"] { cursor: pointer; }
.switch-text { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.card-body { padding: var(--space-4); }
.account-name { margin: 0 0 var(--space-1); font-size: var(--font-size-md); font-weight: 600; color: var(--color-text); }
.account-url {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-meta {
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.card-actions {
  display: flex;
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-3);
  border-top: 1px solid var(--color-border-light);
}
.empty-state, .loading {
  text-align: center;
  padding: 60px;
  color: var(--color-text-tertiary);
  background: var(--color-bg);
  border-radius: var(--radius-lg);
}
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
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: 480px;
}
.dialog-sm { width: 400px; }
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border-light);
}
.dialog-header h3 { margin: 0; font-size: var(--font-size-lg); }
.dialog-close { background: none; border: none; font-size: var(--font-size-xl); cursor: pointer; color: var(--color-text-tertiary); }
.dialog-body { padding: var(--space-5); }
.form-field { margin-bottom: var(--space-4); }
.form-field label { display: block; margin-bottom: var(--space-1); font-size: var(--font-size-sm); color: var(--color-text-secondary); font-weight: 500; }
.required { color: var(--color-danger); }
.form-field input,
.form-field select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  box-sizing: border-box;
}
.form-field input:focus,
.form-field select:focus { outline: none; border-color: #4fc3f7; }
.form-actions { display: flex; gap: var(--space-3); justify-content: flex-end; margin-top: var(--space-2); }
.sub-nav { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
.sub-nav-link { padding: 4px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-xs); color: var(--color-text-secondary); text-decoration: none; transition: all var(--transition-fast); }
.sub-nav-link:hover { color: var(--color-primary); border-color: var(--color-primary); background: var(--color-primary-light); }
</style>
