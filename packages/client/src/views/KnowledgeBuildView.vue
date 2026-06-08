<template>
  <div class="kb-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <h2 class="page-title">知识库构建引擎</h2>
      <button class="btn btn-back" @click="router.push('/geo?tab=knowledge')">&larr; 返回知识库</button>
    </div>

    <!-- 模式选择器 -->
    <div class="mode-selector">
      <button
        v-for="(label, key) in MODE_LABELS"
        :key="key"
        class="mode-btn"
        :class="{ active: activeMode === key }"
        @click="switchMode(key as KnowledgeBuildMode)"
      >{{ label }}</button>
    </div>

    <!-- ========== auto / step 模式：输入面板 + 评估方案 + 步骤卡片 ========== -->
    <template v-if="activeMode === 'auto' || activeMode === 'step'">
      <!-- 输入面板 -->
      <div class="card form-card input-panel">
        <div class="form-group">
          <label>主题</label>
          <input v-model="store.buildTopic" class="input" placeholder="输入主题，如：新疆旅游攻略、亲子游注意事项..." @input="handleTopicInput" @keyup.enter="handleStartBuild" />
        </div>
        <!-- 关键词可用提示 -->
        <div v-if="store.availableKeywords.length > 0 && !store.building" class="keyword-hint">
          <span class="hint-icon">🔑</span>
          <span>发现 {{ store.availableKeywords.length }} 个蒸馏关键词可用</span>
          <label class="hint-toggle">
            <input type="checkbox" v-model="store.useDistilledKeywords" />
            使用这些关键词增强构建
          </label>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>分类</label>
            <select v-model="store.buildCategory" class="input">
              <option value="">自动分类</option>
              <option v-for="(label, key) in categoryLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-primary" :disabled="store.building || !store.buildTopic.trim()" @click="handleStartBuild">
              {{ store.building && !store.planConfirmed ? '评估中...' : '🔍 评估主题' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 评估方案面板（evaluation 步骤完成后显示） -->
      <div v-if="showEvaluationPlan" class="card form-card evaluation-plan">
        <div class="plan-header">
          <h3 class="plan-title">📋 构建方案</h3>
          <span class="plan-badge" :class="evaluationPlan?.isLargeTopic ? 'badge-large' : 'badge-small'">
            {{ evaluationPlan?.isLargeTopic ? '大主题 · 先骨架后填充' : '小主题 · 一次完成' }}
          </span>
        </div>

        <div class="plan-stats">
          <div class="stat-item">
            <span class="stat-value">{{ evaluationPlan?.totalDimensions || 0 }}</span>
            <span class="stat-label">维度</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ evaluationPlan?.totalEstimatedItems || 0 }}</span>
            <span class="stat-label">预计条数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ evaluationPlan?.keywordCoverage?.totalKeywordsProvided || 0 }}</span>
            <span class="stat-label">关键词</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">~{{ evaluationPlan?.estimatedTimeMinutes || 0 }}分</span>
            <span class="stat-label">预计时间</span>
          </div>
        </div>

        <!-- 维度-关键词映射列表 -->
        <div class="plan-dimensions">
          <div class="dim-label">维度与关键词：</div>
          <div class="dim-list">
            <div
              v-for="(dim, i) in evaluationPlan?.dimensions || []"
              :key="i"
              class="dim-item"
            >
              <div class="dim-header-row">
                <span class="dim-name">{{ dim.dimension }}</span>
                <span class="dim-badge">~{{ dim.estimatedItems }}条</span>
                <span class="dim-density" :class="'text-' + dim.infoDensity">
                  {{ dim.infoDensity === 'high' ? '高密度' : dim.infoDensity === 'medium' ? '中密度' : '低密度' }}
                </span>
              </div>
              <div class="dim-keywords" v-if="dim.keywords?.length || dim.supplementaryKeywords?.length">
                <span v-for="kw in dim.keywords" :key="kw" class="kw-tag">🔑 {{ kw }}</span>
                <span v-for="kw in dim.supplementaryKeywords" :key="'s'+kw" class="kw-tag supplementary">✨ {{ kw }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 覆盖缺口 -->
        <div v-if="evaluationPlan?.coverageGaps?.length" class="plan-gaps">
          <span class="gap-icon">⚠️</span>
          <span>覆盖缺口：{{ evaluationPlan.coverageGaps.join('、') }}</span>
        </div>

        <!-- 建议 -->
        <div v-if="evaluationPlan?.suggestions?.length" class="plan-suggestions">
          <span v-for="(s, i) in evaluationPlan.suggestions" :key="i" class="suggestion-item">💡 {{ s }}</span>
        </div>

        <!-- 确认/调整按钮 -->
        <div class="plan-actions">
          <button class="btn btn-primary btn-lg" :disabled="store.building" @click="handleConfirmPlan">
            {{ store.building ? '构建中...' : '✅ 确认方案并开始构建' }}
          </button>
          <button class="btn" @click="handleCancelPlan">取消</button>
        </div>
      </div>

      <!-- 构建进度（auto 模式轮询时显示进度条） -->
      <div v-if="store.building && activeMode === 'auto'" class="build-progress">
        <div class="progress-bar"><div class="progress-fill animating"></div></div>
        <div class="progress-text">正在构建「{{ store.currentJob?.topic || store.buildTopic }}」...</div>
      </div>

      <!-- 步骤卡片列表 -->
      <div v-if="store.jobSteps.length > 0" class="step-cards">
        <div
          v-for="step in store.jobSteps"
          :key="step.id"
          class="step-card"
          :class="getStepClass(step.status)"
        >
          <div class="step-card-header">
            <div class="step-number" :class="step.status">
              <span v-if="step.status === 'completed'">&check;</span>
              <span v-else-if="step.status === 'running' || step.status === 'waiting_confirm'" class="spinner">&nearr;</span>
              <span v-else>{{ getStepIndex(getStepType(step)) }}</span>
            </div>
            <span class="step-name">{{ STEP_LABELS[getStepType(step)] }}</span>
            <span class="step-status" :class="step.status">{{ STATUS_LABELS[step.status] || step.status }}</span>
          </div>
          <div v-if="isStepDone(step.status) && step.output" class="step-card-body">
            <div v-if="getStepType(step) === 'evaluation'" class="step-summary">
              评估完成：{{ (step.output as any).totalDimensions || 0 }} 个维度，预计 {{ (step.output as any).totalEstimatedItems || 0 }} 条知识
            </div>
            <div v-else-if="getStepType(step) === 'dimension_split'" class="step-summary">
              拆分出 {{ step.output.dimensions?.length || 0 }} 个维度：
              <span v-for="d in step.output.dimensions" :key="d" class="tag">{{ d }}</span>
            </div>
            <div v-else-if="getStepType(step) === 'search'" class="step-summary">
              搜索到 {{ step.output.total || 0 }} 条结果
            </div>
            <div v-else-if="getStepType(step) === 'credibility'" class="step-summary">
              保留 {{ step.output.report?.passed || 0 }} 条，过滤 {{ step.output.report?.filtered || 0 }} 条
            </div>
            <div v-else-if="getStepType(step) === 'dedup'" class="step-summary">
              合并为 {{ step.output.merged?.length || 0 }} 条（去重 {{ getDedupCount(step) }} 条）
            </div>
            <div v-else-if="getStepType(step) === 'refine'" class="step-summary">
              完善 {{ step.output.refined?.length || 0 }} 条知识
            </div>
            <div v-else-if="getStepType(step) === 'persist'" class="step-summary">
              成功入库 {{ step.output.createdIds?.length || 0 }} 条
            </div>
          </div>
          <!-- 分步确认：等待确认时显示确认按钮 -->
          <div v-if="step.status === 'waiting_confirm'" class="step-confirm">
            <button class="btn btn-primary" @click="handleConfirmStep(step)">&#10003; 确认并继续</button>
          </div>
        </div>

        <!-- 完成提示 -->
        <div v-if="store.currentJob?.status === 'completed'" class="build-done">
          &#127881; 构建完成！共入库 {{ getFinalPersistCount() }} 条知识。
        </div>
        <div v-else-if="store.currentJob?.status === 'failed'" class="build-failed">
          &#10060; 构建失败，请检查步骤或重新构建。
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!store.building" class="empty-state">
        <div class="empty-text">输入主题并点击「开始构建」，引擎将自动拆分维度、搜索、筛选、去重、完善并入库。</div>
      </div>
    </template>

    <!-- ========== scheduled 模式：定时刷新面板 ========== -->
    <template v-if="activeMode === 'scheduled'">
      <div class="schedule-panel">
        <h3 class="section-title">定时刷新任务</h3>

        <!-- 新建定时任务 -->
        <div class="card form-card">
          <div class="form-group">
            <label>主题</label>
            <input v-model="scheduleTopic" class="input" placeholder="如：新疆旅游攻略" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>频率</label>
              <select v-model="scheduleCron" class="input">
                <option value="0 9 * * 1">每周一 9:00</option>
                <option value="0 9 * * *">每天 9:00</option>
                <option value="0 9 1 * *">每月1号 9:00</option>
              </select>
            </div>
            <div class="form-group" style="display:flex;align-items:flex-end">
              <button class="btn btn-primary" :disabled="!scheduleTopic.trim()" @click="handleCreateSchedule">创建定时任务</button>
            </div>
          </div>
        </div>

        <!-- 加载中 -->
        <div v-if="store.schedulesLoading" class="loading-wrapper">加载中...</div>

        <!-- 空状态 -->
        <div v-else-if="store.schedules.length === 0" class="empty-state">
          <div class="empty-text">暂无定时任务，创建一个以定期自动刷新知识库。</div>
        </div>

        <!-- 定时任务列表 -->
        <div v-for="s in store.schedules" :key="s.id" class="card schedule-card">
          <div class="schedule-header">
            <span class="schedule-topic">{{ s.topic }}</span>
            <span class="schedule-cron">{{ s.cron_expr }}</span>
            <span :class="s.is_active ? 'status-active' : 'status-inactive'">{{ s.is_active ? '启用' : '停用' }}</span>
            <span class="schedule-last">上次: {{ s.last_run_at ? formatDate(s.last_run_at) : '从未' }}</span>
          </div>
          <div class="schedule-actions">
            <button class="btn btn-sm btn-primary" @click="handleTriggerSchedule(s.id)">&#9654; 手动触发</button>
            <button class="btn btn-sm" @click="handleToggleSchedule(s)">{{ s.is_active ? '停用' : '启用' }}</button>
            <button class="btn btn-sm btn-danger" @click="handleDeleteSchedule(s.id)">删除</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeBuildStore } from '@/stores/knowledgeBuild'
