<template>
  <div class="pipeline">
    <div class="toolbar">
      <h2 class="page-title">一键流水线</h2>
    </div>

    <!-- 启动面板 -->
    <h3 class="section-title">启动流水线</h3>
    <div class="card-grid">
      <div v-for="m in modeCards" :key="m.mode" class="pipeline-card" :class="'card-' + m.mode">
        <div class="card-icon">{{ m.icon }}</div>
        <div class="card-info">
          <h4>{{ m.label }}</h4>
          <p>{{ m.desc }}</p>
        </div>
        <button class="btn-primary" @click="openLaunchModal(m.mode)">启动</button>
      </div>
    </div>

    <!-- 今日状态 -->
    <div class="daily-bar">
      <span>今日状态:</span>
      <span v-if="store.dailyLoading">加载中...</span>
      <span v-else-if="store.dailyStatus?.has_run_today" class="badge badge-green">今日已运行</span>
      <span v-else class="badge badge-gray">今日未运行</span>
    </div>

    <!-- 任务列表 -->
    <h3 class="section-title">任务列表</h3>
    <div class="filters">
      <select v-model="store.filterMode" class="input" style="width: 140px" @change="loadJobs">
        <option value="">全部模式</option>
        <option v-for="(label, key) in PIPELINE_MODE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <select v-model="store.filterStatus" class="input" style="width: 130px" @change="loadJobs">
        <option value="">全部状态</option>
        <option v-for="(label, key) in PIPELINE_JOB_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <button class="btn" @click="loadJobs">刷新</button>
    </div>

    <div v-if="store.loading" class="loading-wrapper">加载中...</div>
    <table v-else-if="store.jobs.length > 0" class="data-table">
      <thead><tr><th>模式</th><th>状态</th><th>输入摘要</th><th>输出摘要</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="j in store.jobs" :key="j.id">
          <td><span class="badge badge-blue">{{ PIPELINE_MODE_LABELS[j.mode] }}</span></td>
          <td><span class="badge" :class="'badge-' + statusColor(j.status)">{{ PIPELINE_JOB_STATUS_LABELS[j.status] }}</span></td>
          <td class="summary-cell">{{ summarizeInput(j.input) }}</td>
          <td class="summary-cell">{{ summarizeOutput(j.output) }}</td>
          <td>{{ formatDate(j.created_at) }}</td>
          <td><button class="btn-link" @click="viewDetail(j)">查看详情</button></td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty-state"><div class="empty-text">暂无任务记录</div></div>

    <div v-if="store.total > store.pageSize" class="pagination">
      <button :disabled="store.currentPage <= 1" @click="store.currentPage--; store.loadJobs()">上一页</button>
      <span class="page-info">{{ store.currentPage }} / {{ Math.ceil(store.total / store.pageSize) }}</span>
      <button :disabled="store.currentPage >= Math.ceil(store.total / store.pageSize)" @click="store.currentPage++; store.loadJobs()">下一页</button>
    </div>

    <!-- 爆款翻新弹窗 -->
    <div v-if="showViralModal" class="modal-overlay" @click.self="showViralModal = false">
      <div class="modal">
        <h3 class="modal-title">爆款翻新</h3>
        <div class="form-group"><label>视频链接</label><input v-model="viralForm.video_url" class="input" placeholder="粘贴视频链接（可选）" /></div>
        <div class="form-group"><label>视频文案</label><textarea v-model="viralForm.video_text" class="input" rows="4" placeholder="或直接粘贴视频文案"></textarea></div>
        <div class="modal-actions">
          <button class="btn" @click="showViralModal = false">取消</button>
          <button class="btn-primary" @click="handleViralRemind">开始翻新</button>
        </div>
      </div>
    </div>

    <!-- 热点紧急弹窗 -->
    <div v-if="showHotspotModal" class="modal-overlay" @click.self="showHotspotModal = false">
      <div class="modal">
        <h3 class="modal-title">热点紧急出片</h3>
        <div class="form-group"><label>热点标题 *</label><input v-model="hotspotForm.hotspot_title" class="input" placeholder="热点标题" /></div>
        <div class="form-group"><label>热点描述</label><textarea v-model="hotspotForm.hotspot_desc" class="input" rows="3" placeholder="热点描述（可选）"></textarea></div>
        <div class="modal-actions">
          <button class="btn" @click="showHotspotModal = false">取消</button>
          <button class="btn-primary" @click="handleHotspotRush">紧急出片</button>
        </div>
      </div>
    </div>

    <!-- 客户问题弹窗 -->
    <div v-if="showQuestionModal" class="modal-overlay" @click.self="showQuestionModal = false">
      <div class="modal">
        <h3 class="modal-title">CRM 驱动出片</h3>
        <div class="form-group"><label>客户提问 *</label><textarea v-model="questionForm.question" class="input" rows="4" placeholder="客户提问内容"></textarea></div>
        <div class="modal-actions">
          <button class="btn" @click="showQuestionModal = false">取消</button>
          <button class="btn-primary" @click="handleCustomerQuestion">生成内容</button>
        </div>
      </div>
    </div>

    <!-- 任务详情弹窗 -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal" style="width: 600px;">
        <h3 class="modal-title">任务详情</h3>
        <div v-if="store.jobLoading" class="loading-wrapper">加载中...</div>
        <template v-else-if="store.currentJob">
          <div class="detail-row"><span class="detail-label">模式:</span><span class="badge badge-blue">{{ PIPELINE_MODE_LABELS[store.currentJob.mode] }}</span></div>
          <div class="detail-row"><span class="detail-label">状态:</span><span class="badge" :class="'badge-' + statusColor(store.currentJob.status)">{{ PIPELINE_JOB_STATUS_LABELS[store.currentJob.status] }}</span></div>
          <div v-if="store.currentJob.status === 'waiting_confirm' && (store.currentJob.output as Record<string, unknown>)?.rewritten_text" class="confirm-section">
            <h4>AI 改写结果</h4>
            <div class="rewritten-text">{{ (store.currentJob.output as Record<string, string>).rewritten_text }}</div>
          </div>
          <div class="detail-row"><span class="detail-label">输入:</span><pre class="detail-json">{{ formatJson(store.currentJob.input) }}</pre></div>
          <div class="detail-row"><span class="detail-label">输出:</span><pre class="detail-json">{{ formatJson(store.currentJob.output) }}</pre></div>
          <div v-if="store.currentJob.error" class="detail-row"><span class="detail-label">错误:</span><span class="error-text">{{ store.currentJob.error }}</span></div>
          <div class="detail-row"><span class="detail-label">创建:</span>{{ formatDate(store.currentJob.created_at) }}</div>
        </template>
        <div class="modal-actions"><button class="btn" @click="showDetailModal = false">关闭</button></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePipelineStore } from '../stores/pipeline'
