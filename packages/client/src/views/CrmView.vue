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
            <th>姓名</th><th>阶段</th><th>意向</th><th>微信</th><th>标签</th><th>最后跟进</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in store.customers" :key="c.id">
            <td class="name-cell">{{ c.name }}</td>
            <td><span class="badge" :class="'badge-' + stageColor(c.stage)">{{ CUSTOMER_STAGE_LABELS[c.stage as CustomerStage] }}</span></td>
            <td>{{ INTENT_LEVEL_LABELS[c.intent_level as IntentLevel] || '-' }}</td>
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
import { CUSTOMER_STAGE_LABELS, INTENT_LEVEL_LABELS, CHAT_TEMPLATE_CATEGORY_LABELS } from '@zimti/shared'
import type { Customer } from '../api/crm'
import type { CustomerStage, IntentLevel, ChatTemplateCategory } from '@zimti/shared'

const store = useCrmStore()
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

onMounted(() => {
  store.loadCustomers()
  store.loadFunnelStats()
  store.loadReminders()
})

function switchTab(tab: string) {
  activeTab.value = tab
  if (tab === 'customers') store.loadCustomers()
  else if (tab === 'templates') loadTemplates()
  else if (tab === 'funnel') store.loadFunnelStats()
  else if (tab === 'reminders') store.loadReminders()
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
.crm { padding: 20px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.page-title { margin: 0; font-size: 20px; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
.tabs { display: flex; gap: 4px; }
.tab { padding: 6px 14px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.tab.active { background: #1890ff; color: #fff; border-color: #1890ff; }
.filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.input { padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 13px; }
textarea.input { resize: vertical; font-family: inherit; }
.btn { padding: 6px 14px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-warning { background: #fa8c16; color: #fff; border-color: #fa8c16; }
.btn-danger { color: #ff4d4f; }
.btn-link { background: none; border: none; color: #1890ff; cursor: pointer; padding: 2px 6px; font-size: 13px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; text-align: left; }
.data-table th { font-weight: 600; color: #666; background: #fafafa; }
.name-cell { font-weight: 500; cursor: pointer; }
.actions-cell { white-space: nowrap; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #fff; }
.badge-blue { background: #1890ff; } .badge-green { background: #52c41a; } .badge-gray { background: #999; }
.badge-orange { background: #fa8c16; } .badge-red { background: #ff4d4f; } .badge-pink { background: #eb2f96; }
.badge-purple { background: #722ed1; } .badge-cyan { background: #13c2c2; }
.tag-chip { display: inline-block; padding: 1px 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px; margin: 2px 4px 2px 0; }
.tag-chip.removable { cursor: pointer; background: #e6f7ff; }
.tag-chip.removable:hover { background: #bae7ff; }
.loading-wrapper { text-align: center; padding: 40px; color: #999; }
.empty-state { text-align: center; padding: 60px 20px; }
.empty-text { color: #999; margin-bottom: 12px; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; font-size: 13px; }
.page-info { color: #666; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; padding: 24px; width: 480px; max-width: 90vw; max-height: 80vh; overflow-y: auto; }
.modal-title { margin: 0 0 16px; font-size: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; color: #666; margin-bottom: 4px; }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.card { border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; }
.card-header { padding: 10px 14px; background: #fafafa; display: flex; align-items: center; gap: 8px; }
.card-body { padding: 14px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
.score { margin-left: auto; font-size: 12px; color: #52c41a; }
.tags-area { margin-bottom: 12px; }
.funnel { max-width: 600px; margin: 0 auto; }
.funnel-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.funnel-label { width: 80px; text-align: right; font-size: 13px; color: #666; }
.funnel-bar-wrapper { flex: 1; height: 28px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
.funnel-bar { height: 100%; border-radius: 4px; transition: width 0.3s; min-width: 4px; }
.funnel-count { width: 40px; font-size: 13px; font-weight: 600; }
.funnel-new_friend { background: #1890ff; } .funnel-chatting { background: #52c41a; } .funnel-deep_consult { background: #722ed1; }
.funnel-hesitating { background: #fa8c16; } .funnel-ordered { background: #eb2f96; } .funnel-traveling { background: #13c2c2; }
.funnel-completed { background: #52c41a; } .funnel-repurchase { background: #ff4d4f; }
</style>
