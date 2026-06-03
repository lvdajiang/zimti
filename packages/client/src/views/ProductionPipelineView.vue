<template>
  <div class="production-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <h2 class="page-title">生产流水线</h2>
      <span class="toolbar-hint">脚本 → 配音 → 画面 → 字幕 → 发布，一站完成</span>
      <div class="toolbar-actions">
        <button v-if="!store.jobId" class="btn btn-primary" @click="handleNewJob">新建任务</button>
        <button v-else class="btn" @click="handleReset">新建任务</button>
      </div>
    </div>

    <!-- 无任务：入口面板 -->
    <div v-if="!store.jobId" class="entry-panel">
      <div class="entry-card">
        <div class="entry-icon">🎬</div>
        <h3>开始生产视频</h3>
        <p>从脚本编写到多平台发布，一条流水线搞定</p>
        <div class="form-group">
          <label>视频标题</label>
          <input v-model="newTitle" class="input" placeholder="例如：新疆旅行 7 天攻略" />
        </div>
        <div v-if="store.templates.length > 0" class="form-group">
          <label>从模板创建（可选）</label>
          <select v-model="selectedTemplateId" class="input">
            <option value="">空白开始</option>
            <option v-for="t in store.templates" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>视频类型</label>
            <select v-model="newVideoType" class="input">
              <option value="knowledge">知识科普</option>
              <option value="story">故事叙述</option>
              <option value="list">清单列举</option>
              <option value="contrast">对比评测</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>脚本内容（可选，也可在下一步编写）</label>
          <textarea v-model="newFullText" class="input textarea" rows="4" placeholder="粘贴或输入脚本内容..." />
        </div>
        <button class="btn btn-primary btn-lg" :disabled="!newTitle.trim() || store.loading" @click="handleCreate">
          {{ store.loading ? '创建中...' : '开始生产' }}
        </button>
      </div>
    </div>

    <!-- 有任务：步骤式工作区 -->
    <template v-else>
      <!-- 步骤条 -->
      <div class="stepper">
        <div
          v-for="(s, i) in stepList"
          :key="s.step"
          class="step-item"
          :class="{
            active: store.currentStep === s.step,
            completed: store.isStepCompleted(s.step),
            clickable: store.canAdvanceTo(s.step) || store.isStepCompleted(s.step),
          }"
          @click="handleStepClick(s.step)"
        >
          <div class="step-dot">
            <span v-if="store.isStepCompleted(s.step)" class="step-check">✓</span>
            <span v-else-if="store.steps[s.step - 1]?.status === 'running'" class="step-spinner">⏳</span>
            <span v-else>{{ s.step }}</span>
          </div>
          <span class="step-label">{{ s.label }}</span>
          <div v-if="i < stepList.length - 1" class="step-line" />
        </div>
      </div>

      <!-- 面板区 -->
      <div class="panel-area">
        <ScriptPanel v-if="store.currentStep === 1" />
        <TtsPanel v-else-if="store.currentStep === 2" />
        <VisualPanel v-else-if="store.currentStep === 3" />
        <SubtitlePanel v-else-if="store.currentStep === 4" />
        <PublishPanel v-else-if="store.currentStep === 5" />
      </div>

      <!-- 底部操作栏 -->
      <div class="bottom-bar">
        <button class="btn" :disabled="store.currentStep <= 1" @click="prevStep">← 上一步</button>
        <div class="bottom-bar-center">
          <span class="status-text">
            {{ statusLabel }}
          </span>
        </div>
        <button
          class="btn btn-primary"
          :disabled="store.currentStep >= 5 || store.executing"
          @click="nextStep"
        >
          下一步 →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
import { useProductionStore } from '@/stores/production'
import { PRODUCTION_STEPS } from '@zimti/shared'
import ScriptPanel from '@/components/production/ScriptPanel.vue'
import TtsPanel from '@/components/production/TtsPanel.vue'
import VisualPanel from '@/components/production/VisualPanel.vue'
import SubtitlePanel from '@/components/production/SubtitlePanel.vue'
import PublishPanel from '@/components/production/PublishPanel.vue'

const route = useRoute()
const store = useProductionStore()

const stepList = PRODUCTION_STEPS

// 新建表单
const newTitle = ref('')
const newVideoType = ref('knowledge')
const newFullText = ref('')
const selectedTemplateId = ref('')

const statusLabel = computed(() => {
  const cs = store.steps[store.currentStep - 1]
  if (!cs) return ''
  const labels: Record<string, string> = {
    pending: '等待执行',
    running: '执行中...',
    completed: '已完成',
    failed: '执行失败',
  }
  return `步骤 ${store.currentStep}/5 · ${labels[cs.status] || cs.status}`
})

