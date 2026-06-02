<template>
  <div class="group-chat">
    <div class="toolbar">
      <h2 class="page-title">群聊分析</h2>
    </div>

    <!-- 上传区域 -->
    <div class="upload-section card" v-if="!store.currentAnalysis">
      <div
        class="upload-zone"
        :class="{ dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div class="upload-icon">+</div>
        <div class="upload-text">拖拽 .txt 群聊记录文件到此处，或点击上传</div>
        <div class="upload-hint">支持导出的微信群聊 .txt 文件</div>
      </div>
      <input ref="fileInput" type="file" accept=".txt" style="display: none" @change="handleFileSelect" />
      <div v-if="store.uploading" class="loading-wrapper">分析中，请稍候...</div>
    </div>

    <!-- 分析报告 -->
    <template v-if="store.currentAnalysis">
      <div class="report-header">
        <div class="report-info">
          <span class="report-group">{{ store.currentAnalysis.group_name }}</span>
          <span class="report-meta">{{ store.currentAnalysis.lead_count }} 条线索 / {{ store.currentAnalysis.message_count }} 条消息</span>
        </div>
        <button class="btn" @click="store.currentAnalysis = null">返回上传</button>
      </div>

      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'leads' }" @click="activeTab = 'leads'">潜在线索</button>
        <button class="tab" :class="{ active: activeTab === 'topics' }" @click="activeTab = 'topics'">热门话题</button>
        <button class="tab" :class="{ active: activeTab === 'pain' }" @click="activeTab = 'pain'">用户痛点</button>
        <button class="tab" :class="{ active: activeTab === 'price' }" @click="activeTab = 'price'">价格区间</button>
      </div>

      <!-- 潜在线索 -->
      <template v-if="activeTab === 'leads'">
        <table v-if="store.currentAnalysis.report.leads.length > 0" class="data-table">
          <thead>
            <tr><th>昵称</th><th>意向</th><th>上下文</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="(lead, idx) in store.currentAnalysis.report.leads" :key="idx">
              <td class="name-cell">{{ lead.name }}</td>
              <td><span class="tag" :class="intentTagClass(lead.intent)">{{ lead.intent }}</span></td>
              <td class="context-cell">{{ lead.context }}</td>
              <td>
                <button class="btn btn-primary btn-sm" @click="handleImportLead(lead)">导入CRM</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <div class="empty-text">未识别到潜在线索</div>
        </div>
      </template>

      <!-- 热门话题 -->
      <template v-if="activeTab === 'topics'">
        <div v-if="store.currentAnalysis.report.hotTopics.length > 0" class="topics-list">
          <div v-for="(topic, idx) in store.currentAnalysis.report.hotTopics" :key="idx" class="topic-item">
            <span class="topic-rank">{{ idx + 1 }}</span>
            <span class="topic-word">{{ topic.word }}</span>
            <span class="topic-count">{{ topic.count }} 次</span>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-text">未识别到热门话题</div>
        </div>
      </template>

      <!-- 用户痛点 -->
      <template v-if="activeTab === 'pain'">
        <div v-if="store.currentAnalysis.report.painPoints.length > 0" class="pain-list">
          <div v-for="(point, idx) in store.currentAnalysis.report.painPoints" :key="idx" class="pain-item">
            <span class="pain-bullet">&#x2022;</span>
            <span>{{ point }}</span>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-text">未识别到用户痛点</div>
        </div>
      </template>

      <!-- 价格区间 -->
      <template v-if="activeTab === 'price'">
        <div v-if="store.currentAnalysis.report.priceRange" class="price-range card">
          <div class="price-label">讨论价格区间</div>
          <div class="price-values">
            <span class="price-min">{{ store.currentAnalysis.report.priceRange.min }}</span>
            <span class="price-sep">~</span>
            <span class="price-max">{{ store.currentAnalysis.report.priceRange.max }}</span>
            <span class="price-unit">{{ store.currentAnalysis.report.priceRange.currency || '元' }}</span>
          </div>
        </div>
        <div v-else class="empty-state">
          <div class="empty-text">未识别到价格讨论</div>
        </div>
      </template>
    </template>

    <!-- 历史分析列表 -->
    <template v-if="!store.currentAnalysis">
      <h3 class="section-title">历史分析</h3>
      <div v-if="store.loading" class="loading-wrapper">加载中...</div>
      <table v-else-if="store.analyses.length > 0" class="data-table">
        <thead>
          <tr><th>群名称</th><th>线索数</th><th>消息数</th><th>分析时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="a in store.analyses" :key="a.id">
            <td class="name-cell">{{ a.group_name }}</td>
            <td>{{ a.lead_count }}</td>
            <td>{{ a.message_count }}</td>
            <td>{{ formatDate(a.created_at) }}</td>
            <td>
              <button class="btn-link" @click="store.loadAnalysis(a.id)">查看</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <div class="empty-text">暂无群聊分析记录，请上传文件开始分析</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGroupChatStore } from '../stores/groupChat'