import { PIPELINE_MODE_LABELS, PIPELINE_JOB_STATUS_LABELS } from '@zimti/shared'
import type { PipelineJob } from '../api/pipeline'
import type { PipelineMode } from '@zimti/shared'

const store = usePipelineStore()

const modeCards: { mode: PipelineMode; icon: string; label: string; desc: string }[] = [
  { mode: 'viral_remind', icon: '🔄', label: '爆款翻新', desc: '粘贴爆款视频链接，AI 自动改写为个人风格文案' },
  { mode: 'daily_auto', icon: '📅', label: '每日自动', desc: '每日自动执行内容生产流水线' },
  { mode: 'hotspot_rush', icon: '🔥', label: '热点紧急', desc: '热点紧急出片，第一时间追热点' },
  { mode: 'customer_question', icon: '💬', label: '客户问题', desc: '根据客户提问自动生成内容' },
]

const showViralModal = ref(false)
const showHotspotModal = ref(false)
const showQuestionModal = ref(false)
const showDetailModal = ref(false)

const viralForm = ref({ video_url: '', video_text: '' })
const hotspotForm = ref({ hotspot_title: '', hotspot_desc: '' })
const questionForm = ref({ question: '' })

onMounted(() => { store.loadJobs(); store.loadDailyStatus() })

function loadJobs() { store.currentPage = 1; store.loadJobs() }

function openLaunchModal(mode: PipelineMode) {
  if (mode === 'viral_remind') showViralModal.value = true
  else if (mode === 'hotspot_rush') showHotspotModal.value = true
  else if (mode === 'customer_question') showQuestionModal.value = true
}

async function handleViralRemind() {
  await store.startViralRemind(viralForm.value)
  showViralModal.value = false
  viralForm.value = { video_url: '', video_text: '' }
}

async function handleHotspotRush() {
  if (!hotspotForm.value.hotspot_title) return
  await store.startHotspotRush(hotspotForm.value)
  showHotspotModal.value = false
  hotspotForm.value = { hotspot_title: '', hotspot_desc: '' }
}

async function handleCustomerQuestion() {
  if (!questionForm.value.question) return
  await store.startCustomerQuestion(questionForm.value)
  showQuestionModal.value = false
  questionForm.value = { question: '' }
}

function viewDetail(job: PipelineJob) { store.loadJob(job.id); showDetailModal.value = true }

