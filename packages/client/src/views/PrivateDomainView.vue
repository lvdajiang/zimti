<template>
  <div class="private-domain">
    <div class="toolbar">
      <h2 class="page-title">私域运营</h2>
      <div class="toolbar-actions">
        <div class="tabs">
          <button class="tab" :class="{ active: activeTab === 'moments' }" @click="switchTab('moments')">今日朋友圈</button>
          <button class="tab" :class="{ active: activeTab === 'calendar' }" @click="switchTab('calendar')">日历排期</button>
          <button class="tab" :class="{ active: activeTab === 'groups' }" @click="switchTab('groups')">群运营内容</button>
        </div>
      </div>
    </div>

    <!-- 朋友圈 -->
    <template v-if="activeTab === 'moments'">
      <div class="filters">
        <button class="btn" @click="store.loadDailyMoments()">刷新</button>
      </div>
      <div v-if="store.momentsLoading" class="loading-wrapper">加载中...</div>
      <div v-else-if="store.moments.length === 0" class="empty-state">
        <div class="empty-text">今日尚未生成朋友圈内容</div>
        <button class="btn-primary" @click="store.loadDailyMoments()">生成内容</button>
      </div>
      <div v-else class="moments-list">
        <div v-for="m in store.moments" :key="m.id" class="moment-card">
          <div class="moment-header">
            <span class="badge" :class="typeBadgeClass(m.content_type)">{{ MOMENTS_CONTENT_TYPE_LABELS[m.content_type] }}</span>
            <span class="moment-time">{{ formatTime(m.created_at) }}</span>
            <span v-if="m.sent_at" class="badge badge-green">已发送 {{ formatTime(m.sent_at) }}</span>
            <span v-else-if="m.status === 'scheduled' && m.scheduled_at" class="badge badge-blue">计划 {{ formatDate(m.scheduled_at) }}</span>
          </div>
          <div class="moment-body">{{ m.content }}</div>
          <div v-if="m.image_suggestion" class="moment-suggestion">配图建议: {{ m.image_suggestion }}</div>
          <div class="moment-actions">
            <button class="btn-link" @click="copyText(m.content)">复制文案</button>
            <button v-if="!m.sent_at" class="btn-primary btn-sm" @click="handleMarkSent(m)">标记已发送</button>
            <button class="btn-link" @click="openSchedule(m)">排期</button>
            <button class="btn-link" @click="openEngagement(m)">录入互动</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 日历排期 -->
    <template v-if="activeTab === 'calendar'">
      <div class="calendar-nav">
        <button class="btn" @click="prevMonth">◀</button>
        <span class="calendar-title">{{ calYear }}年{{ calMonth }}月</span>
        <button class="btn" @click="nextMonth">▶</button>
      </div>
      <div class="calendar-grid">
        <div v-for="d in WEEKDAYS" :key="d" class="cal-header">{{ d }}</div>
        <div
          v-for="(day, idx) in calendarDays"
          :key="idx"
          class="cal-cell"
          :class="{ 'cal-empty': !day.date, 'cal-today': day.isToday, 'cal-selected': day.date === selectedDate }"
          @click="selectDay(day)"
        >
          <div v-if="day.date" class="cal-date">{{ day.day }}</div>
          <div v-if="day.items.length" class="cal-dots">
            <span v-for="item in day.items.slice(0, 3)" :key="item.id" class="cal-dot" :class="dotClass(item)"></span>
          </div>
        </div>
      </div>
      <!-- 选中日期的内容 -->
      <div v-if="selectedDate" class="cal-detail">
        <h3 class="cal-detail-title">{{ selectedDate }} 的朋友圈</h3>
        <div v-if="selectedDayItems.length === 0" class="empty-text">当日无排期内容</div>
        <div v-for="m in selectedDayItems" :key="m.id" class="moment-card">
          <div class="moment-header">
            <span class="badge" :class="typeBadgeClass(m.content_type)">{{ MOMENTS_CONTENT_TYPE_LABELS[m.content_type] }}</span>
            <span v-if="m.status === 'sent'" class="badge badge-green">已发送</span>
            <span v-else-if="m.status === 'scheduled'" class="badge badge-blue">已排期</span>
            <span v-else class="badge badge-gray">草稿</span>
          </div>
          <div class="moment-body" style="max-height:80px;overflow:hidden;">{{ m.content }}</div>
          <div class="moment-actions">
            <button class="btn-link" @click="copyText(m.content)">复制</button>
            <button v-if="m.status !== 'sent'" class="btn-primary btn-sm" @click="handleMarkSent(m)">标记已发送</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 群运营 -->
    <template v-if="activeTab === 'groups'">
      <div class="filters">
        <select v-model="filterGroupType" class="input" style="width: 150px" @change="store.loadGroupContents(filterGroupType || undefined)">
          <option value="">全部群类型</option>
          <option v-for="(label, key) in GROUP_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <button class="btn-primary" :disabled="store.generatingGroup || !filterGroupType" @click="handleGenerate">
          {{ store.generatingGroup ? '生成中...' : '生成内容' }}
        </button>
      </div>
      <div v-if="store.groupContentsLoading" class="loading-wrapper">加载中...</div>
      <div v-else-if="store.groupContents.length === 0" class="empty-state">
        <div class="empty-text">{{ filterGroupType ? '暂无该类型群内容' : '请选择群类型后生成内容' }}</div>
      </div>
      <div v-else class="moments-list">
        <div v-for="g in store.groupContents" :key="g.id" class="moment-card">
          <div class="moment-header">
            <span class="badge badge-blue">{{ GROUP_TYPE_LABELS[g.group_type] }}</span>
            <span class="moment-time">{{ formatTime(g.created_at) }}</span>
          </div>
          <div v-if="g.title" class="moment-title">{{ g.title }}</div>
          <div class="moment-body">{{ g.content }}</div>
          <div class="moment-actions">
            <button class="btn-link" @click="copyText(g.content)">复制</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 互动录入弹窗 -->
    <div v-if="showEngagementModal" class="modal-overlay" @click.self="showEngagementModal = false">
      <div class="modal" style="width: 360px;">
        <h3 class="modal-title">录入互动数据</h3>
        <div class="form-group"><label>点赞数</label><input v-model.number="engagementForm.likes" type="number" class="input" min="0" /></div>
        <div class="form-group"><label>评论数</label><input v-model.number="engagementForm.comments" type="number" class="input" min="0" /></div>
        <div class="modal-actions">
          <button class="btn" @click="showEngagementModal = false">取消</button>
          <button class="btn-primary" @click="submitEngagement">保存</button>
        </div>
      </div>
    </div>

    <!-- 排期弹窗 -->
    <div v-if="showScheduleModal" class="modal-overlay" @click.self="showScheduleModal = false">
      <div class="modal" style="width: 360px;">
        <h3 class="modal-title">设置发送排期</h3>
        <div class="form-group"><label>计划发送时间</label><input v-model="scheduleForm.scheduled_at" type="datetime-local" class="input" /></div>
        <div class="modal-actions">
          <button class="btn" @click="showScheduleModal = false">取消</button>
          <button class="btn-primary" @click="submitSchedule">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePrivateDomainStore } from '../stores/privateDomain'
