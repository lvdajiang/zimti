<template>
  <div class="operation-calendar">
    <div class="toolbar">
      <h2 class="page-title">运营日历</h2>
      <div class="toolbar-actions">
        <button class="btn" @click="prevMonth">&lt;</button>
        <span class="month-label">{{ year }}年{{ month }}月</span>
        <button class="btn" @click="nextMonth">&gt;</button>
        <button class="btn" @click="goToday">今天</button>
        <button class="btn-primary" @click="openAddModal">+ 添加事件</button>
      </div>
    </div>

    <!-- 日历网格 -->
    <div v-if="store.loading" class="loading-wrapper">加载中...</div>
    <div v-else class="calendar-grid">
      <!-- 星期头 -->
      <div v-for="d in weekDays" :key="d" class="cal-header">{{ d }}</div>
      <!-- 空白占位 -->
      <div v-for="n in firstDayOffset" :key="'empty-' + n" class="cal-cell empty"></div>
      <!-- 日期格子 -->
      <div
        v-for="day in daysInMonth"
        :key="day"
        class="cal-cell"
        :class="{ today: isToday(day), selected: selectedDay === day }"
        @click="selectDay(day)"
      >
        <div class="cal-date">{{ day }}</div>
        <div class="cal-events">
          <div
            v-for="ev in getEventsForDay(day)"
            :key="ev.id"
            class="cal-event"
            :class="'event-' + ev.event_type"
            :title="ev.title"
          >
            <span class="event-dot"></span>
            <span class="event-title">{{ ev.title }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 选中日期的事件详情 -->
    <div v-if="selectedDay" class="day-detail card">
      <div class="day-detail-header">
        <h3>{{ month }}月{{ selectedDay }}日 事件</h3>
      </div>
      <div v-if="getEventsForDay(selectedDay).length === 0" class="empty-state">
        <div class="empty-text">当日无事件</div>
      </div>
      <div v-for="ev in getEventsForDay(selectedDay)" :key="ev.id" class="event-card">
        <div class="event-card-header">
          <span class="tag" :class="'tag-' + eventTypeColor(ev.event_type)">{{ CALENDAR_EVENT_TYPE_LABELS[ev.event_type] }}</span>
          <span class="event-time" v-if="ev.remind_at">提醒: {{ formatDate(ev.remind_at) }}</span>
        </div>
        <div class="event-card-title">{{ ev.title }}</div>
        <div v-if="ev.content" class="event-card-content">
          <div v-if="ev.content.moments_plan"><strong>朋友圈计划:</strong> {{ ev.content.moments_plan }}</div>
          <div v-if="ev.content.chat_script"><strong>私聊话术:</strong> {{ ev.content.chat_script }}</div>
          <div v-if="ev.content.campaign_plan"><strong>活动方案:</strong> {{ ev.content.campaign_plan }}</div>
        </div>
        <div class="event-card-actions">
          <button class="btn-link" @click="handleDeleteEvent(ev.id)">删除</button>
        </div>
      </div>
    </div>

    <!-- 添加事件弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3 class="modal-title">添加事件</h3>
        <div class="form-group">
          <label>日期 *</label>
          <input v-model="eventForm.event_date" type="date" class="input" />
        </div>
        <div class="form-group">
          <label>标题 *</label>
          <input v-model="eventForm.title" class="input" placeholder="事件标题" />
        </div>
        <div class="form-group">
          <label>类型</label>
          <select v-model="eventForm.event_type" class="input">
            <option v-for="(label, key) in CALENDAR_EVENT_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>朋友圈计划</label>
          <textarea v-model="eventForm.moments_plan" class="input" rows="2" placeholder="当日朋友圈内容规划"></textarea>
        </div>
        <div class="form-group">
          <label>私聊话术</label>
          <textarea v-model="eventForm.chat_script" class="input" rows="2" placeholder="当日私聊话术"></textarea>
        </div>
        <div class="form-group">
          <label>提醒时间</label>
          <input v-model="eventForm.remind_at" type="datetime-local" class="input" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showAddModal = false">取消</button>
          <button class="btn-primary" @click="handleAddEvent">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useOperationCalendarStore } from '../stores/operationCalendar'
import { CALENDAR_EVENT_TYPE_LABELS } from '@zimti/shared'
import type { CalendarEventType } from '@zimti/shared'

const store = useOperationCalendarStore()

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const selectedDay = ref<number | null>(null)
const showAddModal = ref(false)

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const eventForm = ref({
  event_date: '',
  title: '',
  event_type: 'content_plan' as CalendarEventType,
  moments_plan: '',
  chat_script: '',
  remind_at: '',
})

onMounted(() => {
  store.loadEventsByMonth(year.value, month.value)
})

watch([year, month], () => {
  store.loadEventsByMonth(year.value, month.value)
  selectedDay.value = null
})

// 当月天数
const daysInMonth = computed(() => {
  return new Date(year.value, month.value, 0).getDate()
})

// 第一天是星期几（0=日）
const firstDayOffset = computed(() => {
  return new Date(year.value, month.value - 1, 1).getDay()
})

function isToday(day: number): boolean {
  const today = new Date()
  return today.getFullYear() === year.value && today.getMonth() + 1 === month.value && today.getDate() === day
}