function summarizeInput(input: unknown): string {
  if (!input) return '-'
  const obj = input as Record<string, unknown>
  if (obj.video_url) return '视频链接'
  if (obj.video_text) return String(obj.video_text).slice(0, 40) + '...'
  if (obj.hotspot_title) return String(obj.hotspot_title)
  if (obj.question) return String(obj.question).slice(0, 40) + '...'
  return JSON.stringify(input).slice(0, 40)
}

function summarizeOutput(output: unknown): string {
  if (!output) return '-'
  const obj = output as Record<string, unknown>
  if (obj.rewritten_text) return String(obj.rewritten_text).slice(0, 40) + '...'
  return JSON.stringify(output).slice(0, 40)
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'gray', running: 'blue', waiting_confirm: 'orange', completed: 'green', failed: 'red', cancelled: 'gray',
  }
  return map[status] || 'gray'
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatJson(data: unknown): string {
  if (!data) return '-'
  return JSON.stringify(data, null, 2)
}
</script>

<style scoped>
.pipeline { padding: var(--space-5); }
.toolbar { margin-bottom: var(--space-4); }
.page-title { margin: 0; font-size: var(--font-size-xl); }
.section-title { margin: var(--space-6) 0 var(--space-3); font-size: var(--font-size-md); color: var(--color-text); }
.card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); margin-bottom: var(--space-5); }
.pipeline-card { display: flex; align-items: center; gap: 14px; padding: var(--space-4); border: 1px solid var(--color-border-light); border-radius: var(--radius); border-left: 4px solid var(--color-primary); }
.pipeline-card.card-daily_auto { border-left-color: #52c41a; }
.pipeline-card.card-hotspot_rush { border-left-color: #ff4d4f; }
.pipeline-card.card-customer_question { border-left-color: #722ed1; }
.card-icon { font-size: 28px; }
.card-info { flex: 1; }
.card-info h4 { margin: 0 0 var(--space-1); font-size: var(--font-size-base); }
.card-info p { margin: 0; font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
.daily-bar { padding: 10px 14px; background: var(--color-bg-secondary); border-radius: var(--radius); font-size: var(--font-size-sm); display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4); }
.filters { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
.input { padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: var(--font-size-sm); }
textarea.input { resize: vertical; font-family: inherit; }
.btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-bg); cursor: pointer; font-size: var(--font-size-sm); }
.btn-primary { background: var(--color-primary); color: var(--color-bg); border-color: var(--color-primary); }
.btn-link { background: none; border: none; color: var(--color-primary); cursor: pointer; padding: 2px 6px; font-size: var(--font-size-sm); }
.badge { display: inline-block; padding: 2px var(--space-2); border-radius: var(--radius-sm); font-size: var(--font-size-xs); color: var(--color-bg); }
.badge-blue { background: var(--color-primary); } .badge-green { background: #52c41a; } .badge-gray { background: var(--color-text-tertiary); }
.badge-orange { background: #fa8c16; } .badge-red { background: #ff4d4f; }
.data-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.data-table th, .data-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-light); text-align: left; }
.data-table th { font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-secondary); }
.summary-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-secondary); font-size: var(--font-size-xs); }
.loading-wrapper { text-align: center; padding: var(--space-10); color: var(--color-text-tertiary); }
.empty-state { text-align: center; padding: var(--space-10); }
.empty-text { color: var(--color-text-tertiary); }
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-3); margin-top: var(--space-4); font-size: var(--font-size-sm); }
.page-info { color: var(--color-text-secondary); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--color-bg); border-radius: var(--radius); padding: var(--space-6); width: 480px; max-width: 90vw; max-height: 80vh; overflow-y: auto; }
.modal-title { margin: 0 0 var(--space-4); font-size: var(--font-size-lg); }
.form-group { margin-bottom: var(--space-3); }
.form-group label { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
.detail-row { margin-bottom: 10px; font-size: var(--font-size-sm); }
.detail-label { display: inline-block; width: 50px; color: var(--color-text-tertiary); }
.detail-json { margin: 0; padding: var(--space-2); background: var(--color-bg-secondary); border-radius: var(--radius-sm); font-size: var(--font-size-xs); overflow-x: auto; max-height: 120px; }
.error-text { color: #ff4d4f; }
.confirm-section { margin: var(--space-3) 0; padding: 14px; background: #f6ffed; border: 1px solid #b7eb8f; border-radius: var(--radius); }
.confirm-section h4 { margin: 0 0 var(--space-2); color: #389e0d; font-size: var(--font-size-sm); }
.rewritten-text { font-size: var(--font-size-base); line-height: 1.8; white-space: pre-wrap; }
</style>