onMounted(async () => {
  store.loadTemplates()
  const jobId = route.params.jobId as string
  if (jobId) {
    await store.loadJob(jobId)
  }
})

function handleNewJob() {
  newTitle.value = ''
  newVideoType.value = 'knowledge'
  newFullText.value = ''
}

async function handleCreate() {
  if (!newTitle.value.trim()) return
  await store.createJob({
    title: newTitle.value.trim(),
    full_text: newFullText.value || undefined,
    video_type: newVideoType.value,
  })
}

function handleReset() {
  store.reset()
}

function handleStepClick(step: number) {
  if (step === store.currentStep) return
  // 如果点击已完成步骤且回退会清除后续数据，需确认
  if (store.isStepCompleted(step)) {
    const hasLaterCompleted = store.steps.slice(step).some(s => s.status === 'completed')
    if (hasLaterCompleted) {
      if (!confirm(`回退到步骤 ${step} 会清除后续步骤的数据，确定要回退吗？`)) return
      store.rollbackToStep(step)
    } else {
      store.goToStep(step)
    }
  } else if (store.canAdvanceTo(step)) {
    store.goToStep(step)
  }
}

// beforeunload 保护
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (store.hasUnsavedChanges) {
    e.preventDefault()
  }
}
onMounted(() => { window.addEventListener('beforeunload', onBeforeUnload) })
onUnmounted(() => { window.removeEventListener('beforeunload', onBeforeUnload) })

// 路由离开确认
onBeforeRouteLeave(() => {
  if (store.hasUnsavedChanges) {
    if (!confirm('有步骤正在执行中，确定要离开吗？')) return false
  }
  return true
})

function prevStep() {
  if (store.currentStep > 1) {
    store.goToStep(store.currentStep - 1)
  }
}

function nextStep() {
  if (store.currentStep < 5) {
    store.goToStep(store.currentStep + 1)
  }
}
</script>

<style scoped>
.production-page {
  padding: var(--page-padding, 20px);
  max-width: 1200px;
  margin: 0 auto;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.toolbar-hint {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.toolbar-actions {
  margin-left: auto;
}

/* 入口面板 */
.entry-panel {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.entry-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 40px;
  max-width: 560px;
  width: 100%;
  text-align: center;
}

.entry-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.entry-card h3 {
  font-size: 20px;
  margin: 0 0 8px;
  color: var(--color-text);
}

.entry-card p {
  color: var(--color-text-secondary);
  margin: 0 0 24px;
  font-size: 14px;
}

.form-group {
  margin-bottom: 16px;
  text-align: left;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
  box-sizing: border-box;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
}

.btn:hover:not(:disabled) {
  background: var(--color-surface-hover, rgba(0,0,0,0.04));
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  background: var(--color-primary);
}

.btn-lg {
  padding: 12px 32px;
  font-size: 16px;
  margin-top: 8px;
}

/* 步骤条 */
.stepper {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  margin-bottom: 24px;
  padding: 20px 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  min-width: 80px;
  cursor: default;
}

.step-item.clickable {
  cursor: pointer;
}

.step-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-secondary);
  background: var(--color-background);
  transition: all 0.2s;
}

.step-item.active .step-dot {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.08);
}

.step-item.completed .step-dot {
  border-color: #10b981;
  background: #10b981;
  color: #fff;
}

.step-check {
  font-size: 16px;
}

.step-spinner {
  font-size: 16px;
}

.step-label {
  margin-top: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.step-item.active .step-label {
  color: var(--color-primary);
  font-weight: 600;
}

.step-item.completed .step-label {
  color: #10b981;
}

.step-line {
  position: absolute;
  top: 18px;
  left: calc(50% + 22px);
  width: calc(100% - 44px);
  height: 2px;
  background: var(--color-border);
}

.step-item.completed + .step-item .step-line,
.step-item.completed .step-line {
  background: #10b981;
}

/* 面板区 */
.panel-area {
  min-height: 400px;
}

/* 底部操作栏 */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  margin-top: 16px;
  border-top: 1px solid var(--color-border);
}

.bottom-bar-center {
  flex: 1;
  text-align: center;
}

.status-text {
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* 通用 */
.loading-wrapper {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .production-page { padding: 12px; }

  .stepper {
    overflow-x: auto;
    justify-content: flex-start;
    padding: 12px;
  }

  .step-item { min-width: 60px; }
  .step-label { font-size: 11px; }
  .step-dot { width: 30px; height: 30px; font-size: 12px; }
  .step-line { top: 15px; left: calc(50% + 18px); width: calc(100% - 36px); }

  .entry-card { padding: 24px; }
  .form-row { flex-direction: column; gap: 0; }

  .bottom-bar { flex-wrap: wrap; gap: 8px; }
}
</style>