function getEventsForDay(day: number) {
  const dateStr = `${year.value}-${String(month.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return store.events.filter((e) => e.event_date.startsWith(dateStr))
}

function selectDay(day: number) {
  selectedDay.value = selectedDay.value === day ? null : day
}

function prevMonth() {
  if (month.value === 1) { year.value--; month.value = 12 }
  else { month.value-- }
}

function nextMonth() {
  if (month.value === 12) { year.value++; month.value = 1 }
  else { month.value++ }
}

function goToday() {
  const today = new Date()
  year.value = today.getFullYear()
  month.value = today.getMonth() + 1
  selectedDay.value = today.getDate()
}

function openAddModal() {
  const today = new Date()
  const dateStr = selectedDay.value
    ? `${year.value}-${String(month.value).padStart(2, '0')}-${String(selectedDay.value).padStart(2, '0')}`
    : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  eventForm.value = {
    event_date: dateStr,
    title: '',
    event_type: 'content_plan',
    moments_plan: '',
    chat_script: '',
    remind_at: '',
  }
  showAddModal.value = true
}

async function handleAddEvent() {
  if (!eventForm.value.event_date || !eventForm.value.title) return
  const content: Record<string, string> = {}
  if (eventForm.value.moments_plan) content.moments_plan = eventForm.value.moments_plan
  if (eventForm.value.chat_script) content.chat_script = eventForm.value.chat_script
  await store.addEvent({
    event_date: eventForm.value.event_date,
    title: eventForm.value.title,
    event_type: eventForm.value.event_type,
    content: Object.keys(content).length > 0 ? content : undefined,
    remind_at: eventForm.value.remind_at || undefined,
  })
  showAddModal.value = false
  await store.loadEventsByMonth(year.value, month.value)
}

async function handleDeleteEvent(id: string) {
  if (confirm('确认删除此事件？')) {
    await store.removeEvent(id)
    await store.loadEventsByMonth(year.value, month.value)
  }
}

function eventTypeColor(type: string): string {
  const map: Record<string, string> = { holiday: 'blue', campaign: 'orange', content_plan: 'green', reminder: 'red' }
  return map[type] || 'blue'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.operation-calendar { padding: var(--space-5); }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-3); }
.page-title { margin: 0; font-size: var(--font-size-xl); }
.toolbar-actions { display: flex; align-items: center; gap: var(--space-2); }
.month-label { font-size: var(--font-size-md); font-weight: 600; min-width: 100px; text-align: center; }
/* 日历网格 */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: var(--color-border-light);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius);
  overflow: hidden;
}
.cal-header {
  background: var(--color-bg-tertiary);
  padding: var(--space-2);
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}
.cal-cell {
  background: var(--color-bg);
  min-height: 100px;
  padding: var(--space-1);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.cal-cell:hover { background: var(--color-primary-light); }
.cal-cell.today .cal-date {
  background: var(--color-primary);
  color: var(--color-bg);
  border-radius: var(--radius-round);
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
}
.cal-cell.selected { outline: 2px solid var(--color-primary); outline-offset: -2px; }
.cal-cell.empty { background: var(--color-bg-secondary); cursor: default; }
.cal-date { font-size: var(--font-size-sm); font-weight: 500; margin-bottom: var(--space-1); color: var(--color-text); }
.cal-events { display: flex; flex-direction: column; gap: 2px; }
.cal-event {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; padding: 1px 4px;
  border-radius: 2px; overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis;
}
.event-dot { width: 6px; height: 6px; border-radius: var(--radius-round); flex-shrink: 0; }
.event-title { overflow: hidden; text-overflow: ellipsis; }
.event-holiday { background: #e6f7ff; color: #1890ff; }
.event-holiday .event-dot { background: #1890ff; }
.event-campaign { background: #fffbe6; color: #d48806; }
.event-campaign .event-dot { background: #faad14; }
.event-content_plan { background: #f6ffed; color: #389e0d; }
.event-content_plan .event-dot { background: #52c41a; }
.event-reminder { background: #fff1f0; color: #cf1322; }
.event-reminder .event-dot { background: #ff4d4f; }
/* 日期详情 */
.day-detail { margin-top: var(--space-4); }
.day-detail-header { margin-bottom: var(--space-3); }
.day-detail-header h3 { margin: 0; font-size: var(--font-size-md); }
.event-card {
  padding: var(--space-3);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
}
.event-card-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); }
.event-card-title { font-weight: 500; margin-bottom: var(--space-1); }
.event-card-content { font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.event-card-content div { margin-bottom: var(--space-1); }
.event-card-actions { display: flex; justify-content: flex-end; }
.event-time { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.loading-wrapper { text-align: center; padding: var(--space-8); color: var(--color-text-tertiary); }
.empty-state { text-align: center; padding: var(--space-4); }
.empty-text { color: var(--color-text-tertiary); font-size: var(--font-size-sm); }
/* 弹窗 & 表单 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--color-bg); border-radius: var(--radius); padding: var(--space-6); width: 480px; max-width: 90vw; max-height: 80vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
.modal-title { margin: 0 0 var(--space-4); font-size: var(--font-size-lg); }
.form-group { margin-bottom: var(--space-3); }
.form-group label { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
.input { width: 100%; padding: 6px var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-sm); box-sizing: border-box; }
textarea.input { resize: vertical; font-family: inherit; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
.btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-sm); }
.btn-primary { background: var(--color-primary); color: var(--color-bg); border-color: var(--color-primary); }
.btn-link { background: none; border: none; color: var(--color-primary); cursor: pointer; padding: 2px 6px; font-size: var(--font-size-sm); }
.btn-sm { padding: 3px 10px; font-size: var(--font-size-xs); }
</style>
