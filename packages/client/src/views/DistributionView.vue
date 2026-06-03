<template>
  <div class="distribution-page">
    <div class="toolbar">
      <h2 class="page-title">全渠道分发</h2>
      <span class="toolbar-hint">一条内容，八个平台，AI 自动适配</span>
    </div>

    <!-- 标签栏 -->
    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'manage' }" @click="activeTab = 'manage'">分发管理</button>
      <button class="tab" :class="{ active: activeTab === 'calendar' }" @click="activeTab = 'calendar'">发布日历</button>
      <button class="tab" :class="{ active: activeTab === 'analytics' }" @click="activeTab = 'analytics'">数据分析</button>
    </div>

    <!-- 分发管理 -->
    <template v-if="activeTab === 'manage'">
      <div class="card adapt-section">
        <h3 class="section-title">AI 内容适配</h3>
        <div class="form-group">
          <label>源标题</label>
          <input v-model="sourceTitle" class="input" placeholder="输入源内容标题" />
        </div>
        <div class="form-group">
          <label>源内容</label>
          <textarea v-model="sourceContent" class="input textarea" rows="4" placeholder="输入或粘贴源内容正文"></textarea>
        </div>
        <div class="form-group">
          <label>源标签（逗号分隔）</label>
          <input v-model="sourceTagsInput" class="input" placeholder="新疆旅游,伊犁,攻略" />
        </div>

        <div class="form-group">
          <label>目标平台</label>
          <div class="platform-grid">
            <button
              v-for="cfg in store.platformConfigs"
              :key="cfg.platform"
              class="platform-chip"
              :class="{ active: selectedPlatforms.includes(cfg.platform) }"
              @click="togglePlatform(cfg.platform)"
            >
              {{ cfg.name }}
              <span class="chip-limit">{{ cfg.maxLength }}字</span>
            </button>
          </div>
        </div>

        <button
          class="btn btn-primary"
          :disabled="!sourceTitle || selectedPlatforms.length === 0 || store.generating"
          @click="handleBatchAdapt"
        >
          {{ store.generating ? 'AI 适配中...' : '一键适配' }}
        </button>
      </div>

      <!-- 筛选 -->
      <div class="filter-bar">
        <select v-model="store.filterPlatform" class="input" @change="store.loadRecords()">
          <option value="all">全部平台</option>
          <option v-for="cfg in store.platformConfigs" :key="cfg.platform" :value="cfg.platform">{{ cfg.name }}</option>
        </select>
        <select v-model="store.filterStatus" class="input" @change="store.loadRecords()">
          <option value="all">全部状态</option>
          <option value="draft">待适配</option>
          <option value="adapted">已适配</option>
          <option value="scheduled">已排期</option>
          <option value="published">已发布</option>
        </select>
      </div>

      <!-- 记录列表 -->
      <div v-if="store.loading" class="loading-wrapper">加载中...</div>
      <div v-else-if="store.records.length === 0" class="empty-state">
        <div class="empty-text">暂无分发记录，使用上方 AI 适配创建</div>
      </div>
      <div v-else class="record-list">
        <div v-for="record in store.records" :key="record.id" class="card record-card">
          <div class="record-header">
            <span class="platform-badge" :class="record.platform">{{ platformLabel(record.platform) }}</span>
            <span class="status-badge" :class="record.status">{{ statusLabel(record.status) }}</span>
            <span class="char-count">{{ record.character_count }}字</span>
          </div>
          <div class="record-title">{{ record.adapted_title || '未适配' }}</div>
          <div v-if="record.adapted_content" class="record-content">{{ record.adapted_content.slice(0, 150) }}{{ record.adapted_content.length > 150 ? '...' : '' }}</div>
          <div v-if="record.adapted_tags?.length" class="record-tags">
            <span v-for="tag in record.adapted_tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <div class="record-actions">
            <button class="btn btn-sm" @click="copyContent(record)">复制内容</button>
            <button v-if="record.status === 'adapted'" class="btn btn-primary btn-sm" @click="handleSchedule(record.id)">排期</button>
            <button v-if="record.status === 'scheduled' || record.status === 'adapted'" class="btn btn-success btn-sm" @click="store.publish(record.id)">标记已发布</button>
            <button class="btn btn-danger btn-sm" @click="store.removeRecord(record.id)">删除</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 发布日历 -->
    <template v-if="activeTab === 'calendar'">
      <div class="card">
        <h3 class="section-title">发布排期</h3>
        <div v-if="store.calendarItems.length === 0" class="empty-state">
          <div class="empty-text">暂无排期内容</div>
        </div>
        <div v-for="item in store.calendarItems" :key="item.id" class="calendar-item">
          <span class="calendar-time">{{ formatTime(item.scheduled_at) }}</span>
          <span class="platform-badge" :class="item.platform">{{ platformLabel(item.platform) }}</span>
          <span class="calendar-title">{{ item.adapted_title || '未设置标题' }}</span>
          <span class="status-badge" :class="item.status">{{ statusLabel(item.status) }}</span>
        </div>
      </div>
    </template>

    <!-- 数据分析 -->
    <template v-if="activeTab === 'analytics'">
      <div class="card" v-if="store.analytics">
        <h3 class="section-title">平台分布</h3>
        <div class="stats-grid">
          <div v-for="s in store.analytics.by_platform" :key="s.platform" class="stat-item">
            <div class="stat-value">{{ s.count }}</div>
            <div class="stat-label">{{ platformLabel(s.platform) }}</div>
          </div>
        </div>

        <h3 class="section-title" style="margin-top: 24px">状态概览</h3>
        <div class="stats-grid">
          <div v-for="s in store.analytics.by_status" :key="s.status" class="stat-item">
            <div class="stat-value">{{ s.count }}</div>
            <div class="stat-label">{{ statusLabel(s.status) }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state"><div class="empty-text">加载中...</div></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDistributionStore } from '@/stores/distribution'
import { PLATFORM_LABELS, DISTRIBUTION_STATUS_LABELS } from '@zimti/shared'
import type { Platform, DistributionRecord } from '@zimti/shared'
import type { DistributionStatus } from '@zimti/shared'

const store = useDistributionStore()
const activeTab = ref('manage')
const sourceTitle = ref('')
const sourceContent = ref('')
const sourceTagsInput = ref('')
const selectedPlatforms = ref<Platform[]>([])

function togglePlatform(p: Platform) {
  const idx = selectedPlatforms.value.indexOf(p)
  if (idx >= 0) selectedPlatforms.value.splice(idx, 1)
  else selectedPlatforms.value.push(p)
}

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p as Platform] ?? p
}