import {
  KNOWLEDGE_BUILD_STEP_LABELS,
  KNOWLEDGE_BUILD_STATUS_LABELS,
  KNOWLEDGE_BUILD_MODE_LABELS,
  BRAND_KNOWLEDGE_CATEGORY_LABELS,
} from '@zimti/shared'
import type { KnowledgeBuildStepType, KnowledgeBuildMode } from '@zimti/shared'

interface DimensionPlan {
  dimension: string
  description: string
  estimatedItems: number
  infoDensity: 'high' | 'medium' | 'low'
  priority: number
}

interface BuildPlan {
  totalEstimatedItems: number
  totalDimensions: number
  estimatedTimeMinutes: number
  isLargeTopic: boolean
  strategy: 'full' | 'skeleton_then_fill'
  qualityStandard: { minContentLength: number; targetContentLength: number; maxContentLength: number }
  dimensions: DimensionPlan[]
  coverageGaps: string[]
  suggestions: string[]
}

const router = useRouter()
const store = useKnowledgeBuildStore()
const activeMode = ref<KnowledgeBuildMode>('auto')

const STEP_LABELS = KNOWLEDGE_BUILD_STEP_LABELS
const STATUS_LABELS = KNOWLEDGE_BUILD_STATUS_LABELS
const MODE_LABELS = KNOWLEDGE_BUILD_MODE_LABELS
const categoryLabels = BRAND_KNOWLEDGE_CATEGORY_LABELS

