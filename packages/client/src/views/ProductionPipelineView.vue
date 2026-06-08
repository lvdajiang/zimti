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

    <!-- 无任务：入口面板（保持不变） -->
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

    <!-- 有任务：看板区 -->
    <template v-else>
      <!-- 一键生产按钮 -->
      <div class="auto-run-bar">
        <button
          class="auto-run-btn"
          :class="{ completed: store.isAllCompleted, running: store.executing }"
          :disabled="store.executing || store.isAllCompleted"
          @click="handleAutoRun"
        >
          <template v-if="store.isAllCompleted">✅ 全部完成</template>
          <template v-else-if="store.executing">⏳ 生产中...</template>
          <template v-else>🔥 一键生产</template>
        </button>
        <div class="auto-run-progress">
          {{ completedCount }}/5 步骤完成
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: (completedCount / 5 * 100) + '%' }" />
          </div>
        </div>
      </div>

      <!-- 步骤卡片列表 -->
      <div class="step-cards">
        <div
          v-for="s in stepList"
          :key="s.step"
          class="step-card"
          :class="[
            store.steps[s.step - 1]?.status || 'pending',
            { expanded: expandedSteps.has(s.step) },
          ]"
        >
          <!-- 卡片头部（始终可见） -->
          <div class="step-card-header" @click="toggleStep(s.step)">
            <div class="step-number" :class="store.steps[s.step - 1]?.status">
              <span v-if="store.isStepCompleted(s.step)" class="check">✓</span>
              <span v-else-if="store.steps[s.step - 1]?.status === 'running'" class="spinner">⟳</span>
              <span v-else>{{ s.step }}</span>
            </div>
            <div class="step-meta">
              <span class="step-title">{{ s.label }}</span>
              <span class="step-subtitle">{{ getStepSubtitle(s.step) }}</span>
            </div>
            <div class="step-actions" @click.stop>
              <button
                class="btn btn-sm btn-execute"
                :disabled="!canExecuteStep(s.step)"
                @click="handleExecuteStep(s.step)"
              >
                {{ getExecuteLabel(s.step) }}
              </button>
              <button class="btn-toggle" :class="{ collapsed: !expandedSteps.has(s.step) }">
                {{ expandedSteps.has(s.step) ? '▲' : '▼' }}
              </button>
            </div>
          </div>

          <!-- 卡片内容（折叠/展开） -->
          <div class="step-card-body" :class="{ collapsed: !expandedSteps.has(s.step) }">
            <div class="step-card-body-inner">
              <ScriptPanel v-if="s.step === 1" />
              <TtsPanel v-else-if="s.step === 2" />
              <VisualPanel v-else-if="s.step === 3" />
              <SubtitlePanel v-else-if="s.step === 4" />
              <PublishPanel v-else-if="s.step === 5" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
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

// 展开/折叠状态（用 reactive 确保增删触发视图更新）
const expandedSteps = reactive(new Set<number>())

// 已完成步骤数
const completedCount = computed(() =>
  store.steps.filter(s => s.status === 'completed').length,
)

// 初始化展开状态：展开第一个未完成的步骤
function initExpanded() {
  const firstPending = store.steps.findIndex(s => s.status !== 'completed')
  expandedSteps.clear()
  if (firstPending >= 0) {
    expandedSteps.add(firstPending + 1)
  } else {
    // 全部完成，展开最后一步
    expandedSteps.add(5)
  }
}

// 监听 currentStep 变化（runStep 完成后会自动推进），展开新步骤
watch(() => store.currentStep, (newStep) => {
  expandedSteps.add(newStep)
})

// 监听 jobId 变化，初始化展开状态
watch(() => store.jobId, (id) => {
  if (id) initExpanded()
})

onMounted(async () => {
  store.loadTemplates()
  const jobId = route.params.jobId as string
  // 'new' 或非 UUID 格式不加载，避免 Prisma 报错
  const isUuid = jobId && /^[0-9a-f-]{36}$/i.test(jobId)
  if (isUuid) {
    await store.loadJob(jobId)
    initExpanded()
  }
})

// --- 交互方法 ---

function toggleStep(step: number) {
  if (expandedSteps.has(step)) {
    expandedSteps.delete(step)
  } else {
    expandedSteps.add(step)
  }
}

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
  initExpanded()
}

function handleReset() {
  store.reset()
  expandedSteps.clear()
}

// 判断某步骤是否可执行
function canExecuteStep(step: number): boolean {
  if (store.executing) return false
  if (store.isStepCompleted(step)) return true // 已完成可重新执行
  // 前置步骤必须全部完成
  return store.canAdvanceTo(step)
}

// 获取执行按钮文字
function getExecuteLabel(step: number): string {
  const status = store.steps[step - 1]?.status
  if (status === 'running') return '执行中...'
  if (status === 'completed') return '重新执行'
  if (!store.canAdvanceTo(step) && !store.isStepCompleted(step)) return '等待前置'
  return '执行'
}

