<template>
  <div class="production-page">
    <!-- ========== 第二层：项目列表（无 jobId） ========== -->
    <template v-if="!routeJobId">
      <div class="toolbar">
        <h2 class="page-title">生产流水线</h2>
        <div class="toolbar-actions">
          <button class="btn btn-primary" @click="showNewProjectDialog = true">+ 新建项目</button>
        </div>
      </div>

      <!-- 项目列表 -->
      <div v-if="projectsLoading" class="empty-state">加载中...</div>
      <div v-else-if="projects.length === 0" class="empty-state">
        <div class="empty-icon">🎬</div>
        <p>还没有项目，点击「新建项目」开始生产</p>
        <button class="btn btn-primary" @click="showNewProjectDialog = true">新建项目</button>
      </div>
      <div v-else class="project-grid">
        <div v-for="p in projects" :key="p.id" class="project-card" @click="openProject(p.id)">
          <div class="project-card-header">
            <span class="project-status" :class="statusClass(p.status)">{{ statusLabel(p.status) }}</span>
            <span class="project-date">{{ formatDate(p.createdAt) }}</span>
          </div>
          <h4 class="project-title">{{ (p.input as any)?.title || '未命名项目' }}</h4>
          <div class="project-meta">
            <span v-if="p.mode">{{ p.mode }}</span>
          </div>
          <div class="project-actions">
            <button class="btn btn-sm btn-primary" @click.stop="openProject(p.id)">编辑</button>
            <button class="btn btn-sm" @click.stop="deleteProject(p.id)">删除</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 第三层：项目流水线（有 jobId） ========== -->
    <template v-else>
      <div class="toolbar">
        <h2 class="page-title">生产流水线</h2>
        <span v-if="store.jobId" class="toolbar-hint">{{ toolbarHint }}</span>
        <div class="toolbar-actions">
          <router-link :to="{ name: 'ProductionProjectList' }" class="btn">返回项目列表</router-link>
          <button class="btn btn-primary" :disabled="saving" @click="handleSaveProject">{{ saving ? '保存中...' : '保存项目' }}</button>
        </div>
      </div>

      <template v-if="store.jobId">
        <!-- 一键生产 -->
        <div class="auto-run-bar">
          <button
            class="auto-run-btn"
            :class="{ completed: allDone, running: store.executing }"
            :disabled="store.executing || allDone"
            @click="handleAutoRun"
          >
            <template v-if="allDone">✅ 全部完成</template>
            <template v-else-if="store.executing">⏳ 生产中...</template>
            <template v-else>🔥 一键生产</template>
          </button>
          <div class="auto-run-progress">
            {{ completedWorkSteps }}/{{ totalWorkSteps }} 工作步骤完成
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (completedWorkSteps / totalWorkSteps * 100) + '%' }" />
            </div>
          </div>
        </div>

        <!-- 流水线 -->
        <div class="flat-pipeline">
          <template v-for="phase in PRODUCTION_PHASES" :key="phase.phase">
            <div class="phase-header" :class="'phase-bg-' + phase.phase">
              <span class="phase-indicator">{{ isPhaseCompleted(phase.phase) ? '✅' : isPhaseActive(phase.phase) ? '🔵' : '⚪' }}</span>
              <h3>阶段{{ phase.phase }}：{{ phase.label }}</h3>
              <span class="phase-count">{{ getPhaseProgressText(phase.phase) }}</span>
            </div>

            <template v-for="(step, si) in phase.steps" :key="step.id">

              <!-- 摘要步骤 -->
              <div v-if="step.id === 'p1_hotspot_viral'" class="flat-step flat-step-embedded" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header">
                  <span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span>
                  <button class="signal-btn" @click.stop="toggleSignalInput(step.id)" title="标记发现，供选题灵感参考">📌 标记</button>
                  <span class="step-status">{{ getStatusIcon(step.id) }}</span>
                </div>
                <div v-if="activeSignalStep === step.id" class="signal-input-row">
                  <input v-model="signalInputs[step.id]" class="signal-input" placeholder="记下你的发现，如：这个话题最近很火..." @keyup.enter="addSignal(step.id, 'p1_hotspot_viral')" />
                  <button class="btn btn-sm btn-primary" @click="addSignal(step.id, 'p1_hotspot_viral')">记入</button>
                </div>
                <HotspotsView :pipeline-job-id="routeJobId" />
              </div>
              <div v-else-if="step.id === 'p1_benchmark'" class="flat-step flat-step-embedded" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header">
                  <span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span>
                  <button class="signal-btn" @click.stop="toggleSignalInput(step.id)" title="标记发现">📌 标记</button>
                  <span class="step-status">{{ getStatusIcon(step.id) }}</span>
                </div>
                <div v-if="activeSignalStep === step.id" class="signal-input-row">
                  <input v-model="signalInputs[step.id]" class="signal-input" placeholder="记下对标账号的特点或可借鉴之处..." @keyup.enter="addSignal(step.id, 'p1_benchmark')" />
                  <button class="btn btn-sm btn-primary" @click="addSignal(step.id, 'p1_benchmark')">记入</button>
                </div>
                <BenchmarkAccountsView />
              </div>
              <div v-else-if="step.id === 'p1_collect'" class="flat-step flat-step-embedded" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header">
                  <span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span>
                  <button class="signal-btn" @click.stop="toggleSignalInput(step.id)" title="标记发现">📌 标记</button>
                  <span class="step-status">{{ getStatusIcon(step.id) }}</span>
                </div>
                <div v-if="activeSignalStep === step.id" class="signal-input-row">
                  <input v-model="signalInputs[step.id]" class="signal-input" placeholder="记下采集到的有价值数据..." @keyup.enter="addSignal(step.id, 'p1_collect')" />
                  <button class="btn btn-sm btn-primary" @click="addSignal(step.id, 'p1_collect')">记入</button>
                </div>
                <CollectTasksView />
              </div>
              <div v-else-if="step.id === 'p1_transcript'" class="flat-step flat-step-embedded" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header">
                  <span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span>
                  <button class="signal-btn" @click.stop="toggleSignalInput(step.id)" title="标记发现">📌 标记</button>
                  <span class="step-status">{{ getStatusIcon(step.id) }}</span>
                </div>
                <div v-if="activeSignalStep === step.id" class="signal-input-row">
                  <input v-model="signalInputs[step.id]" class="signal-input" placeholder="记下爆款文案的结构或亮点..." @keyup.enter="addSignal(step.id, 'p1_transcript')" />
                  <button class="btn btn-sm btn-primary" @click="addSignal(step.id, 'p1_transcript')">记入</button>
                </div>
                <ViralVideosView />
              </div>
              <div v-else-if="step.id === 'p1_inspiration'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <TopicInspirationPanel />
              </div>
              <div v-else-if="step.id === 'p3_visual_make'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <MaterialConfigPanel />
              </div>
              <div v-else-if="step.id === 'p4_fine_cut'" class="flat-step flat-step-summary" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <p class="summary-desc">精剪后期（调色/转场/特效）为可选增强步骤。基础版本在粗剪步骤已完成，可直接进入字幕配置。</p>
              </div>
              <div v-else-if="step.id === 'p5_tracking'" class="flat-step flat-step-embedded" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <MonitoringView />
              </div>
              <div v-else-if="step.id === 'p5_schedule'" class="flat-step flat-step-embedded" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <OperationCalendarView />
              </div>

              <!-- work 步骤 -->
              <div v-else-if="step.id === 'p2_draft'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <CopyDraftPanel />
              </div>
              <div v-else-if="step.id === 'p2_prohibited'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <ProhibitedCheckPanel />
              </div>
              <div v-else-if="step.id === 'p2_finalize'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <CopyFinalizePanel @to-script="handleToScript" />
              </div>
              <div v-else-if="step.id === 'p3_script'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">脚本 + 分镜</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <ScriptPanel />
              </div>
              <div v-else-if="step.id === 'p3_storyboard'" class="flat-step flat-step-summary" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <p class="summary-desc">分镜规划已在「脚本生成」步骤中完成（四通道总谱：口播+画面+音乐+节奏）</p>
              </div>
              <div v-else-if="step.id === 'p3_shooting'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <ShootingPlanPanel :job-id="store.jobId || ''" />
              </div>
              <div v-else-if="step.id === 'p4_dubbing'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <TtsPanel />
              </div>
              <div v-else-if="step.id === 'p4_rough_cut'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <VisualPanel initial-tab="timeline" />
              </div>
              <div v-else-if="step.id === 'p4_subtitle'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <SubtitlePanel />
              </div>
              <div v-else-if="step.id === 'p5_keyword'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <PublishPanel :activeSection="'keyword'" />
              </div>
              <div v-else-if="step.id === 'p5_hotspot_tag'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <PublishPanel :activeSection="'hotspot'" />
              </div>
              <div v-else-if="step.id === 'p5_publish'" class="flat-step flat-step-work" :class="'phase-step-' + phase.phase">
                <div class="flat-step-header"><span class="step-num">{{ phase.phase }}.{{ si + 1 }}</span><span class="step-label">{{ step.label }}</span><span class="step-status">{{ getStatusIcon(step.id) }}</span></div>
                <PublishPanel :activeSection="'publish'" />
              </div>

            </template>
          </template>
        </div>
      </template>

      <!-- 加载失败 -->
      <div v-else class="empty-state">
        <p>项目数据加载中，或项目不存在。</p>
        <router-link :to="{ name: 'ProductionProjectList' }" class="btn btn-primary">返回项目列表</router-link>
      </div>
    </template>

    <!-- ========== 新建项目弹窗 ========== -->
    <div v-if="showNewProjectDialog" class="overlay" @click.self="showNewProjectDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>新建项目</h3>
          <button class="dialog-close" @click="showNewProjectDialog = false">&times;</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>项目名称 <span class="required">*</span></label>
            <input v-model="newTitle" class="input" placeholder="例如：新疆旅行系列" />
          </div>
          <div v-if="store.templates.length > 0" class="form-group">
            <label>从模板创建（可选）</label>
            <select v-model="selectedTemplateId" class="input">
              <option value="">空白开始</option>
              <option v-for="t in store.templates" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
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
        <div class="dialog-footer">
          <button class="btn" @click="showNewProjectDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="!newTitle.trim() || store.loading" @click="handleCreate">
            {{ store.loading ? '创建中...' : '开始生产' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useProductionStore } from '@/stores/production'
import { PRODUCTION_PHASES, ALL_PIPELINE_STEPS } from '@zimti/shared'
import type { StepStatus } from '@zimti/shared'
import api from '@/api/client'
import { toast } from '@/utils/toast'

// 面板组件
import ScriptPanel from '@/components/production/ScriptPanel.vue'
import TtsPanel from '@/components/production/TtsPanel.vue'
import VisualPanel from '@/components/production/VisualPanel.vue'
import SubtitlePanel from '@/components/production/SubtitlePanel.vue'
import PublishPanel from '@/components/production/PublishPanel.vue'
import ShootingPlanPanel from '@/components/production/visual/ShootingPlanPanel.vue'
import MaterialConfigPanel from '@/components/production/MaterialConfigPanel.vue'
import CopyDraftPanel from '@/components/production/CopyDraftPanel.vue'
import ProhibitedCheckPanel from '@/components/production/ProhibitedCheckPanel.vue'
import CopyFinalizePanel from '@/components/production/CopyFinalizePanel.vue'
import TopicInspirationPanel from '@/components/production/TopicInspirationPanel.vue'

// 内嵌页面视图
import HotspotsView from '@/views/HotspotsView.vue'
import BenchmarkAccountsView from '@/views/BenchmarkAccountsView.vue'
import CollectTasksView from '@/views/CollectTasksView.vue'
import ViralVideosView from '@/views/ViralVideosView.vue'
import MonitoringView from '@/views/MonitoringView.vue'
import OperationCalendarView from '@/views/OperationCalendarView.vue'

const route = useRoute()
const router = useRouter()
const store = useProductionStore()

// --- 项目列表 ---
interface ProjectItem {
  id: string
  status: string
  mode: string | null
  input: { title?: string; [k: string]: unknown } | null
  createdAt: string
}
const projects = ref<ProjectItem[]>([])
const projectsLoading = ref(false)

async function loadProjects() {
  projectsLoading.value = true
  try {
    const res = await api.get('/pipeline/jobs') as { items: ProjectItem[]; total: number }
    projects.value = res.items || []
  } catch { projects.value = [] }
  finally { projectsLoading.value = false }
}

function openProject(jobId: string) {
  router.push({ name: 'ProductionPipeline', params: { jobId } })
}

async function deleteProject(jobId: string) {
  if (!confirm('确定删除此项目？')) return
  try {
    await api.delete(`/pipeline/jobs/${jobId}`)
    projects.value = projects.value.filter(p => p.id !== jobId)
  } catch { /* 静默 */ }
}

function statusClass(status: string): string {
  if (status === 'completed') return 'status-done'
  if (status === 'running' || status === 'producing') return 'status-running'
  return 'status-pending'
}

function statusLabel(status: string): string {
  if (status === 'completed') return '已完成'
  if (status === 'running' || status === 'producing') return '生产中'
  return '进行中'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// --- 新建项目 ---
const showNewProjectDialog = ref(false)
const newTitle = ref('')
const newVideoType = ref('knowledge')
const selectedTemplateId = ref('')

async function handleCreate() {
  if (!newTitle.value.trim()) return
  const jobId = await store.createJob({
    title: newTitle.value.trim(),
    video_type: newVideoType.value,
  })
  store.setPhase(1)
  showNewProjectDialog.value = false
  newTitle.value = ''
  newVideoType.value = 'knowledge'
  router.push({ name: 'ProductionPipeline', params: { jobId } })
}

// --- 路由 ---
const saving = ref(false)

async function handleSaveProject() {
  if (!store.jobId) return
  saving.value = true
  try {
    const saves: Promise<void>[] = []

    // 步骤1: 脚本
    saves.push(store.saveStepData(1, {
      script_id: store.scriptId || undefined,
      full_text: store.fullText || undefined,
    }))

    // 步骤2: TTS
    if (store.audioUrls.length > 0) {
      saves.push(store.saveStepData(2, {
        audio_urls: store.audioUrls,
        audio_duration: store.audioDuration,
      }))
    }

    // 步骤3: 视频
    if (store.videoProductId) {
      saves.push(store.saveStepData(3, {
        video_product_id: store.videoProductId,
        video_url: store.videoUrl || undefined,
      }))
    }

    // 步骤4: 字幕
    saves.push(store.saveStepData(4, { subtitle_style: store.subtitleStyle }))

    // 步骤5: 发布
    if (store.targetPlatforms.length > 0) {
      saves.push(store.saveStepData(5, { platforms: store.targetPlatforms }))
    }

    await Promise.all(saves)
    toast.success('项目已保存')
  } catch (err) {
    console.error('[保存项目失败]', err)
    toast.error('保存失败: ' + (err instanceof Error ? err.message : String(err)))
  } finally {
    saving.value = false
  }
}

const routeJobId = computed(() => {
  const id = route.params.jobId as string
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : ''
})

// --- 流水线 computed ---
const toolbarHint = computed(() => {
  const phase = PRODUCTION_PHASES[store.currentPhase - 1]
  return phase ? `阶段 ${phase.phase}/5 — ${phase.label}` : ''
})
const workSteps = computed(() => ALL_PIPELINE_STEPS.filter(s => s.displayType === 'work'))
const totalWorkSteps = computed(() => workSteps.value.length)
const completedWorkSteps = computed(() => workSteps.value.filter(s => store.stepStatusMap[s.id] === 'completed').length)
const allDone = computed(() => {
  const workSteps = ALL_PIPELINE_STEPS.filter(s => s.displayType === 'work')
  return workSteps.every(s => store.stepStatusMap[s.id] === 'completed')
})

function getStatusIcon(stepId: string): string {
  const status: StepStatus = store.stepStatusMap[stepId] || 'pending'
  switch (status) { case 'completed': return '✅'; case 'running': return '🔄'; case 'failed': return '❌'; default: return '' }
}
function getPhaseProgressText(phase: number): string {
  const p = store.phaseProgress(phase); return `${p.completed}/${p.total} 完成`
}
function isPhaseCompleted(phase: number): boolean {
  const p = store.phaseProgress(phase); return p.completed === p.total && p.total > 0
}
function isPhaseActive(phase: number): boolean {
  for (const ph of PRODUCTION_PHASES) { if (!isPhaseCompleted(ph.phase)) return ph.phase === phase } return false
}

// --- 流水线 methods ---
function handleToScript(scriptId: number) {
  store.markCopyFinalized()
  if (scriptId) { store.scriptId = scriptId; store.saveStepData(1, { script_id: scriptId }) }
  store.setPhase(3)
}
async function handleAutoRun() { await store.autoRunV2() }

// --- 发现信号（Phase 1 摘要步骤 → 选题灵感的数据管道）---
const activeSignalStep = ref<string | null>(null)
const signalInputs = ref<Record<string, string>>({})

function toggleSignalInput(stepId: string) {
  if (activeSignalStep.value === stepId) {
    activeSignalStep.value = null
  } else {
    activeSignalStep.value = stepId
    if (!(stepId in signalInputs.value)) {
      signalInputs.value[stepId] = ''
    }
  }
}

function addSignal(stepId: string, source: string) {
  const content = signalInputs.value[stepId]?.trim()
  if (!content) return
  // 映射 stepId → source key
  const sourceMap: Record<string, string> = {
    p1_hotspot_viral: 'hotspot',
    p1_benchmark: 'benchmark',
    p1_collect: 'collect',
    p1_transcript: 'transcript',
  }
  const stepDef = ALL_PIPELINE_STEPS.find(s => s.id === stepId)
  store.addDiscoverySignal({
    source: sourceMap[source] || sourceMap[stepId] || 'unknown',
    type: stepDef?.label || '观察',
    content,
  })
  signalInputs.value[stepId] = ''
  activeSignalStep.value = null
}

// --- Lifecycle ---
onMounted(async () => {
  store.loadTemplates()
  if (routeJobId.value) {
    await store.loadJob(routeJobId.value)
    if (store.jobId) store.setPhase(store.currentPhase)
  } else {
    await loadProjects()
  }
})

function onBeforeUnload(e: BeforeUnloadEvent) { if (store.hasUnsavedChanges) e.preventDefault() }
onMounted(() => { window.addEventListener('beforeunload', onBeforeUnload) })
onUnmounted(() => { window.removeEventListener('beforeunload', onBeforeUnload) })
onBeforeRouteLeave(() => { if (store.hasUnsavedChanges) { if (!confirm('有步骤正在执行中，确定要离开吗？')) return false } return true })
</script>

<style scoped>
.production-page { padding: var(--page-padding, 20px); max-width: 1200px; margin: 0 auto; }

.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.page-title { font-size: 22px; font-weight: 700; color: var(--color-text); margin: 0; }
.toolbar-hint { color: var(--color-text-secondary); font-size: 14px; }
.toolbar-actions { margin-left: auto; display: flex; gap: 8px; }

/* 按钮 */
.btn { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: 6px; background: transparent; color: var(--color-text); cursor: pointer; font-size: 14px; text-decoration: none; }
.btn:hover:not(:disabled) { background: var(--color-surface-hover, rgba(0,0,0,0.04)); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-primary:hover:not(:disabled) { opacity: 0.9; background: var(--color-primary); }
.btn-sm { padding: 4px 12px; font-size: 13px; border-radius: 4px; }

/* 项目列表 */
.project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.project-card {
  background: var(--color-surface, #fff); border: 1px solid var(--color-border);
  border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.2s;
}
.project-card:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.project-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.project-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.status-done { background: #D1FAE5; color: #059669; }
.status-running { background: #DBEAFE; color: #2563EB; }
.status-pending { background: #F3F4F6; color: #6B7280; }
.project-date { font-size: 12px; color: var(--color-text-secondary); }
.project-title { margin: 0 0 8px; font-size: 16px; font-weight: 600; color: var(--color-text); }
.project-meta { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px; }
.project-actions { display: flex; gap: 8px; }

/* 空状态 */
.empty-state { text-align: center; padding: 60px 20px; color: var(--color-text-secondary); }
.empty-state p { margin-bottom: 16px; }
.empty-icon { font-size: 48px; margin-bottom: 12px; }

/* 弹窗 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.dialog { background: var(--color-surface, #ffffff); border-radius: 10px; width: 90%; max-width: 480px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-secondary); }
.dialog-body { padding: 20px; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--color-border); }
.form-group { margin-bottom: 16px; text-align: left; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 6px; }
.required { color: #EF4444; }
.input { width: 100%; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-background); color: var(--color-text); font-size: 14px; box-sizing: border-box; }
.input:focus { outline: none; border-color: var(--color-primary); }

/* 一键生产 */
.auto-run-bar { display: flex; align-items: center; gap: 20px; padding: 16px 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; margin-bottom: 20px; }
.auto-run-btn { flex-shrink: 0; padding: 12px 32px; font-size: 16px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #FF6B35, #FF8C42); border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; letter-spacing: 1px; }
.auto-run-btn:hover:not(:disabled) { filter: brightness(1.1); box-shadow: 0 4px 12px rgba(255,107,53,0.35); }
.auto-run-btn:disabled { cursor: not-allowed; opacity: 0.7; }
.auto-run-btn.running { background: linear-gradient(135deg, #3b82f6, #60a5fa); }
.auto-run-btn.completed { background: linear-gradient(135deg, #10b981, #34d399); }
.auto-run-progress { flex: 1; display: flex; align-items: center; gap: 12px; font-size: 14px; color: var(--color-text-secondary); }
.progress-bar { flex: 1; height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #10b981, #34d399); border-radius: 3px; transition: width 0.4s ease; }

/* 流水线 */
.flat-pipeline { display: flex; flex-direction: column; gap: 0; }
.phase-header { display: flex; align-items: center; gap: 10px; padding: 14px 20px; margin-top: 24px; border-radius: 8px; position: relative; }
.phase-header:first-child { margin-top: 0; }
.phase-header::before { content: ''; position: absolute; top: -12px; left: 20px; right: 20px; height: 1px; background: var(--color-border); }
.phase-header:first-child::before { display: none; }
.phase-indicator { font-size: 18px; flex-shrink: 0; }
.phase-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--color-text); }
.phase-count { font-size: 13px; color: var(--color-text-secondary); margin-left: auto; }
.flat-step { margin-top: 12px; }
.flat-step-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.step-num {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 28px; height: 22px; padding: 0 4px;
  background: var(--color-primary); color: #fff;
  font-size: 11px; font-weight: 700; border-radius: 4px;
  flex-shrink: 0; letter-spacing: 0.5px;
}
.flat-step-header .step-label { font-size: 15px; font-weight: 600; color: var(--color-text); }
.flat-step-header .step-status { margin-left: auto; font-size: 14px; }

/* 阶段色：每个阶段不同的左边框 */
.phase-step-1 { border-left: 3px solid #3B82F6 !important; }  /* 内容发现 - 蓝 */
.phase-step-2 { border-left: 3px solid #8B5CF6 !important; }  /* 文案创作 - 紫 */
.phase-step-3 { border-left: 3px solid #10B981 !important; }  /* 脚本画面 - 绿 */
.phase-step-4 { border-left: 3px solid #F59E0B !important; }  /* 配音剪辑 - 橙 */
.phase-step-5 { border-left: 3px solid #EF4444 !important; }  /* 优化发布 - 红 */

/* 阶段头部不同色 */
.phase-bg-1 { background: linear-gradient(135deg, #EFF6FF, #DBEAFE) !important; }  /* 蓝 */
.phase-bg-2 { background: linear-gradient(135deg, #F5F3FF, #EDE9FE) !important; }  /* 紫 */
.phase-bg-3 { background: linear-gradient(135deg, #ECFDF5, #D1FAE5) !important; }  /* 绿 */
.phase-bg-4 { background: linear-gradient(135deg, #FFFBEB, #FEF3C7) !important; }  /* 橙 */
.phase-bg-5 { background: linear-gradient(135deg, #FEF2F2, #FEE2E2) !important; }  /* 红 */
.phase-bg-1.completed { background: linear-gradient(135deg, #EFF6FF, #DBEAFE) !important; }
.phase-bg-2.completed { background: linear-gradient(135deg, #F5F3FF, #EDE9FE) !important; }
.phase-bg-3.completed { background: linear-gradient(135deg, #ECFDF5, #D1FAE5) !important; }
.phase-bg-4.completed { background: linear-gradient(135deg, #FFFBEB, #FEF3C7) !important; }
.phase-bg-5.completed { background: linear-gradient(135deg, #FEF2F2, #FEE2E2) !important; }

.flat-step-embedded { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; padding: 16px 20px; }
.flat-step-embedded > :deep(.hotspots-page > .back-nav),
.flat-step-embedded > :deep(.collect-page > .back-nav),
.flat-step-embedded > :deep(.viral-page > .back-nav),
.flat-step-embedded > :deep(.monitor-page > .back-nav) { display: none !important; }
.flat-step-embedded > :deep(.topic-page > .sub-nav) { display: none !important; }
.flat-step-embedded > :deep(.hotspots-page),
.flat-step-embedded > :deep(.collect-page),
.flat-step-embedded > :deep(.viral-page),
.flat-step-embedded > :deep(.topic-page),
.flat-step-embedded > :deep(.materials-page),
.flat-step-embedded > :deep(.monitor-page),
.flat-step-embedded > :deep(.operation-calendar) { padding: 0 !important; }

.flat-step-summary { padding: 14px 18px; background: #F9FAFB; border-left: 3px solid #D1D5DB; border-radius: 0 8px 8px 0; }
.summary-desc { margin: 4px 0 0; font-size: 13px; color: var(--color-text-secondary); }

.flat-step-work { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; padding: 16px 20px; }
.flat-step-work > :deep(.script-panel),
.flat-step-work > :deep(.tts-panel),
.flat-step-work > :deep(.visual-panel),
.flat-step-work > :deep(.subtitle-panel),
.flat-step-work > :deep(.publish-panel),
.flat-step-work > :deep(.copy-draft-panel),
.flat-step-work > :deep(.prohibited-check-panel),
.flat-step-work > :deep(.copy-finalize-panel),
.flat-step-work > :deep(.shooting-plan-panel) { background: transparent; border: none; border-radius: 0; padding: 0; }

.hidden-step { display: none; }

/* 发现信号标记 */
.signal-btn {
  font-size: 11px; padding: 2px 8px; border: 1px dashed var(--color-border);
  border-radius: 4px; background: transparent; color: var(--color-text-secondary);
  cursor: pointer; margin-left: auto; margin-right: 8px; white-space: nowrap;
  transition: all 0.2s;
}
.signal-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: rgba(59,130,246,0.04); }
.signal-input-row {
  display: flex; gap: 8px; padding: 8px 12px; margin-bottom: 8px;
  background: var(--color-background); border-radius: 6px;
}
.signal-input {
  flex: 1; padding: 6px 10px; border: 1px solid var(--color-border);
  border-radius: 4px; font-size: 13px; background: var(--color-surface);
  color: var(--color-text);
}
.signal-input:focus { outline: none; border-color: var(--color-primary); }

@media (max-width: 768px) {
  .production-page { padding: 12px; }
  .project-grid { grid-template-columns: 1fr; }
  .auto-run-bar { flex-direction: column; gap: 12px; padding: 12px; }
  .auto-run-btn { width: 100%; text-align: center; padding: 12px 16px; }
  .phase-header { padding: 10px 14px; }
  .flat-step-work { padding: 12px 14px; }
}
</style>