const STEP_TYPES: KnowledgeBuildStepType[] = [
  'evaluation', 'dimension_split', 'search', 'credibility', 'dedup', 'refine', 'persist',
]

// 评估方案数据
const evaluationPlan = computed<BuildPlan | null>(() => {
  const plan = store.getEvaluationPlan()
  if (!plan) return null
  return plan as unknown as BuildPlan
})

// 是否显示评估方案面板：评估步骤已完成 且 用户还没确认
const showEvaluationPlan = computed(() => {
  const evalStep = store.jobSteps.find(s =>
    (s as Record<string, unknown>).step_type === 'evaluation' ||
    (s as Record<string, unknown>).stepType === 'evaluation'
  )
  const status = (evalStep as Record<string, unknown>)?.status as string | undefined
  return status === 'completed' && !store.planConfirmed
})

// 定时刷新面板的独立 ref，避免与 auto/step 模式的 buildTopic 冲突
const scheduleTopic = ref('')
const scheduleCron = ref('0 9 * * 1')

// 加载定时任务（切换到 scheduled 模式时加载）
onMounted(() => {
  if (activeMode.value === 'scheduled') {
    store.loadSchedules()
  }
})

// 输入主题时防抖查询可用关键词
let topicDebounceTimer: ReturnType<typeof setTimeout> | null = null
function handleTopicInput(): void {
  if (topicDebounceTimer) clearTimeout(topicDebounceTimer)
  topicDebounceTimer = setTimeout(() => {
    if (store.buildTopic.trim().length >= 2) {
      store.loadAvailableKeywords(store.buildTopic.trim())
    } else {
      store.availableKeywords = []
    }
  }, 500)
}

