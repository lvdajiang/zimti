import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createProductionJob,
  fetchProductionProgress,
  executeProductionStep,
  updateProductionStep,
  rollbackProductionStep,
  fetchPipelineTemplates,
  type PipelineTemplateItem,
} from '../api/production'
import type { StepState } from '../api/production'
import {
  PRODUCTION_PHASES,
  ALL_PIPELINE_STEPS,
  STEP_TO_BACKEND_MAP,
  AUTO_RUNNABLE_STEPS,
  type StepStatus,
} from '@zimti/shared'
import {
  generateTopicsForPipelineApi,
  fetchTopicProposalsByJob,
  selectTopicApi,
  fetchTopicSourcesApi,
  pollTopicGenerationStatus,
  type TopicProposalItem,
  type TopicSourceAggregate,
} from '../api/topicProposals'

export const useProductionStore = defineStore('production', () => {
  // --- 核心状态 ---
  const jobId = ref<string | null>(null)
  const taskId = ref('')
  const scriptId = ref(0)
  const currentStep = ref(1)
  const steps = ref<StepState[]>([
    { step: 1, name: 'script', status: 'pending', data: {} },
    { step: 2, name: 'tts', status: 'pending', data: {} },
    { step: 3, name: 'visual', status: 'pending', data: {} },
    { step: 4, name: 'subtitle', status: 'pending', data: {} },
    { step: 5, name: 'publish', status: 'pending', data: {} },
  ])
  const loading = ref(false)
  const executing = ref(false)
  const jobStatus = ref('')

  // --- v2 阶段状态 ---
  /** 当前阶段 (1-5) */
  const currentPhase = ref(1)
  /** 当前选中的前端步骤ID */
  const activeStepId = ref<string | null>(null)
  /** 文案链各步骤完成标记 */
  const copyDraftDone = ref(false)
  const copyProhibitedDone = ref(false)
  const copyFinalized = ref(false)

  // --- 选题共振状态 ---
  const topicId = ref<number | null>(null)
  const topicTitle = ref('')
  const topicProposals = ref<TopicProposalItem[]>([])
  const topicLoading = ref(false)
  const topicSelected = ref(false)
  const topicSources = ref<TopicSourceAggregate | null>(null)

  // --- 发现信号（Phase 1 摘要步骤 → 选题灵感的数据管道）---
  const discoverySignals = ref<Array<{
    id: string
    source: string       // 'hotspot' | 'benchmark' | 'collect' | 'transcript'
    type: string         // 信号类型
    content: string      // 信号内容
    metadata?: Record<string, unknown>
    createdAt: number
  }>>([])

  function addDiscoverySignal(signal: {
    source: string
    type: string
    content: string
    metadata?: Record<string, unknown>
  }) {
    // 去重：同 source + type + content 不重复添加
    const dup = discoverySignals.value.find(
      s => s.source === signal.source && s.type === signal.type && s.content === signal.content,
    )
    if (!dup) {
      discoverySignals.value.push({
        ...signal,
        id: `${signal.source}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: Date.now(),
      })
    }
  }

  function removeDiscoverySignal(id: string) {
    discoverySignals.value = discoverySignals.value.filter(s => s.id !== id)
  }

  function clearDiscoverySignals() {
    discoverySignals.value = []
  }

  /** 格式化发现信号为 AI 上下文文本 */
  function getDiscoveryContext(): string {
    if (discoverySignals.value.length === 0) return ''
    const sourceLabels: Record<string, string> = {
      hotspot: '热点追踪', benchmark: '对标账号', collect: '数据采集', transcript: '爆款文案',
    }
    return discoverySignals.value
      .map(s => `[${sourceLabels[s.source] || s.source}] ${s.type}: ${s.content}`)
      .join('\n')
  }

  // --- 步骤1: 脚本数据 ---
  const fullText = ref('')
  const videoType = ref('knowledge')
  const oralRatio = ref(0.7)

  // --- 步骤2: TTS 数据 ---
  const audioUrls = ref<string[]>([])
  const audioDuration = ref(0)
  const ttsVoice = ref('zh-CN-XiaoxiaoNeural')
  const ttsEngine = ref<'edge_tts' | 'fish_audio' | 'uploaded'>('edge_tts')
  const ttsVoiceProfileId = ref<string | null>(null)
  const uploadedAudioMap = ref<Record<string, string>>({})

  // --- 步骤3: 视频数据 ---
  const videoProductId = ref('')
  const renderJobId = ref('')
  const renderProgress = ref(0)
  const videoUrl = ref('')

  // --- 步骤4: 字幕数据 ---
  const subtitleStyle = ref({
    font_size: 48,
    color: '#FFFFFF',
    position: 'bottom' as 'top' | 'center' | 'bottom',
    bg_color: '#000000',
    bg_opacity: 0.6,
  })

  // --- 步骤5: 发布数据 ---
  const targetPlatforms = ref<string[]>([])

  // --- Getters ---
  const isStepCompleted = computed(() => (step: number) =>
    steps.value[step - 1]?.status === 'completed',
  )

  const canAdvanceTo = computed(() => (step: number) => {
    for (let i = 1; i < step; i++) {
      if (steps.value[i - 1]?.status !== 'completed') return false
    }
    return true
  })

  const isAllCompleted = computed(() =>
    steps.value.every(s => s.status === 'completed'),
  )

  // --- v2 Getters ---

  /** 当前阶段的步骤列表 */
  const currentPhaseSteps = computed(() => {
    const phase = PRODUCTION_PHASES[currentPhase.value - 1]
    return phase?.steps || []
  })

  /** 前端 19 步的状态映射表（从后端 5 步 + 文案状态推导） */
  const stepStatusMap = computed<Record<string, StepStatus>>(() => {
    const map: Record<string, StepStatus> = {}

    // Phase 1: 摘要步骤始终 completed（用户手动查看）
    map['p1_hotspot_viral'] = 'completed'
    map['p1_benchmark'] = 'completed'
    map['p1_collect'] = 'completed'
    map['p1_transcript'] = 'completed'

    // Phase 1: 选题灵感 — 从选题选定状态推导
    map['p1_inspiration'] = topicSelected.value ? 'completed' : 'pending'

    // Phase 2: 各步骤独立完成状态（串联约束）
    map['p2_draft'] = copyDraftDone.value ? 'completed' : 'pending'
    map['p2_prohibited'] = copyProhibitedDone.value ? 'completed' : 'pending'
    map['p2_finalize'] = copyFinalized.value ? 'completed' : 'pending'

    // Phase 3: 后端 step 1 (script)
    const scriptStatus = steps.value[0]?.status || 'pending'
    map['p3_script'] = scriptStatus as StepStatus
    map['p3_storyboard'] = scriptStatus === 'completed' ? 'completed' : (scriptStatus as StepStatus)
    map['p3_shooting'] = scriptStatus === 'completed' ? 'completed' : 'pending'
    map['p3_visual_make'] = 'pending' // 摘要步骤

    // Phase 4: 后端 step 2(tts), 3(visual), 4(subtitle)
    map['p4_dubbing'] = (steps.value[1]?.status || 'pending') as StepStatus
    map['p4_rough_cut'] = (steps.value[2]?.status || 'pending') as StepStatus
    map['p4_fine_cut'] = (steps.value[2]?.status === 'completed' ? 'completed' : 'pending') as StepStatus // 可选增强，粗剪完成即可视为通过
    map['p4_subtitle'] = (steps.value[3]?.status || 'pending') as StepStatus

    // Phase 5: 后端 step 5 (publish)
    const publishStatus = (steps.value[4]?.status || 'pending') as StepStatus
    map['p5_keyword'] = publishStatus === 'completed' ? 'completed' : 'pending'
    map['p5_hotspot_tag'] = publishStatus === 'completed' ? 'completed' : 'pending'
    map['p5_publish'] = publishStatus
    map['p5_tracking'] = 'pending' // 摘要步骤
    map['p5_schedule'] = 'pending' // 摘要步骤

    return map
  })

  /** 某阶段的完成进度 {completed, total} */
  const phaseProgress = computed(() => (phase: number) => {
    const phaseDef = PRODUCTION_PHASES[phase - 1]
    if (!phaseDef) return { completed: 0, total: 0 }
    const total = phaseDef.steps.length
    const completed = phaseDef.steps.filter(s => stepStatusMap.value[s.id] === 'completed').length
    return { completed, total }
  })

  /** 某步骤是否可操作（前置条件满足） */
  const canRunStep = computed(() => (stepId: string) => {
    // 找到该步骤在扁平列表中的位置
    const idx = ALL_PIPELINE_STEPS.findIndex(s => s.id === stepId)
    if (idx < 0) return false
    // 前面所有步骤都 completed 才能操作
    for (let i = 0; i < idx; i++) {
      if (stepStatusMap.value[ALL_PIPELINE_STEPS[i].id] !== 'completed') return false
    }
    return true
  })

  // --- Actions ---

  async function createJob(input: {
    title: string
    full_text?: string
    task_id?: string
    video_type?: string
    platforms?: string[]
  }): Promise<string> {
    loading.value = true
    try {
      const res = await createProductionJob(input)
      jobId.value = res.job_id
      taskId.value = res.task_id
      scriptId.value = res.script_id
      fullText.value = input.full_text || ''
      videoType.value = input.video_type || 'knowledge'
      steps.value[0].status = 'pending'
      steps.value[0].data = { script_id: res.script_id }
      return res.job_id
    } finally {
      loading.value = false
    }
  }

  async function loadJob(id: string): Promise<void> {
    loading.value = true
    try {
      const progress = await fetchProductionProgress(id)
      jobId.value = progress.job_id
      jobStatus.value = progress.job_status
      currentStep.value = progress.current_step
      steps.value = progress.steps

      // 恢复各步骤数据
      const s1 = progress.steps[0]?.data
      if (s1?.script_id) scriptId.value = Number(s1.script_id)
      if (s1?.full_text) fullText.value = String(s1.full_text)

      const s2 = progress.steps[1]?.data
      if (s2?.audio_urls) audioUrls.value = s2.audio_urls as string[]
      if (s2?.duration) audioDuration.value = Number(s2.duration)

      const s3 = progress.steps[2]?.data
      if (s3?.video_product_id) videoProductId.value = String(s3.video_product_id)
      if (s3?.video_url) videoUrl.value = String(s3.video_url)

      const s4 = progress.steps[3]?.data
      if (s4?.subtitle_style) subtitleStyle.value = s4.subtitle_style as typeof subtitleStyle.value

      // 恢复选题状态
      await loadExistingTopics()
    } finally {
      loading.value = false
    }
  }

  async function runStep(step: number, config?: Record<string, unknown>): Promise<void> {
    if (!jobId.value) return
    executing.value = true
    steps.value[step - 1].status = 'running'
    try {
      await executeProductionStep(jobId.value, step, config)

      // 轮询等待步骤完成
      if (step === 1 || step === 2 || step === 3) {
        // 分镜生成、TTS、渲染需要时间，轮询
        await pollStepCompletion(step)
      } else {
        // 字幕和发布步骤相对快，短暂等待后刷新
        await new Promise(r => setTimeout(r, 500))
        await refreshProgress()
      }

      // 步骤完成后，自动前进到下一步
      if (steps.value[step - 1]?.status === 'completed' && step < 5) {
        currentStep.value = step + 1
      }
    } finally {
      executing.value = false
    }
  }

  async function saveStepData(step: number, data: Record<string, unknown>): Promise<void> {
    if (!jobId.value) return
    await updateProductionStep(jobId.value, step, data)
    steps.value[step - 1].data = { ...steps.value[step - 1].data, ...data }
  }

  function goToStep(step: number): void {
    currentStep.value = step
  }

  // --- v2 Actions ---

  /** 切换到指定阶段 */
  function setPhase(phase: number): void {
    if (phase < 1 || phase > PRODUCTION_PHASES.length) return
    currentPhase.value = phase
    // 自动选中该阶段的第一个未完成工作步骤
    const phaseSteps = PRODUCTION_PHASES[phase - 1].steps
    const firstPending = phaseSteps.find(s => s.displayType === 'work' && stepStatusMap.value[s.id] !== 'completed')
    activeStepId.value = firstPending?.id || phaseSteps[0]?.id || null
  }

  /** 选中某个前端步骤 */
  function setActiveStep(stepId: string): void {
    activeStepId.value = stepId
  }

  /** 执行 v2 前端步骤（内部映射到后端步骤） */
  async function runV2Step(stepId: string, config?: Record<string, unknown>): Promise<void> {
    const backendStep = STEP_TO_BACKEND_MAP[stepId]
    if (backendStep !== null && backendStep !== undefined) {
      // 走后端执行器
      await runStep(backendStep, config)
    }
    // copyWriting 步骤不走后端执行器，由面板组件自己调用 copyWriting store
    // 摘要步骤不执行任何后端逻辑
  }

  /** 标记文案链已完成（由 CopyFinalizePanel 调用） */
  function markCopyDraftDone(): void {
    copyDraftDone.value = true
  }

  function markCopyProhibitedDone(): void {
    copyProhibitedDone.value = true
  }

  function markCopyFinalized(): void {
    copyFinalized.value = true
  }

  /** v2 一键生产：自动执行所有可执行步骤 */
  async function autoRunV2(): Promise<void> {
    executing.value = true
    try {
      for (const stepId of AUTO_RUNNABLE_STEPS) {
        const status = stepStatusMap.value[stepId]
        if (status === 'completed') continue
        if (!canRunStep.value(stepId)) continue

        activeStepId.value = stepId
        const backendStep = STEP_TO_BACKEND_MAP[stepId]
        if (backendStep !== null && backendStep !== undefined) {
          await runStep(backendStep)
        }
        // 文案链步骤由面板组件处理，一键生产时跳过
        if (stepId.startsWith('p2_')) continue
      }
    } finally {
      executing.value = false
    }
  }

  async function refreshProgress(): Promise<void> {
    if (!jobId.value) return
    try {
      const progress = await fetchProductionProgress(jobId.value)
      steps.value = progress.steps
      currentStep.value = progress.current_step
      jobStatus.value = progress.job_status

      // 同步本地状态
      const s3 = progress.steps[2]?.data
      if (s3?.video_url) videoUrl.value = String(s3.video_url)
      if (s3?.video_product_id) videoProductId.value = String(s3.video_product_id)
    } catch {
      // 静默失败，不影响用户操作
    }
  }

  function reset(): void {
    jobId.value = null
    taskId.value = ''
    scriptId.value = 0
    currentStep.value = 1
    jobStatus.value = ''
    currentPhase.value = 1
    activeStepId.value = null
    copyDraftDone.value = false
    copyProhibitedDone.value = false
    copyFinalized.value = false
    topicId.value = null
    topicTitle.value = ''
    topicProposals.value = []
    topicLoading.value = false
    topicSelected.value = false
    topicSources.value = null
    fullText.value = ''
    videoType.value = 'knowledge'
    audioUrls.value = []
    audioDuration.value = 0
    ttsEngine.value = 'edge_tts'
    ttsVoiceProfileId.value = null
    uploadedAudioMap.value = {}
    videoProductId.value = ''
    renderJobId.value = ''
    renderProgress.value = 0
    videoUrl.value = ''
    targetPlatforms.value = []
    steps.value = [
      { step: 1, name: 'script', status: 'pending', data: {} },
      { step: 2, name: 'tts', status: 'pending', data: {} },
      { step: 3, name: 'visual', status: 'pending', data: {} },
      { step: 4, name: 'subtitle', status: 'pending', data: {} },
      { step: 5, name: 'publish', status: 'pending', data: {} },
    ]
  }

  // --- 回退 ---
  const hasUnsavedChanges = computed(() =>
    jobId.value !== null && steps.value.some(s => s.status === 'running'),
  )

  async function rollbackToStep(step: number): Promise<void> {
    if (!jobId.value) return
    await rollbackProductionStep(jobId.value, step)
    // 将该步骤及之后的状态重置为 pending
    for (let i = step - 1; i < 5; i++) {
      steps.value[i].status = 'pending'
      steps.value[i].data = {}
    }
    currentStep.value = step
    // 清除对应的本地状态
    if (step <= 2) { audioUrls.value = []; audioDuration.value = 0 }
    if (step <= 3) { videoProductId.value = ''; renderJobId.value = ''; videoUrl.value = '' }
    if (step <= 4) { subtitleStyle.value = { font_size: 48, color: '#FFFFFF', position: 'bottom', bg_color: '#000000', bg_opacity: 0.6 } }
    if (step <= 5) { targetPlatforms.value = [] }
  }

  // --- 模板 ---
  const templates = ref<PipelineTemplateItem[]>([])

  async function loadTemplates(): Promise<void> {
    try {
      const res = await fetchPipelineTemplates()
      templates.value = res.items || []
    } catch {
      templates.value = []
    }
  }

  // --- 内部方法 ---

  async function pollStepCompletion(step: number, maxAttempts = 90): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000))
      await refreshProgress()
      if (steps.value[step - 1]?.status === 'completed') return
      if (steps.value[step - 1]?.status === 'failed') {
        const errData = steps.value[step - 1]?.data?.error as string | undefined
        const detail = errData ? `：${errData}` : ''
        throw new Error(`步骤 ${step} 执行失败${detail}`)
      }
    }
    throw new Error(`步骤 ${step} 超时（等待了 ${maxAttempts * 2} 秒）`)
  }

  // --- 选题共振方法 ---

  /** 加载多源灵感数据 */
  async function loadTopicSources(): Promise<void> {
    try {
      topicSources.value = await fetchTopicSourcesApi()
    } catch { /* 静默 */ }
  }

  /** AI 生成选题（异步：触发 → 轮询 → 加载结果） */
  async function generateTopics(count?: number): Promise<void> {
    if (!jobId.value) return
    topicLoading.value = true
    try {
      const res = await generateTopicsForPipelineApi(jobId.value, count)
      // 轮询直到完成
      const maxPoll = 60
      for (let i = 0; i < maxPoll; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const status = await pollTopicGenerationStatus(res.task_id)
        if (status.status === 'success' || status.status === 'completed') break
        if (status.status === 'failed') throw new Error('AI 生成选题失败')
      }
      // 加载结果
      await loadExistingTopics()
    } catch (e) {
      console.error('[generateTopics]', e)
    } finally {
      topicLoading.value = false
    }
  }

  /** 选用选题 */
  async function selectTopicAction(proposalId: number): Promise<void> {
    await selectTopicApi(proposalId)
    const selected = topicProposals.value.find(p => p.id === proposalId)
    if (selected) {
      topicId.value = selected.id
      topicTitle.value = selected.title
      topicSelected.value = true
    }
  }

  /** 加载已有选题（恢复项目时） */
  async function loadExistingTopics(): Promise<void> {
    if (!jobId.value) return
    try {
      const res = await fetchTopicProposalsByJob(jobId.value)
      topicProposals.value = res.items || []
      const selected = topicProposals.value.find(p => p.status === 'selected')
      if (selected) {
        topicId.value = selected.id
        topicTitle.value = selected.title
        topicSelected.value = true
      }
    } catch { /* 静默 */ }
  }

  return {
    // State
    jobId, taskId, scriptId, currentStep, steps, loading, executing, jobStatus,
    fullText, videoType, oralRatio,
    audioUrls, audioDuration, ttsVoice, ttsEngine, ttsVoiceProfileId, uploadedAudioMap,
    videoProductId, renderJobId, renderProgress, videoUrl,
    subtitleStyle,
    targetPlatforms,
    // v2 State
    currentPhase, activeStepId, copyDraftDone, copyProhibitedDone, copyFinalized,
    // 选题共振 State
    topicId, topicTitle, topicProposals, topicLoading, topicSelected, topicSources,
    // 发现信号
    discoverySignals, addDiscoverySignal, removeDiscoverySignal, clearDiscoverySignals, getDiscoveryContext,
    // Getters
    isStepCompleted, canAdvanceTo, isAllCompleted, hasUnsavedChanges,
    // v2 Getters
    currentPhaseSteps, stepStatusMap, phaseProgress, canRunStep,
    // Actions
    createJob, loadJob, runStep, saveStepData, goToStep, refreshProgress, reset,
    rollbackToStep, loadTemplates,
    // v2 Actions
    setPhase, setActiveStep, runV2Step, markCopyDraftDone, markCopyProhibitedDone, markCopyFinalized, autoRunV2,
    // 选题共振 Actions
    loadTopicSources, generateTopics, selectTopicAction, loadExistingTopics,
    // Templates
    templates,
  }
})
