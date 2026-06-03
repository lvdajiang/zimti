import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createProductionJob,
  fetchProductionProgress,
  executeProductionStep,
  updateProductionStep,
} from '../api/production'
import type { StepState } from '../api/production'

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

  // --- 步骤1: 脚本数据 ---
  const fullText = ref('')
  const videoType = ref('knowledge')
  const oralRatio = ref(0.7)

  // --- 步骤2: TTS 数据 ---
  const audioUrls = ref<string[]>([])
  const audioDuration = ref(0)
  const ttsVoice = ref('zh-CN-XiaoxiaoNeural')

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
    fullText.value = ''
    videoType.value = 'knowledge'
    audioUrls.value = []
    audioDuration.value = 0
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

  // --- 内部方法 ---

  async function pollStepCompletion(step: number, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000))
      await refreshProgress()
      if (steps.value[step - 1]?.status === 'completed') return
      if (steps.value[step - 1]?.status === 'failed') throw new Error(`步骤 ${step} 执行失败`)
    }
    throw new Error(`步骤 ${step} 超时`)
  }

  return {
    // State
    jobId, taskId, scriptId, currentStep, steps, loading, executing, jobStatus,
    fullText, videoType, oralRatio,
    audioUrls, audioDuration, ttsVoice,
    videoProductId, renderJobId, renderProgress, videoUrl,
    subtitleStyle,
    targetPlatforms,
    // Getters
    isStepCompleted, canAdvanceTo, isAllCompleted,
    // Actions
    createJob, loadJob, runStep, saveStepData, goToStep, refreshProgress, reset,
  }
})