// 切换模式
function switchMode(mode: KnowledgeBuildMode): void {
  activeMode.value = mode
  if (mode === 'scheduled') {
    store.loadSchedules()
  }
}

// 获取步骤序号（1-based）
function getStepIndex(stepType: KnowledgeBuildStepType): number {
  return STEP_TYPES.indexOf(stepType) + 1
}

// 兼容 camelCase / snake_case 的 stepType 获取
function getStepType(step: Record<string, unknown>): KnowledgeBuildStepType {
  return (step.step_type || step.stepType) as KnowledgeBuildStepType
}

// 获取步骤卡片的 CSS class（根据状态）
function getStepClass(status: string): string {
  if (status === 'running' || status === 'waiting_confirm') return 'running'
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'failed'
  return 'pending'
}

// 判断步骤是否已完成（用于显示摘要）
function isStepDone(status: string): boolean {
  return status === 'completed'
}

// 获取去重数量
function getDedupCount(step: { output: Record<string, unknown> | null }): number {
  if (!step.output) return 0
  const total = (step.output.total as number) || 0
  const merged = step.output.merged?.length || 0
  return total - merged
}

// 获取最终入库数量
function getFinalPersistCount(): number {
  const persistStep = store.jobSteps.find(s => getStepType(s) === 'persist')
  return persistStep?.output?.createdIds?.length || 0
}

// 一键构建（启动评估）
async function handleStartBuild(): Promise<void> {
  if (!store.buildTopic.trim()) return
  await store.startBuild({
    topic: store.buildTopic.trim(),
    mode: activeMode.value,
  })
  // 评估完成后自动显示方案面板（通过 showEvaluationPlan computed）
}

// 确认评估方案，继续构建
async function handleConfirmPlan(): Promise<void> {
  if (!store.currentJob) return
  await store.confirmPlan(store.currentJob.id)
}

// 取消评估方案
function handleCancelPlan(): void {
  store.planConfirmed = false
  store.currentJob = null
  store.jobSteps = []
}

// 分步确认
async function handleConfirmStep(step: Record<string, unknown>): Promise<void> {
  if (!store.currentJob) return
  const stepType = getStepType(step)
  await store.executeStep(store.currentJob.id, stepType)
}

// 手动触发定时任务
async function handleTriggerSchedule(id: string): Promise<void> {
  const jobId = await store.triggerSchedule(id)
  await store.pollBuild(jobId)
}

// 切换定时任务启用/停用
async function handleToggleSchedule(s: { id: string; is_active: boolean; topic: string }): Promise<void> {
  await store.updateSchedule(s.id, { is_active: !s.is_active })
}

// 删除定时任务
async function handleDeleteSchedule(id: string): Promise<void> {
  await store.deleteSchedule(id)
}

// 创建定时任务
async function handleCreateSchedule(): Promise<void> {
  if (!scheduleTopic.value.trim()) return
  await store.createSchedule({
    topic: scheduleTopic.value.trim(),
    cronExpr: scheduleCron.value,
  })
  scheduleTopic.value = ''
}

// 格式化日期
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.kb-page {
  padding: var(--page-padding, 20px);
  max-width: 1200px;
  margin: 0 auto;
}