// 获取步骤副标题
function getStepSubtitle(step: number): string {
  const status = store.steps[step - 1]?.status
  const labels: Record<string, string> = {
    pending: '等待执行',
    running: '执行中...',
    completed: '已完成',
    failed: '执行失败',
  }
  return labels[status] || ''
}

// 单步执行
async function handleExecuteStep(step: number) {
  // 如果已完成，需要确认是否重新执行
  if (store.isStepCompleted(step) && step < 5) {
    const hasLaterCompleted = store.steps.slice(step).some(s => s.status === 'completed')
    if (hasLaterCompleted) {
      if (!confirm('重新执行此步骤会清除后续步骤的数据，确定吗？')) return
      await store.rollbackToStep(step)
    }
  }
  expandedSteps.add(step)
  await store.runStep(step)
}

// 一键生产
async function handleAutoRun() {
  for (let step = 1; step <= 5; step++) {
    if (store.isStepCompleted(step)) continue
    expandedSteps.add(step)
    try {
      await store.runStep(step)
    } catch {
      expandedSteps.add(step)
      alert(`步骤 ${step}（${stepList[step - 1].label}）执行失败，请检查后重试`)
      break
    }
    if (store.steps[step - 1].status === 'failed') {
      expandedSteps.add(step)
      break
    }
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

/* ===================== 入口面板（保持不变） ===================== */

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
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
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

/* ===================== 一键生产按钮 ===================== */

.auto-run-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  margin-bottom: 16px;
}

.auto-run-btn {
  flex-shrink: 0;
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #FF6B35, #FF8C42);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;
}

.auto-run-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.35);
}

.auto-run-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.auto-run-btn.running {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
}

.auto-run-btn.completed {
  background: linear-gradient(135deg, #10b981, #34d399);
}

.auto-run-progress {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 3px;
  transition: width 0.4s ease;
}

/* ===================== 步骤卡片 ===================== */

.step-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  border-left: 3px solid var(--color-border);
  transition: border-color 0.3s, box-shadow 0.3s;
}

.step-card.running {
  border-left-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.step-card.completed {
  border-left-color: #10b981;
}

.step-card.failed {
  border-left-color: #ef4444;
}

.step-card.pending {
  border-left-color: var(--color-border);
}

/* --- 卡片头部 --- */

.step-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.step-card-header:hover {
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.02));
}

.step-number {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--color-primary);
  transition: background 0.3s;
}

.step-number.completed {
  background: #10b981;
}

.step-number.running {
  background: var(--color-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

.step-number.failed {
  background: #ef4444;
}

.step-number.pending {
  background: var(--color-primary);
}

.check {
  font-size: 14px;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.step-meta {
  flex: 1;
  min-width: 0;
}

.step-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-right: 8px;
}

.step-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.step-card.completed .step-subtitle {
  color: #10b981;
}

.step-card.running .step-subtitle {
  color: var(--color-primary);
}

.step-card.failed .step-subtitle {
  color: #ef4444;
}

.step-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 13px;
  border-radius: 4px;
}

.btn-execute {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.btn-execute:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-execute:disabled {
  background: var(--color-border);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
  opacity: 1;
}

.btn-toggle {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  border-radius: 4px;
  transition: background 0.15s, transform 0.2s;
}

.btn-toggle:hover {
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
}

/* --- 卡片内容（折叠/展开） --- */

.step-card-body {
  max-height: 2000px;
  overflow: hidden;
  transition: max-height 0.4s ease, padding 0.3s ease;
  border-top: 1px solid var(--color-border);
}

.step-card-body.collapsed {
  max-height: 0;
  border-top-color: transparent;
  transition: max-height 0.3s ease, padding 0.2s ease;
}

.step-card-body-inner {
  padding: 16px;
}

/* 让嵌入的 Panel 组件更紧凑 */
.step-card-body-inner > :deep(.script-panel),
.step-card-body-inner > :deep(.tts-panel),
.step-card-body-inner > :deep(.visual-panel),
.step-card-body-inner > :deep(.subtitle-panel),
.step-card-body-inner > :deep(.publish-panel) {
  background: transparent;
  border: none;
  border-radius: 0;
}

/* ===================== 移动端适配 ===================== */

@media (max-width: 768px) {
  .production-page {
    padding: 12px;
  }

  .auto-run-bar {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .auto-run-btn {
    width: 100%;
    text-align: center;
    padding: 12px 16px;
  }

  .step-card-header {
    padding: 10px 12px;
  }

  .step-title {
    font-size: 14px;
  }

  .step-subtitle {
    font-size: 12px;
  }

  .step-number {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .btn-sm {
    padding: 3px 8px;
    font-size: 12px;
  }

  .step-card-body-inner {
    padding: 12px;
  }

  .entry-card {
    padding: 24px;
  }

  .form-row {
    flex-direction: column;
    gap: 0;
  }
}
</style>