import { MOMENTS_CONTENT_TYPE_LABELS, GROUP_TYPE_LABELS } from '@zimti/shared'
import { fetchMomentsCalendar, scheduleMoment } from '../api/privateDomain'
import type { MomentsContent } from '../api/privateDomain'
import type { GroupType } from '@zimti/shared'

const store = usePrivateDomainStore()
const activeTab = ref<'moments' | 'calendar' | 'groups'>('moments')
const showEngagementModal = ref(false)
const showScheduleModal = ref(false)
const engagementForm = ref({ likes: 0, comments: 0 })
const engagementMomentId = ref('')
const scheduleForm = ref({ id: '', scheduled_at: '' })
const filterGroupType = ref<GroupType | ''>('')

// 日历状态
const now = new Date()
const calYear = ref(now.getFullYear())
const calMonth = ref(now.getMonth() + 1)
const calItems = ref<MomentsContent[]>([])
const selectedDate = ref('')

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

interface CalDay { date: string; day: number; isToday: boolean; items: MomentsContent[] }

const EMPTY_DAY: CalDay = { date: '', day: 0, isToday: false, items: [] }

const calendarDays = computed(() => {
  const y = calYear.value, m = calMonth.value
  const firstDay = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0)
  let startWeekday = firstDay.getDay() - 1 // Mon=0
  if (startWeekday < 0) startWeekday = 6
  const days: CalDay[] = []

  // 空白填充
  for (let i = 0; i < startWeekday; i++) days.push(EMPTY_DAY)

  const todayStr = fmt(new Date())
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = fmt(new Date(y, m - 1, d))
    days.push({
      date,
      day: d,
      isToday: date === todayStr,
      items: calItems.value.filter((item) => {
        const t = item.sent_at || item.scheduled_at || item.created_at
        return t && fmt(new Date(t)) === date
      }),
    })
  }
  return days
})