import { createCustomer } from '../api/crm'
import type { GroupChatLead } from '../api/groupChat'

const store = useGroupChatStore()
const activeTab = ref('leads')
const dragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  store.loadAnalyses()
})

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  await uploadAndAnalyze(file)
}

async function handleDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  await uploadAndAnalyze(file)
}

async function uploadAndAnalyze(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('group_name', file.name.replace('.txt', ''))
  try {
    const result = await store.uploadFile(formData)
    store.currentAnalysis = result
    activeTab.value = 'leads'
  } catch {
    // 错误已由 API 层 toast 处理
  }
}

async function handleImportLead(lead: GroupChatLead) {
  try {
    await createCustomer({
      name: lead.name,
      source_type: 'group_chat',
      notes: lead.context,
    })
    alert(`${lead.name} 已导入 CRM`)
  } catch {
    // 错误已由 API 层 toast 处理
  }
}

function intentTagClass(intent: string): string {
  if (intent.includes('高') || intent.includes('强')) return 'tag-red'
  if (intent.includes('中') || intent.includes('一般')) return 'tag-orange'
  return 'tag-blue'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.group-chat { padding: var(--space-5); }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
.page-title { margin: 0; font-size: var(--font-size-xl); }
.upload-section { margin-bottom: var(--space-5); }
.upload-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-8) var(--space-5);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.upload-zone:hover,
.upload-zone.dragging {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
.upload-icon { font-size: 36px; color: var(--color-text-tertiary); margin-bottom: var(--space-2); }
.upload-text { font-size: var(--font-size-base); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
.upload-hint { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}
.report-group { font-size: var(--font-size-lg); font-weight: 600; }
.report-meta { font-size: var(--font-size-sm); color: var(--color-text-tertiary); margin-left: var(--space-3); }
.report-info { display: flex; align-items: baseline; gap: var(--space-2); }
.tabs { display: flex; gap: var(--space-1); margin-bottom: var(--space-4); }
.tab {
  padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--color-bg); cursor: pointer; font-size: var(--font-size-sm);
}
.tab.active { background: var(--color-primary); color: var(--color-bg); border-color: var(--color-primary); }
.context-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name-cell { font-weight: 500; }
.section-title { font-size: var(--font-size-md); margin: var(--space-5) 0 var(--space-3); color: var(--color-text-secondary); }
.topics-list { display: flex; flex-direction: column; gap: var(--space-2); }
.topic-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
}
.topic-rank {
  width: 24px; height: 24px; border-radius: var(--radius-round);
  background: var(--color-primary); color: var(--color-bg);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--font-size-xs); font-weight: 600;
}
.topic-word { flex: 1; font-size: var(--font-size-base); }
.topic-count { font-size: var(--font-size-sm); color: var(--color-text-tertiary); }
.pain-list { display: flex; flex-direction: column; gap: var(--space-2); }
.pain-item {
  display: flex; align-items: flex-start; gap: var(--space-2);
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
}
.pain-bullet { color: var(--color-danger); font-size: var(--font-size-lg); line-height: 1; flex-shrink: 0; }
.price-range { text-align: center; padding: var(--space-6); }
.price-label { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-3); }
.price-values { display: flex; align-items: baseline; justify-content: center; gap: var(--space-2); }
.price-min, .price-max { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); }
.price-sep { font-size: var(--font-size-lg); color: var(--color-text-tertiary); }
.price-unit { font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.loading-wrapper { text-align: center; padding: var(--space-8); color: var(--color-text-tertiary); }
.empty-state { text-align: center; padding: 60px var(--space-5); }
.empty-text { color: var(--color-text-tertiary); margin-bottom: var(--space-3); }
</style>
