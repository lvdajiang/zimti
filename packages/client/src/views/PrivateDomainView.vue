<template>
  <div class="private-domain">
    <div class="toolbar">
      <h2 class="page-title">私域运营</h2>
      <div class="toolbar-actions">
        <div class="tabs">
          <button class="tab" :class="{ active: activeTab === 'moments' }" @click="switchTab('moments')">今日朋友圈</button>
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
          </div>
          <div class="moment-body">{{ m.content }}</div>
          <div v-if="m.image_suggestion" class="moment-suggestion">配图建议: {{ m.image_suggestion }}</div>
          <div class="moment-actions">
            <button class="btn-link" @click="copyText(m.content)">复制文案</button>
            <button v-if="!m.sent_at" class="btn-primary btn-sm" @click="handleMarkSent(m)">标记已发送</button>
            <button class="btn-link" @click="openEngagement(m)">录入互动</button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePrivateDomainStore } from '../stores/privateDomain'
import { MOMENTS_CONTENT_TYPE_LABELS, GROUP_TYPE_LABELS } from '@zimti/shared'
import type { MomentsContent } from '../api/privateDomain'
import type { GroupType } from '@zimti/shared'

const store = usePrivateDomainStore()
const activeTab = ref<'moments' | 'groups'>('moments')
const showEngagementModal = ref(false)
const engagementForm = ref({ likes: 0, comments: 0 })
const engagementMomentId = ref('')
const filterGroupType = ref<GroupType | ''>('')

onMounted(() => { store.loadDailyMoments() })

function switchTab(tab: string) {
  activeTab.value = tab as 'moments' | 'groups'
  if (tab === 'moments') store.loadDailyMoments()
  else store.loadGroupContents(filterGroupType.value || undefined)
}

function typeBadgeClass(type: string): string {
  if (type === 'professional') return 'badge-blue'
  if (type === 'life') return 'badge-green'
  return 'badge-orange'
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
}

async function handleMarkSent(m: MomentsContent) { await store.markSent(m.id) }

function openEngagement(m: MomentsContent) {
  engagementMomentId.value = m.id
  engagementForm.value = { likes: 0, comments: 0 }
  showEngagementModal.value = true
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
</script>

<style scoped>
.private-domain { padding: 20px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.page-title { margin: 0; font-size: 20px; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
.tabs { display: flex; gap: 4px; }
.tab { padding: 6px 14px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.tab.active { background: #1890ff; color: #fff; border-color: #1890ff; }
.filters { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.input { padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 13px; }
.btn { padding: 6px 14px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 3px 10px; font-size: 12px; }
.btn-link { background: none; border: none; color: #1890ff; cursor: pointer; padding: 2px 6px; font-size: 13px; }
.loading-wrapper { text-align: center; padding: 40px; color: #999; }
.empty-state { text-align: center; padding: 60px 20px; }
.empty-text { color: #999; margin-bottom: 12px; }
.moments-list { display: flex; flex-direction: column; gap: 12px; }
.moment-card { border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; }
.moment-header { padding: 10px 14px; background: #fafafa; display: flex; align-items: center; gap: 8px; }
.moment-time { font-size: 12px; color: #999; }
.moment-body { padding: 14px; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
.moment-suggestion { padding: 0 14px 10px; font-size: 12px; color: #999; font-style: italic; }
.moment-title { padding: 12px 14px 0; font-weight: 600; font-size: 14px; }
.moment-actions { padding: 8px 14px; border-top: 1px solid #f0f0f0; display: flex; gap: 12px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #fff; }
.badge-blue { background: #1890ff; } .badge-green { background: #52c41a; } .badge-orange { background: #fa8c16; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; padding: 24px; max-width: 90vw; }
.modal-title { margin: 0 0 16px; font-size: 16px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; color: #666; margin-bottom: 4px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