function statusLabel(s: string): string {
  return DISTRIBUTION_STATUS_LABELS[s as DistributionStatus] ?? s
}

function formatTime(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function handleBatchAdapt(): Promise<void> {
  const tags = sourceTagsInput.value.split(/[,，]/).map(t => t.trim()).filter(Boolean)
  await store.startBatchAdapt({
    source_title: sourceTitle.value,
    source_content: sourceContent.value,
    source_tags: tags,
    platforms: selectedPlatforms.value,
  })
  await store.loadRecords()
}

async function handleSchedule(id: string): Promise<void> {
  const scheduledAt = prompt('输入排期时间（如 2026-06-15 12:00）')
  if (scheduledAt) {
    await store.schedule(id, new Date(scheduledAt).toISOString())
  }
}

function copyContent(record: DistributionRecord): void {
  const text = `${record.adapted_title ?? ''}\n\n${record.adapted_content ?? ''}\n\n${(record.adapted_tags ?? []).join(' ')}`
  navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板')).catch(() => {})
}

onMounted(async () => {
  await Promise.all([store.loadPlatformConfigs(), store.loadRecords(), store.loadCalendar(), store.loadAnalytics()])
})
</script>

<style scoped>
.distribution-page { padding: var(--page-padding, 20px); }
.toolbar { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
.toolbar-hint { color: var(--color-text-secondary); font-size: 14px; }
.tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.tab { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: 6px; background: transparent; cursor: pointer; color: var(--color-text-secondary); }
.tab.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

.adapt-section { margin-bottom: 20px; }
.section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; }
.input { width: 100%; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.textarea { min-height: 80px; resize: vertical; font-family: inherit; }

.platform-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.platform-chip {
  padding: 6px 14px; border: 1px solid var(--color-border); border-radius: 20px;
  cursor: pointer; background: var(--color-bg-secondary); font-size: 13px;
  display: flex; align-items: center; gap: 6px;
}
.platform-chip.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.chip-limit { font-size: 11px; opacity: 0.7; }

.filter-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.filter-bar .input { width: auto; min-width: 120px; }

.record-list { display: flex; flex-direction: column; gap: 12px; }
.record-card { padding: 16px; }
.record-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.record-title { font-weight: 600; font-size: 15px; margin-bottom: 6px; }
.record-content { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px; line-height: 1.5; }
.record-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.tag { padding: 2px 8px; background: var(--color-bg-tertiary, #f0f0f0); border-radius: 4px; font-size: 12px; }
.record-actions { display: flex; gap: 8px; }

.platform-badge { padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
.platform-badge.xiaohongshu { background: #ffe0e6; color: #e04060; }
.platform-badge.douyin { background: #e8f5e9; color: #2e7d32; }
.platform-badge.weixin { background: #e3f2fd; color: #1565c0; }
.platform-badge.zhihu { background: #e8eaf6; color: #3949ab; }
.platform-badge.baijiahao { background: #fff3e0; color: #e65100; }
.platform-badge.toutiao { background: #fce4ec; color: #c62828; }
.platform-badge.wechat_official { background: #e0f2f1; color: #00695c; }
.platform-badge.bilibili { background: #f3e5f5; color: #7b1fa2; }

.status-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.status-badge.draft { background: #f5f5f5; color: #757575; }
.status-badge.adapted { background: #e3f2fd; color: #1565c0; }
.status-badge.scheduled { background: #fff3e0; color: #e65100; }
.status-badge.published { background: #e8f5e9; color: #2e7d32; }
.status-badge.failed { background: #ffebee; color: #c62828; }

.char-count { font-size: 12px; color: var(--color-text-secondary); }

.btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: 6px; cursor: pointer; font-size: 13px; background: transparent; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-primary { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-success { background: #4caf50; color: white; border-color: #4caf50; }
.btn-danger { color: #e53935; border-color: #e53935; }
.card { background: var(--color-card, white); border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; }

.empty-state { text-align: center; padding: 40px; color: var(--color-text-secondary); }
.loading-wrapper { text-align: center; padding: 40px; color: var(--color-text-secondary); }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
.stat-item { text-align: center; padding: 12px; background: var(--color-bg-secondary); border-radius: 8px; }
.stat-value { font-size: 24px; font-weight: 700; color: var(--color-primary); }
.stat-label { font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; }

.calendar-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
.calendar-time { font-size: 13px; color: var(--color-text-secondary); min-width: 100px; }
.calendar-title { flex: 1; font-size: 14px; }

@media (max-width: 768px) {
  .platform-grid { gap: 6px; }
  .platform-chip { padding: 4px 10px; font-size: 12px; }
  .filter-bar { flex-direction: column; }
  .record-actions { flex-wrap: wrap; }
}
</style>
