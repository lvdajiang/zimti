<template>
  <div class="crm">
    <div class="toolbar">
      <h2 class="page-title">客户管理</h2>
      <div class="toolbar-actions">
        <div class="tabs">
          <button class="tab" :class="{ active: activeTab === 'customers' }" @click="switchTab('customers')">客户列表</button>
          <button class="tab" :class="{ active: activeTab === 'templates' }" @click="switchTab('templates')">话术模板</button>
          <button class="tab" :class="{ active: activeTab === 'funnel' }" @click="switchTab('funnel')">漏斗统计</button>
          <button class="tab" :class="{ active: activeTab === 'reminders' }" @click="switchTab('reminders')">跟进提醒</button>
          <button class="tab" :class="{ active: activeTab === 'health' }" @click="switchTab('health')">健康度</button>
          <button class="tab" :class="{ active: activeTab === 'today' }" @click="switchTab('today')">今日触达</button>
          <button class="tab" :class="{ active: activeTab === 'funnel_analysis' }" @click="switchTab('funnel_analysis')">漏斗分析</button>
          <button class="tab" :class="{ active: activeTab === 'referral' }" @click="switchTab('referral')">推荐管理</button>
        </div>
      </div>
    </div>

    <!-- 客户列表 -->
    <template v-if="activeTab === 'customers'">
      <div class="filters">
        <input v-model="store.filterKeyword" class="input" placeholder="搜索姓名/微信/电话..." style="width: 200px" @keyup.enter="search" />
        <select v-model="store.filterStage" class="input" style="width: 130px" @change="search">
          <option value="">全部阶段</option>
          <option v-for="(label, key) in CUSTOMER_STAGE_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <select v-model="store.filterIntent" class="input" style="width: 110px" @change="search">
          <option value="">全部意向</option>
          <option v-for="(label, key) in INTENT_LEVEL_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <button class="btn-warning" @click="showSilent">沉默客户</button>
        <button class="btn-primary" @click="openCreateModal">+ 新增客户</button>
      </div>

      <div v-if="store.loading" class="loading-wrapper">加载中...</div>
      <table v-else-if="store.customers.length > 0" class="data-table">
        <thead>
          <tr>
            <th>姓名</th><th>阶段</th><th>意向</th><th>来源</th><th>微信</th><th>标签</th><th>最后跟进</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in store.customers" :key="c.id">
            <td class="name-cell">
              <span class="health-dot" :class="'dot-' + quickHealth(c.last_follow_up_at)"></span>
              {{ c.name }}
            </td>
            <td><span class="badge" :class="'badge-' + stageColor(c.stage)">{{ CUSTOMER_STAGE_LABELS[c.stage as CustomerStage] }}</span></td>
            <td>{{ INTENT_LEVEL_LABELS[c.intent_level as IntentLevel] || '-' }}</td>
            <td><span class="tag tag-blue" v-if="c.source_type && c.source_type !== 'manual'">{{ sourceLabel(c.source_type) }}</span><span v-else>-</span></td>
            <td>{{ c.wechat || '-' }}</td>
            <td><span v-for="t in c.tags" :key="t.id" class="tag-chip">{{ t.tag }}</span></td>
            <td>{{ formatDate(c.last_follow_up_at) }}</td>
            <td class="actions-cell">
              <button class="btn-link" @click="openEditModal(c)">编辑</button>
              <button class="btn-link" @click="openStageModal(c)">阶段</button>
              <button class="btn-link" @click="openTagModal(c)">标签</button>
              <button class="btn-link btn-danger" @click="handleDelete(c.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state"><div class="empty-text">暂无客户数据</div></div>

      <div v-if="store.total > store.pageSize" class="pagination">
        <button :disabled="store.currentPage <= 1" @click="store.currentPage--; store.loadCustomers()">上一页</button>
        <span class="page-info">{{ store.currentPage }} / {{ Math.ceil(store.total / store.pageSize) }}</span>
        <button :disabled="store.currentPage >= Math.ceil(store.total / store.pageSize)" @click="store.currentPage++; store.loadCustomers()">下一页</button>
      </div>
    </template>

    <!-- 话术模板 -->
    <template v-if="activeTab === 'templates'">
      <div class="filters">
        <select v-model="templateStage" class="input" style="width: 150px" @change="loadTemplates">
          <option value="">全部阶段</option>
          <option v-for="(label, key) in CUSTOMER_STAGE_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <button class="btn-primary" :disabled="store.templatesGenerating" @click="handleGenerate">
          {{ store.templatesGenerating ? '生成中...' : 'AI 生成话术' }}
        </button>
      </div>
      <div v-if="store.templatesLoading" class="loading-wrapper">加载中...</div>
      <div v-else-if="store.chatTemplates.length === 0" class="empty-state"><div class="empty-text">暂无话术模板</div></div>
      <div v-else class="card-grid">
        <div v-for="t in store.chatTemplates" :key="t.id" class="card">
          <div class="card-header">
            <span class="badge badge-blue">{{ CHAT_TEMPLATE_CATEGORY_LABELS[t.category as ChatTemplateCategory] || t.category }}</span>
            <span class="badge badge-gray">{{ t.stage }}</span>
            <span v-if="t.effectiveness_score" class="score">有效率 {{ t.effectiveness_score }}%</span>
          </div>
          <div class="card-body">{{ t.content }}</div>
        </div>
      </div>
    </template>

    <!-- 漏斗统计 -->
    <template v-if="activeTab === 'funnel'">
      <div v-if="store.funnelLoading" class="loading-wrapper">加载中...</div>
      <div v-else class="funnel">
        <div v-for="(count, stage) in store.funnelStats" :key="stage" class="funnel-row">
          <span class="funnel-label">{{ CUSTOMER_STAGE_LABELS[stage as CustomerStage] }}</span>
          <div class="funnel-bar-wrapper">
            <div class="funnel-bar" :class="'funnel-' + stageColor(stage as string)" :style="{ width: funnelWidth(count) + '%' }"></div>
          </div>
          <span class="funnel-count">{{ count }}</span>
        </div>
      </div>
    </template>

    <!-- 跟进提醒 -->
    <template v-if="activeTab === 'reminders'">
      <div class="filters">
        <button class="btn-primary" @click="showReminderModal = true">+ 创建提醒</button>
      </div>
      <div v-if="store.remindersLoading" class="loading-wrapper">加载中...</div>
      <table v-else-if="store.followUpReminders.length > 0" class="data-table">
        <thead><tr><th>客户</th><th>提醒时间</th><th>消息</th></tr></thead>
        <tbody>
          <tr v-for="r in store.followUpReminders" :key="r.id">
            <td>{{ r.customer?.name }}</td>
            <td>{{ formatDate(r.remind_at) }}</td>
            <td>{{ r.message || '-' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state"><div class="empty-text">暂无跟进提醒</div></div>
    </template>

    <!-- 健康度 -->
    <template v-if="activeTab === 'health'">
      <div class="filters">
        <select v-model="healthFilter" class="input" style="width: 120px" @change="store.loadContactHealth(healthFilter ? { health: healthFilter } : undefined)">
          <option value="">全部</option>
          <option v-for="(label, key) in CONTACT_HEALTH_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <button class="btn-primary" :disabled="store.wakeGenerating || selectedHealthIds.length === 0" @click="handleBatchWake">
          {{ store.wakeGenerating ? '生成中...' : '批量唤醒' }}
        </button>
      </div>
      <div v-if="store.healthLoading" class="loading-wrapper">加载中...</div>
      <template v-else>
        <!-- 唤醒话术结果 -->
        <div v-if="store.wakeScripts.length > 0" class="wake-scripts">
          <div v-for="s in store.wakeScripts" :key="s.customerId" class="wake-card card">
            <div class="wake-name">{{ s.name }}</div>
            <div class="wake-script">{{ s.script }}</div>
            <button class="btn-link" @click="copyText(s.script)">复制</button>
          </div>
        </div>
        <table v-if="store.contactHealthList.length > 0" class="data-table">
          <thead><tr><th><input type="checkbox" @change="toggleAllHealth" /></th><th>状态</th><th>姓名</th><th>阶段</th><th>沉默天数</th></tr></thead>
          <tbody>
            <tr v-for="h in store.contactHealthList" :key="h.id">
              <td><input type="checkbox" :value="h.id" v-model="selectedHealthIds" /></td>
              <td><span class="health-indicator" :class="'hi-' + h.health">{{ healthIcon(h.health) }}</span></td>
              <td class="name-cell">{{ h.name }}</td>
              <td><span class="badge" :class="'badge-' + stageColor(h.stage)">{{ CUSTOMER_STAGE_LABELS[h.stage as CustomerStage] || h.stage }}</span></td>
              <td>{{ h.daysSinceContact != null ? h.daysSinceContact + '天' : '-' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state"><div class="empty-text">暂无健康度数据</div></div>
      </template>
    </template>

    <!-- 今日触达 -->
    <template v-if="activeTab === 'today'">
      <div class="filters">
        <button class="btn" @click="touchPointStore.loadTodayTasks()">刷新</button>
      </div>
      <div v-if="touchPointStore.loading" class="loading-wrapper">加载中...</div>
      <table v-else-if="touchPointStore.todayTasks.length > 0" class="data-table">
        <thead><tr><th>客户</th><th>触达类型</th><th>内容摘要</th><th>时间</th></tr></thead>
        <tbody>
          <tr v-for="t in touchPointStore.todayTasks" :key="t.id">
            <td>{{ t.customer?.name || t.customer_id }}</td>
            <td><span class="tag tag-blue">{{ TOUCH_POINT_TYPE_LABELS[t.touch_type] }}</span></td>
            <td>{{ t.content_summary }}</td>
            <td>{{ formatDate(t.created_at) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state"><div class="empty-text">今日暂无触达任务</div></div>
    </template>

    <!-- 漏斗分析 -->
    <template v-if="activeTab === 'funnel_analysis'">
      <div class="filters">
        <button class="btn-primary" @click="store.loadFunnelAnalysis()">刷新分析</button>
      </div>
      <div v-if="store.funnelAnalysisLoading" class="loading-wrapper">分析中...</div>
      <div v-else-if="store.funnelAnalysis" class="funnel-analysis">
        <div class="analysis-summary">
          <div class="summary-card card">
            <div class="summary-value">{{ store.funnelAnalysis.totalCustomers }}</div>
            <div class="summary-label">总客户数</div>
          </div>
          <div class="summary-card card" v-if="store.funnelAnalysis.bottleneck.stage">
            <div class="summary-value">{{ CUSTOMER_STAGE_LABELS[store.funnelAnalysis.bottleneck.stage as CustomerStage] }}</div>
            <div class="summary-label">瓶颈阶段（转化率 {{ Math.round(store.funnelAnalysis.bottleneck.rate * 100) }}%）</div>
          </div>
        </div>
        <div class="funnel-chart">
          <div v-for="s in store.funnelAnalysis.stages" :key="s.stage" class="funnel-row">
            <span class="funnel-label">{{ CUSTOMER_STAGE_LABELS[s.stage as CustomerStage] }}</span>
            <div class="funnel-bar-wrapper">
              <div class="funnel-bar" :class="'funnel-' + stageColor(s.stage)" :style="{ width: (store.funnelAnalysis ? s.count / Math.max(...store.funnelAnalysis.stages.map(x => x.count), 1) * 100 : 0) + '%' }"></div>
            </div>
            <span class="funnel-count">{{ s.count }}</span>
            <span class="funnel-rate">{{ Math.round(s.conversionRate * 100) }}%</span>
            <span class="funnel-days">{{ s.avgDays > 0 ? s.avgDays + '天' : '' }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state"><div class="empty-text">点击「刷新分析」查看漏斗分析</div></div>
    </template>

    <!-- 推荐管理 -->
    <template v-if="activeTab === 'referral'">
      <div class="filters">
        <select v-model="referralFilter" class="input" style="width: 120px" @change="referralStore.loadReferrals(referralFilter ? { status: referralFilter } : undefined)">
          <option value="">全部状态</option>
          <option v-for="(label, key) in REFERRAL_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <button class="btn-primary" @click="referralStore.loadStats()">刷新统计</button>
      </div>
      <!-- 统计卡片 -->
      <div v-if="referralStore.stats" class="referral-stats">
        <div class="summary-card card"><div class="summary-value">{{ referralStore.stats.total }}</div><div class="summary-label">总推荐</div></div>
        <div class="summary-card card"><div class="summary-value">{{ referralStore.stats.converted }}</div><div class="summary-label">已转化</div></div>
        <div class="summary-card card"><div class="summary-value">{{ referralStore.stats.pending }}</div><div class="summary-label">待转化</div></div>
      </div>
      <!-- 推荐排行 -->
      <div v-if="referralStore.stats?.topReferrers?.length" class="top-referrers">
        <h4 class="section-subtitle">推荐排行</h4>
        <div v-for="(r, idx) in referralStore.stats.topReferrers" :key="r.id" class="referrer-item">
          <span class="referrer-rank">{{ idx + 1 }}</span>
          <span class="referrer-name">{{ r.name }}</span>
          <span class="referrer-count">{{ r.count }} 次</span>
          <button class="btn btn-sm btn-primary" @click="handleGenCode(r.id)">生成推荐码</button>
        </div>
      </div>
      <!-- 推荐码展示 -->
      <div v-if="referralStore.referralCode" class="referral-code card">
        <div class="code-text">{{ referralStore.referralCode.referralText }}</div>
        <div class="code-link">{{ referralStore.referralCode.shareLink }}</div>
        <button class="btn-link" @click="copyText(referralStore.referralCode.referralText)">复制</button>
      </div>
      <!-- 推荐列表 -->
      <div v-if="referralStore.loading" class="loading-wrapper">加载中...</div>
      <table v-else-if="referralStore.referrals.length > 0" class="data-table">
        <thead><tr><th>推荐人</th><th>来源</th><th>状态</th><th>时间</th></tr></thead>
        <tbody>
          <tr v-for="r in referralStore.referrals" :key="r.id">
            <td>{{ r.referrer_customer_id?.slice(0, 8) }}...</td>
            <td><span class="tag tag-blue">{{ REFERRAL_SOURCE_TYPE_LABELS[r.source_type as ReferralSourceType] }}</span></td>
            <td><span class="badge" :class="'badge-' + referralStatusColor(r.status)">{{ REFERRAL_STATUS_LABELS[r.status as ReferralStatus] }}</span></td>
            <td>{{ formatDate(r.created_at) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state"><div class="empty-text">暂无推荐记录</div></div>
    </template>

    <!-- 新增/编辑客户弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <h3 class="modal-title">{{ editingId ? '编辑客户' : '新增客户' }}</h3>
        <div class="form-group"><label>姓名 *</label><input v-model="form.name" class="input" placeholder="客户姓名" /></div>
        <div class="form-row">
          <div class="form-group"><label>电话</label><input v-model="form.phone" class="input" /></div>
          <div class="form-group"><label>微信</label><input v-model="form.wechat" class="input" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>阶段</label>
            <select v-model="form.stage" class="input">
              <option v-for="(label, key) in CUSTOMER_STAGE_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="form-group"><label>意向等级</label>
            <select v-model="form.intent_level" class="input">
              <option v-for="(label, key) in INTENT_LEVEL_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>备注</label><textarea v-model="form.notes" class="input" rows="3"></textarea></div>
        <div class="form-group"><label>标签（逗号分隔）</label><input v-model="form.tags" class="input" placeholder="如：新疆团,高端客户" /></div>
        <div class="modal-actions">
          <button class="btn" @click="showCreateModal = false">取消</button>
          <button class="btn-primary" @click="handleSave">保存</button>
        </div>
      </div>
    </div>

    <!-- 阶段变更弹窗 -->
    <div v-if="showStageModal" class="modal-overlay" @click.self="showStageModal = false">
      <div class="modal">
        <h3 class="modal-title">变更阶段</h3>
        <p>当前: <span class="badge" :class="'badge-' + stageColor(editingCustomer?.stage || '')">{{ CUSTOMER_STAGE_LABELS[editingCustomer?.stage as CustomerStage] }}</span></p>
        <div class="form-group"><label>目标阶段</label>
          <select v-model="stageForm.stage" class="input">
            <option v-for="(label, key) in CUSTOMER_STAGE_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div class="form-group"><label>备注</label><textarea v-model="stageForm.note" class="input" rows="2"></textarea></div>
        <div class="modal-actions">
          <button class="btn" @click="showStageModal = false">取消</button>
          <button class="btn-primary" @click="handleStageChange">确认变更</button>
        </div>
      </div>
    </div>

    <!-- 标签弹窗 -->
    <div v-if="showTagModal" class="modal-overlay" @click.self="showTagModal = false">
      <div class="modal">
        <h3 class="modal-title">管理标签</h3>
        <div class="tags-area">
          <span v-for="t in editingCustomer?.tags" :key="t.id" class="tag-chip removable" @click="handleRemoveTag(t.tag)">{{ t.tag }} &times;</span>
        </div>
        <div class="form-row">
          <input v-model="newTag" class="input" placeholder="新标签" style="flex:1" @keyup.enter="handleAddTag" />
          <button class="btn-primary" @click="handleAddTag">添加</button>
        </div>
        <div class="modal-actions"><button class="btn" @click="showTagModal = false">关闭</button></div>
      </div>
    </div>

    <!-- 跟进提醒弹窗 -->
    <div v-if="showReminderModal" class="modal-overlay" @click.self="showReminderModal = false">
      <div class="modal">
        <h3 class="modal-title">创建跟进提醒</h3>
        <div class="form-group"><label>客户 ID *</label><input v-model="reminderForm.customer_id" class="input" /></div>
        <div class="form-group"><label>提醒时间 *</label><input v-model="reminderForm.remind_at" type="datetime-local" class="input" /></div>
        <div class="form-group"><label>消息</label><textarea v-model="reminderForm.message" class="input" rows="2"></textarea></div>
        <div class="modal-actions">
          <button class="btn" @click="showReminderModal = false">取消</button>
          <button class="btn-primary" @click="handleCreateReminder">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCrmStore } from '../stores/crm'
import { useTouchPointStore } from '../stores/touchPoint'
import { useReferralStore } from '../stores/referral'
import {
  CUSTOMER_STAGE_LABELS, INTENT_LEVEL_LABELS, CHAT_TEMPLATE_CATEGORY_LABELS,
  CONTACT_HEALTH_LABELS, TOUCH_POINT_TYPE_LABELS, REFERRAL_STATUS_LABELS,
  REFERRAL_SOURCE_TYPE_LABELS,
} from '@zimti/shared'
import type { Customer } from '../api/crm'
import type { CustomerStage, IntentLevel, ChatTemplateCategory, ContactHealth, ReferralSourceType, ReferralStatus } from '@zimti/shared'

const store = useCrmStore()
const touchPointStore = useTouchPointStore()
const referralStore = useReferralStore()
const activeTab = ref('customers')

// 客户表单
const showCreateModal = ref(false)
const editingId = ref('')
const form = ref({ name: '', phone: '', wechat: '', stage: 'new_friend' as CustomerStage, intent_level: 'medium' as IntentLevel, notes: '', tags: '' })

// 阶段变更
const showStageModal = ref(false)
const editingCustomer = ref<Customer | null>(null)
const stageForm = ref({ stage: '' as string, note: '' })

// 标签
const showTagModal = ref(false)
const newTag = ref('')

// 模板
const templateStage = ref('')

// 提醒
const showReminderModal = ref(false)
const reminderForm = ref({ customer_id: '', remind_at: '', message: '' })

// 健康度
const healthFilter = ref<ContactHealth | ''>('')
const selectedHealthIds = ref<string[]>([])

// 推荐管理
const referralFilter = ref('')

onMounted(() => {
  store.loadCustomers()
  store.loadFunnelStats()
  store.loadReminders()
  store.loadContactHealth()
})

function switchTab(tab: string) {
  activeTab.value = tab
  if (tab === 'customers') store.loadCustomers()
  else if (tab === 'templates') loadTemplates()
  else if (tab === 'funnel') store.loadFunnelStats()
  else if (tab === 'reminders') store.loadReminders()
  else if (tab === 'health') store.loadContactHealth(healthFilter.value ? { health: healthFilter.value } : undefined)
  else if (tab === 'today') touchPointStore.loadTodayTasks()
  else if (tab === 'funnel_analysis') store.loadFunnelAnalysis()
  else if (tab === 'referral') { referralStore.loadReferrals(); referralStore.loadStats() }
}

function search() { store.currentPage = 1; store.loadCustomers() }
function showSilent() { store.loadSilentCustomers() }
function loadTemplates() { store.loadChatTemplates(templateStage.value || undefined) }

function openCreateModal() {
  editingId.value = ''
  form.value = { name: '', phone: '', wechat: '', stage: 'new_friend', intent_level: 'medium', notes: '', tags: '' }
  showCreateModal.value = true
}

function openEditModal(c: Customer) {
  editingId.value = c.id
  form.value = {
    name: c.name, phone: c.phone ?? '', wechat: c.wechat ?? '',
    stage: c.stage, intent_level: c.intent_level, notes: c.notes ?? '',
    tags: c.tags?.map((t) => t.tag).join(',') || '',
  }
  showCreateModal.value = true
}

async function handleSave() {
  if (!form.value.name) return
  const tags = form.value.tags ? form.value.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : undefined
  if (editingId.value) {
    await store.editCustomer(editingId.value, {
      name: form.value.name, phone: form.value.phone || undefined, wechat: form.value.wechat || undefined,
      intent_level: form.value.intent_level, notes: form.value.notes || undefined,
    })
  } else {
    await store.addCustomer({
      name: form.value.name, phone: form.value.phone || undefined, wechat: form.value.wechat || undefined,
      stage: form.value.stage, intent_level: form.value.intent_level, notes: form.value.notes || undefined, tags,
    })
  }
  showCreateModal.value = false
}

async function handleDelete(id: string) { if (confirm('确认删除？')) await store.removeCustomer(id) }

function openStageModal(c: Customer) {
  editingCustomer.value = c
  stageForm.value = { stage: c.stage, note: '' }
  showStageModal.value = true
}

async function handleStageChange() {
  if (!editingCustomer.value) return
  await store.changeStage(editingCustomer.value.id, stageForm.value.stage as CustomerStage, stageForm.value.note || undefined)
  showStageModal.value = false
}

function openTagModal(c: Customer) { editingCustomer.value = c; newTag.value = ''; showTagModal.value = true }

async function handleAddTag() {
  if (!editingCustomer.value || !newTag.value.trim()) return
  await store.addTags(editingCustomer.value.id, [newTag.value.trim()])
  const updated = store.customers.find((c) => c.id === editingCustomer.value!.id)
  if (updated) editingCustomer.value = updated
  newTag.value = ''
}

async function handleRemoveTag(tag: string) {
  if (!editingCustomer.value) return
  await store.removeTag(editingCustomer.value.id, tag)
  const updated = store.customers.find((c) => c.id === editingCustomer.value!.id)
  if (updated) editingCustomer.value = updated
}

async function handleGenerate() {
  if (!templateStage.value) { alert('请先选择阶段'); return }
  await store.generateTemplates(templateStage.value)
}

async function handleCreateReminder() {
  if (!reminderForm.value.customer_id || !reminderForm.value.remind_at) return
  await store.createReminder(reminderForm.value)
  await store.loadReminders()
  showReminderModal.value = false
  reminderForm.value = { customer_id: '', remind_at: '', message: '' }
}

// 健康度
function healthIcon(health: string): string {
  const map: Record<string, string> = { healthy: '🟢', attention: '🟡', at_risk: '🔴', lost: '⚫' }
  return map[health] || '⚪'
}

function toggleAllHealth(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  selectedHealthIds.value = checked ? store.contactHealthList.map((h) => h.id) : []
}

async function handleBatchWake() {
  if (selectedHealthIds.value.length === 0) return
  await store.generateWakeScripts(selectedHealthIds.value)
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
}

// 推荐管理
async function handleGenCode(customerId: string) {
  await referralStore.generateCode(customerId)
}

function referralStatusColor(status: string): string {
  const map: Record<string, string> = { pending: 'orange', converted: 'green', expired: 'gray' }
  return map[status] || 'gray'
}

// 辅助
function sourceLabel(type: string): string {
  const map: Record<string, string> = {
    video: '视频', referral: '推荐', group_chat: '群聊', poster: '海报', group_invite: '社群',
  }
  return map[type] || type
}

function quickHealth(lastFollowUp: string | null): string {
  if (!lastFollowUp) return 'lost'
  const days = Math.floor((Date.now() - new Date(lastFollowUp).getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 7) return 'healthy'
  if (days <= 30) return 'attention'
  if (days <= 90) return 'at_risk'
  return 'lost'
}

function stageColor(stage: string): string {
  const map: Record<string, string> = {
    new_friend: 'blue', chatting: 'green', deep_consult: 'purple', hesitating: 'orange',
    ordered: 'pink', traveling: 'cyan', completed: 'green', repurchase: 'red',
  }
  return map[stage] || 'gray'
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const maxFunnel = ref(1)
function funnelWidth(count: number): number {
  const c = count as number
  if (c > maxFunnel.value) maxFunnel.value = c
  return maxFunnel.value > 0 ? (c / maxFunnel.value) * 100 : 0
}
</script>

<style scoped>
.crm { padding: var(--space-5); }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-3); }
.page-title { margin: 0; font-size: var(--font-size-xl); }
.toolbar-actions { display: flex; align-items: center; gap: var(--space-2); }
.tabs { display: flex; gap: var(--space-1); flex-wrap: wrap; }
.tab { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-sm); }
.tab.active { background: var(--color-primary); color: var(--color-bg); border-color: var(--color-primary); }
.filters { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); flex-wrap: wrap; align-items: center; }
.input { padding: 6px var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-sm); }
textarea.input { resize: vertical; font-family: inherit; }
.btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-sm); }
.btn-primary { background: var(--color-primary); color: var(--color-bg); border-color: var(--color-primary); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-warning { background: var(--color-warning); color: var(--color-bg); border-color: var(--color-warning); }
.btn-danger { color: var(--color-danger); }
.btn-link { background: none; border: none; color: var(--color-primary); cursor: pointer; padding: 2px 6px; font-size: var(--font-size-sm); }
.btn-sm { padding: 3px 10px; font-size: var(--font-size-xs); }
.data-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.data-table th, .data-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-light); text-align: left; }
.data-table th { font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-tertiary); }
.name-cell { font-weight: 500; cursor: pointer; }
.actions-cell { white-space: nowrap; }
.badge { display: inline-block; padding: 2px var(--space-2); border-radius: var(--radius-sm); font-size: var(--font-size-xs); color: var(--color-bg); }
.badge-blue { background: var(--color-primary); } .badge-green { background: var(--color-success); } .badge-gray { background: var(--color-text-tertiary); }
.badge-orange { background: var(--color-warning); } .badge-red { background: var(--color-danger); } .badge-pink { background: #eb2f96; }
.badge-purple { background: #722ed1; } .badge-cyan { background: #13c2c2; }
.tag-chip { display: inline-block; padding: 1px var(--space-2); background: var(--color-border-light); border-radius: var(--radius-sm); font-size: var(--font-size-xs); margin: 2px 4px 2px 0; }
.tag-chip.removable { cursor: pointer; background: var(--color-primary-light); }
.tag-chip.removable:hover { background: var(--color-primary-hover); }
.loading-wrapper { text-align: center; padding: var(--space-8); color: var(--color-text-tertiary); }
.empty-state { text-align: center; padding: 60px var(--space-5); }
.empty-text { color: var(--color-text-tertiary); margin-bottom: var(--space-3); }
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-3); margin-top: var(--space-4); font-size: var(--font-size-sm); }
.page-info { color: var(--color-text-secondary); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--color-bg); border-radius: var(--radius); padding: var(--space-6); width: 480px; max-width: 90vw; max-height: 80vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
.modal-title { margin: 0 0 var(--space-4); font-size: var(--font-size-lg); }
.form-group { margin-bottom: var(--space-3); }
.form-group label { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
.form-row { display: flex; gap: var(--space-3); }
.form-row .form-group { flex: 1; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-3); }
.card { border: 1px solid var(--color-border-light); border-radius: var(--radius); overflow: hidden; }
.card-header { padding: 10px 14px; background: var(--color-bg-tertiary); display: flex; align-items: center; gap: var(--space-2); }
.card-body { padding: 14px; font-size: var(--font-size-sm); line-height: 1.6; white-space: pre-wrap; }
.score { margin-left: auto; font-size: var(--font-size-xs); color: var(--color-success); }
.tags-area { margin-bottom: var(--space-3); }
/* 漏斗 */
.funnel { max-width: 600px; margin: 0 auto; }
.funnel-row { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2); }
.funnel-label { width: 80px; text-align: right; font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.funnel-bar-wrapper { flex: 1; height: 28px; background: var(--color-border-light); border-radius: var(--radius-sm); overflow: hidden; }
.funnel-bar { height: 100%; border-radius: var(--radius-sm); transition: width var(--transition-slow); min-width: 4px; }
.funnel-count { width: 40px; font-size: var(--font-size-sm); font-weight: 600; }
.funnel-rate { width: 45px; font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.funnel-days { width: 50px; font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.funnel-new_friend { background: var(--color-primary); } .funnel-chatting { background: var(--color-success); } .funnel-deep_consult { background: #722ed1; }
.funnel-hesitating { background: var(--color-warning); } .funnel-ordered { background: #eb2f96; } .funnel-traveling { background: #13c2c2; }
.funnel-completed { background: var(--color-success); } .funnel-repurchase { background: var(--color-danger); }
/* 健康度 */
.health-dot { display: inline-block; width: 8px; height: 8px; border-radius: var(--radius-round); margin-right: var(--space-1); }
.dot-healthy { background: var(--color-success); }
.dot-attention { background: var(--color-warning); }
.dot-at_risk { background: var(--color-danger); }
.dot-lost { background: var(--color-text-tertiary); }
.health-indicator { font-size: var(--font-size-sm); }
.hi-healthy { color: var(--color-success); }
.hi-attention { color: var(--color-warning); }
.hi-at_risk { color: var(--color-danger); }
.hi-lost { color: var(--color-text-tertiary); }
.wake-scripts { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); }
.wake-card { padding: var(--space-3); }
.wake-name { font-weight: 600; margin-bottom: var(--space-1); }
.wake-script { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
/* 漏斗分析 */
.funnel-analysis { max-width: 700px; margin: 0 auto; }
.analysis-summary { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
.summary-card { padding: var(--space-4); text-align: center; flex: 1; }
.summary-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); }
.summary-label { font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: var(--space-1); }
/* 推荐管理 */
.referral-stats { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
.top-referrers { margin-bottom: var(--space-4); }
.section-subtitle { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin: 0 0 var(--space-2); }
.referrer-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-light); }
.referrer-rank { width: 20px; height: 20px; border-radius: var(--radius-round); background: var(--color-primary); color: var(--color-bg); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; }
.referrer-name { flex: 1; font-size: var(--font-size-sm); }
.referrer-count { font-size: var(--font-size-sm); color: var(--color-text-tertiary); }
.referral-code { padding: var(--space-4); text-align: center; margin-bottom: var(--space-4); }
.code-text { font-size: var(--font-size-base); font-weight: 500; margin-bottom: var(--space-2); }
.code-link { font-size: var(--font-size-sm); color: var(--color-primary); margin-bottom: var(--space-2); }
</style>