const selectedDayItems = computed(() => {
  if (!selectedDate.value) return []
  return calItems.value.filter((item) => {
    const t = item.sent_at || item.scheduled_at || item.created_at
    return t && fmt(new Date(t)) === selectedDate.value
  })
})

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => { store.loadDailyMoments() })

function switchTab(tab: string) {
  activeTab.value = tab as 'moments' | 'calendar' | 'groups'
  if (tab === 'moments') store.loadDailyMoments()
  else if (tab === 'calendar') loadCalendar()
  else store.loadGroupContents(filterGroupType.value || undefined)
}

async function loadCalendar() {
  const res = await fetchMomentsCalendar(calYear.value, calMonth.value)
  calItems.value = res.items
}

function prevMonth() {
  if (calMonth.value === 1) { calMonth.value = 12; calYear.value-- }
  else calMonth.value--
  selectedDate.value = ''
  loadCalendar()
}

function nextMonth() {
  if (calMonth.value === 12) { calMonth.value = 1; calYear.value++ }
  else calMonth.value++
  selectedDate.value = ''
  loadCalendar()
}

function selectDay(day: CalDay) {
  if (!day.date) return
  selectedDate.value = selectedDate.value === day.date ? '' : day.date
}

function dotClass(item: MomentsContent): string {
  if (item.status === 'sent') return 'dot-sent'
  if (item.status === 'scheduled') return 'dot-scheduled'
  return 'dot-draft'
}

function typeBadgeClass(type: string): string {
  if (type === 'professional') return 'badge-blue'
  if (type === 'life') return 'badge-green'
  return 'badge-orange'
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
}

async function handleMarkSent(m: MomentsContent) {
  await store.markSent(m.id)
  if (activeTab.value === 'calendar') loadCalendar()
}

function openEngagement(m: MomentsContent) {
  engagementMomentId.value = m.id
  engagementForm.value = { likes: 0, comments: 0 }
  showEngagementModal.value = true
}

function openSchedule(m: MomentsContent) {
  scheduleForm.value = { id: m.id, scheduled_at: m.scheduled_at ? m.scheduled_at.slice(0, 16) : '' }
  showScheduleModal.value = true
}

async function submitSchedule() {
  await scheduleMoment(scheduleForm.value.id, {
    scheduled_at: scheduleForm.value.scheduled_at ? new Date(scheduleForm.value.scheduled_at).toISOString() : null,
    status: scheduleForm.value.scheduled_at ? 'scheduled' : 'draft',
  })
  showScheduleModal.value = false
  store.loadDailyMoments()
}

async function submitEngagement() {
  await store.recordEngagement(engagementMomentId.value, engagementForm.value)
  showEngagementModal.value = false
}

async function handleGenerate() {
  if (!filterGroupType.value) return
  await store.generateGroup(filterGroupType.value)
}