.toolbar {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.btn-back {
  margin-left: auto;
  font-size: 13px;
}

/* --- 模式选择器 --- */

.mode-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.mode-btn {
  padding: 8px 20px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 14px;
  transition: all 0.2s;
}

.mode-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.mode-btn:hover:not(.active) {
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
}

/* --- 复用基础组件 --- */

.card {
  background: var(--color-card, white);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.form-card {
  padding: 16px;
  margin-bottom: 16px;
}

.input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
  background: var(--color-background);
  color: var(--color-text);
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.btn {
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  background: transparent;
  color: var(--color-text);
}

.btn:hover:not(:disabled) {
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  color: #e53935;
  border-color: #e53935;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.tag {
  padding: 2px 8px;
  background: var(--color-bg-tertiary, #f0f0f0);
  border-radius: 4px;
  font-size: 12px;
  margin-right: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

.loading-wrapper {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

/* --- 评估方案面板 --- */

.evaluation-plan {
  border-color: var(--color-primary);
  border-width: 1px;
  border-left-width: 4px;
  border-left-color: var(--color-primary);
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.plan-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
}

.plan-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.badge-small {
  background: #e8f5e9;
  color: #2e7d32;
}

.badge-large {
  background: #fff3e0;
  color: #e65100;
}

.plan-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 14px;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.plan-dimensions {
  margin-bottom: 12px;
}

.dim-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.dim-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dim-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--color-border);
}

.dim-tag.density-high {
  background: #e3f2fd;
  border-color: #90caf9;
  color: #1565c0;
}

.dim-tag.density-medium {
  background: #f3e5f5;
  border-color: #ce93d8;
  color: #7b1fa2;
}

.dim-tag.density-low {
  background: #fce4ec;
  border-color: #f48fb1;
  color: #c62828;
}

.dim-count {
  font-size: 11px;
  opacity: 0.7;
}

.plan-gaps {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fff8e1;
  border-radius: 6px;
  font-size: 13px;
  color: #f57f17;
  margin-bottom: 10px;
}

.gap-icon {
  flex-shrink: 0;
}

.plan-suggestions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
}

.suggestion-item {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.plan-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-lg {
  padding: 10px 24px;
  font-size: 15px;
  font-weight: 600;
}

/* --- 关键词可用提示 --- */

.keyword-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #e3f2fd;
  border-radius: 6px;
  font-size: 13px;
  color: #1565c0;
  margin-bottom: 10px;
}

.hint-icon {
  flex-shrink: 0;
}

.hint-toggle {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 12px;
}

.hint-toggle input {
  margin: 0;
}

/* --- 维度-关键词映射 --- */

.dim-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dim-item {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.dim-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.dim-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.dim-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--color-bg-tertiary, #f0f0f0);
  color: var(--color-text-secondary);
}

.dim-density {
  font-size: 11px;
  margin-left: auto;
}

.text-high { color: #1565c0; }
.text-medium { color: #7b1fa2; }
.text-low { color: #c62828; }

.dim-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.kw-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: #e8f5e9;
  color: #2e7d32;
}

.kw-tag.supplementary {
  background: #fff3e0;
  color: #e65100;
}

/* --- 构建进度条 --- */

.build-progress {
  margin-bottom: 16px;
}

.progress-bar {
  height: 4px;
  background: var(--color-bg-secondary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  width: 30%;
}

.progress-fill.animating {
  animation: progress-slide 1.5s ease-in-out infinite;
}

@keyframes progress-slide {
  0% { width: 5%; }
  50% { width: 60%; }
  100% { width: 95%; }
}

.progress-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 8px;
}

/* --- 步骤卡片 --- */

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

.step-card.success {
  border-left-color: #10b981;
}

.step-card.failed {
  border-left-color: #ef4444;
}

.step-card.pending {
  border-left-color: var(--color-border);
}

.step-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
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

.step-number.success,
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
  opacity: 0.4;
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

.step-name {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.step-status {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.step-status.running {
  color: var(--color-primary);
}

.step-status.success,
.step-status.completed {
  color: #10b981;
}

.step-status.failed {
  color: #ef4444;
}

.step-status.waiting_confirm {
  color: #f59e0b;
}

.step-card-body {
  padding: 0 16px 12px;
  border-top: 1px solid var(--color-border);
  margin-top: 0;
  padding-top: 12px;
}

.step-summary {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.step-confirm {
  padding: 0 16px 12px;
}

.step-confirm .btn {
  margin-top: 8px;
}

.build-done {
  padding: 16px;
  background: #e8f5e9;
  border-radius: 8px;
  font-size: 14px;
  color: #2e7d32;
  text-align: center;
}

.build-failed {
  padding: 16px;
  background: #fce4ec;
  border-radius: 8px;
  font-size: 14px;
  color: #c62828;
  text-align: center;
}

/* --- 定时刷新面板 --- */

.schedule-panel {
  margin-top: 8px;
}

.schedule-card {
  padding: 14px;
  margin-bottom: 10px;
}

.schedule-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.schedule-topic {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.schedule-cron {
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  background: var(--color-bg-tertiary, #f0f0f0);
  color: var(--color-text-secondary);
  font-family: monospace;
}

.status-active {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: #e8f5e9;
  color: #2e7d32;
}

.status-inactive {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: #f5f5f5;
  color: #757575;
}

.schedule-last {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: auto;
}

.schedule-actions {
  display: flex;
  gap: 8px;
}

/* --- 移动端适配 --- */

@media (max-width: 768px) {
  .kb-page {
    padding: 12px;
  }

  .mode-selector {
    flex-wrap: wrap;
  }

  .mode-btn {
    flex: 1;
    min-width: 100px;
    text-align: center;
    font-size: 13px;
    padding: 8px 12px;
  }

  .form-row {
    flex-direction: column;
    gap: 0;
  }

  .schedule-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .schedule-last {
    margin-left: 0;
  }

  .step-number {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .step-name {
    font-size: 14px;
  }
}
</style>