function formatTime(d: string): string {
  return new Date(d).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.private-domain { padding: var(--space-5); }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-3); }
.page-title { margin: 0; font-size: var(--font-size-xl); }
.toolbar-actions { display: flex; align-items: center; gap: var(--space-2); }
.tabs { display: flex; gap: var(--space-1); }
.tab { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-sm); }
.tab.active { background: var(--color-primary); color: var(--color-bg); border-color: var(--color-primary); }
.filters { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); align-items: center; }
.input { padding: 6px var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-sm); }
.btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-sm); }
.btn-primary { background: var(--color-primary); color: var(--color-bg); border-color: var(--color-primary); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 3px 10px; font-size: var(--font-size-xs); }
.btn-link { background: none; border: none; color: var(--color-primary); cursor: pointer; padding: 2px 6px; font-size: var(--font-size-sm); }
.loading-wrapper { text-align: center; padding: var(--space-8); color: var(--color-text-tertiary); }
.empty-state { text-align: center; padding: 60px var(--space-5); }
.empty-text { color: var(--color-text-tertiary); margin-bottom: var(--space-3); }
.moments-list { display: flex; flex-direction: column; gap: var(--space-3); }
.moment-card { border: 1px solid var(--color-border-light); border-radius: var(--radius); overflow: hidden; }
.moment-header { padding: 10px 14px; background: var(--color-bg-tertiary); display: flex; align-items: center; gap: var(--space-2); }
.moment-time { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.moment-body { padding: 14px; font-size: var(--font-size-base); line-height: 1.8; white-space: pre-wrap; }
.moment-suggestion { padding: 0 14px 10px; font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-style: italic; }
.moment-title { padding: var(--space-3) 14px 0; font-weight: 600; font-size: var(--font-size-base); }
.moment-actions { padding: var(--space-2) 14px; border-top: 1px solid var(--color-border-light); display: flex; gap: var(--space-3); }
.badge { display: inline-block; padding: 2px var(--space-2); border-radius: var(--radius-sm); font-size: var(--font-size-xs); color: var(--color-bg); }
.badge-blue { background: var(--color-primary); } .badge-green { background: var(--color-success); } .badge-orange { background: var(--color-warning); } .badge-gray { background: var(--color-text-disabled); }

/* 日历排期 */
.calendar-nav { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
.calendar-title { font-size: var(--font-size-lg); font-weight: 600; min-width: 120px; text-align: center; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--color-border-light); border-radius: var(--radius); overflow: hidden; margin-bottom: var(--space-4); }
.cal-header { padding: 8px 0; text-align: center; font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-tertiary); }
.cal-cell { min-height: 72px; padding: 6px 8px; background: var(--color-bg); cursor: pointer; transition: background 0.15s; }
.cal-cell:hover { background: var(--color-primary-light); }
.cal-empty { background: var(--color-bg-secondary); cursor: default; }
.cal-empty:hover { background: var(--color-bg-secondary); }
.cal-today .cal-date { background: var(--color-primary); color: #fff; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
.cal-selected { background: var(--color-primary-light); outline: 2px solid var(--color-primary); outline-offset: -2px; }
.cal-date { font-size: var(--font-size-sm); font-weight: 500; margin-bottom: 4px; }
.cal-dots { display: flex; gap: 3px; }
.cal-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-sent { background: var(--color-success); }
.dot-scheduled { background: var(--color-primary); }
.dot-draft { background: var(--color-text-disabled); }
.cal-detail { margin-top: var(--space-3); }
.cal-detail-title { font-size: var(--font-size-md); font-weight: 600; margin: 0 0 var(--space-3); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--color-bg); border-radius: var(--radius); padding: var(--space-6); max-width: 90vw; box-shadow: var(--shadow-lg); }
.modal-title { margin: 0 0 var(--space-4); font-size: var(--font-size-lg); }
.form-group { margin-bottom: var(--space-3); }
.form-group label { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
</style>
