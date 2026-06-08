import { Router } from 'express'
import { prisma } from '../../db.js'
import { getUserId, str } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { synthesizeSpeech } from '../../services/tts/index.js'
import { startRender } from '../../services/render/renderService.js'
import { generateStoryboard } from '../../services/ai/generators/storyboardGenerate.js'
import type { Request, Response } from 'express'
import type { ProductionStepName } from '@zimti/shared'

const router: Router = Router()
router.use(optionalAuth)

// ============================================================
// 类型定义
// ============================================================

interface StepState {
  step: number
  name: ProductionStepName
  status: 'pending' | 'running' | 'completed' | 'failed'
  data: Record<string, unknown>
}

interface ProductionOutput {
  task_id?: string
  script_id?: number
  full_text?: string
  segment_ids?: number[]
  audio_urls?: string[]
  audio_duration?: number
  video_product_id?: string
  video_url?: string
  render_job_id?: string
  subtitle_style?: Record<string, unknown>
  publish_records?: Record<string, unknown>[]
}

interface StoryboardItem {
  segmentType?: string
  oralText?: string | null
  visualDescription?: string
  duration?: number
  transitionType?: string | null
}

const STEP_NAMES: ProductionStepName[] = ['script', 'tts', 'visual', 'subtitle', 'publish']

function buildDefaultSteps(): StepState[] {
  return STEP_NAMES.map((name, i) => ({
    step: i + 1,
    name,
    status: 'pending' as const,
    data: {},
  }))
}

/** 读取最新 output 并更新指定字段 */
async function updateOutput(jobId: string, patch: Partial<ProductionOutput>): Promise<ProductionOutput> {
  const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
  const existing = (job?.output ?? {}) as Record<string, unknown>
  const merged = { ...existing, ...patch } as any
  await prisma.pipelineJob.update({ where: { id: jobId }, data: { output: merged } })
  return merged as ProductionOutput
}

// ============================================================
// POST /api/v1/pipeline/production — 创建生产流水线任务
// ============================================================

router.post('/pipeline/production', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req as any)
    const { title, full_text, task_id, video_type, platforms } = req.body

    if (!title) {
      res.status(400).json({ error: 'title is required' })
      return
    }

    // 1. 创建或关联 Task
    let taskId = task_id
    if (!taskId) {
      const task = await prisma.task.create({
        data: {
          userId,
          title,
          description: `生产流水线: ${title}`,
          status: 'in_progress',
          currentStep: 1,
        },
      })
      taskId = task.id
    }

    // 2. 创建 TopicProposal 占位（Script 必须关联有效的 topicId）
    const placeholder = await prisma.topicProposal.create({
      data: {
        taskId,
        title: `[生产流水线] ${title}`,
        contentSkeleton: { source: 'pipeline', title },
        voiceRatio: 0.7,
        status: 'pipeline_draft',
      },
    })

    // 3. 创建 Script（通过 taskId 关联用户，无直接 userId）
    const script = await prisma.script.create({
      data: {
        taskId,
        topicId: placeholder.id,
        fullText: full_text || '',
        videoType: video_type || 'knowledge',
        oralRatio: 0.7,
        status: 'draft',
      },
    })

    // 4. 创建 PipelineJob
    const job = await prisma.pipelineJob.create({
      data: {
        userId,
        mode: 'production',
        status: 'pending',
        input: { title, video_type, platforms } as any,
        output: {
          task_id: taskId,
          script_id: script.id,
          full_text: full_text || '',
        } as any,
      },
    })

    res.status(201).json({
      job_id: job.id,
      task_id: taskId,
      script_id: script.id,
      status: 'pending',
    })
  } catch (error) {
    console.error('[POST /pipeline/production]', error)
    res.status(500).json({ error: 'Failed to create production job' })
  }
})

// ============================================================
// GET /api/v1/pipeline/production/:jobId/progress — 查询步骤进度
// ============================================================

router.get('/pipeline/production/:jobId/progress', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    // 防御：非 UUID 格式直接返回 404，避免 Prisma 报 500
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
      res.status(404).json({ error: 'Invalid job ID' })
      return
    }
    const job = await prisma.pipelineJob.findUnique({
      where: { id: jobId, userId: getUserId(req as any) },
    })
    if (!job) { res.status(404).json({ error: 'job not found' }); return }

    const output = (job.output || {}) as ProductionOutput
    const steps = buildDefaultSteps()

    // 从 job.error 中解析失败的步骤编号（格式: "Step N failed: ..."）
    const failedStepMatch = job.error?.match(/^Step (\d+) failed:/)
    const failedStep = failedStepMatch ? Number(failedStepMatch[1]) : null

    // 根据 output 中的字段推断各步骤状态
    if (output.segment_ids && output.segment_ids.length > 0) {
      steps[0].status = 'completed'
      steps[0].data = { script_id: output.script_id, full_text: output.full_text, segment_ids: output.segment_ids }
    }
    if (output.audio_urls && output.audio_urls.length > 0) {
      steps[1].status = 'completed'
      steps[1].data = { audio_urls: output.audio_urls, duration: output.audio_duration }
    }
    if (output.video_url) {
      steps[2].status = 'completed'
      steps[2].data = { video_product_id: output.video_product_id, video_url: output.video_url }
    } else if (output.render_job_id) {
      steps[2].status = 'running'
      steps[2].data = { video_product_id: output.video_product_id, render_job_id: output.render_job_id }
    }
    if (output.subtitle_style) {
      steps[3].status = 'completed'
      steps[3].data = { subtitle_style: output.subtitle_style }
    }
    if (output.publish_records && output.publish_records.length > 0) {
      steps[4].status = 'completed'
      steps[4].data = { publish_records: output.publish_records }
    }

    // 如果 job 整体失败，将失败步骤标记为 failed
    if (job.status === 'failed' && failedStep && failedStep >= 1 && failedStep <= 5) {
      const idx = failedStep - 1
      if (steps[idx].status !== 'completed') {
        steps[idx].status = 'failed'
        steps[idx].data = { ...steps[idx].data, error: job.error }
      }
    }

    // 找到当前步骤：第一个非 completed 的步骤
    const currentStep = steps.find(s => s.status !== 'completed')?.step ?? 5

    res.json({ job_id: job.id, job_status: job.status, current_step: currentStep, steps })
  } catch (error) {
    console.error('[GET /pipeline/production/:jobId/progress]', error)
    res.status(500).json({ error: 'Failed to get progress' })
  }
})

// ============================================================
// POST /api/v1/pipeline/production/:jobId/execute-step — 执行步骤
// ============================================================

router.post('/pipeline/production/:jobId/execute-step', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req as any)
    const jobId = str(req.params.jobId)
    const { step, config } = req.body as { step: number; config?: Record<string, unknown> }

    if (!step || step < 1 || step > 5) {
      res.status(400).json({ error: 'step must be 1-5' })
      return
    }

    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
    if (!job) { res.status(404).json({ error: 'job not found' }); return }

    // 立即返回，异步执行
    res.json({ job_id: jobId, step, status: 'running' })

    // 异步执行步骤
    const output = (job.output || {}) as ProductionOutput
    executeStep(jobId, userId, step, output, config).catch((err) => {
      console.error(`[executeStep] job=${jobId} step=${step} failed:`, err)
    })
  } catch (error) {
    console.error('[POST /pipeline/production/:jobId/execute-step]', error)
    res.status(500).json({ error: 'Failed to execute step' })
  }
})

// ============================================================
// POST /api/v1/pipeline/production/:jobId/update-step — 更新步骤数据
// ============================================================

router.post('/pipeline/production/:jobId/update-step', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const userId = getUserId(req as any)
    const { step, data } = req.body as { step: number; data: Record<string, unknown> }

    if (!step || step < 1 || step > 5) {
      res.status(400).json({ error: 'step must be 1-5' })
      return
    }

    const job = await prisma.pipelineJob.findUnique({
      where: { id: jobId, userId },
    })
    if (!job) { res.status(404).json({ error: 'job not found' }); return }

    const output = { ...((job.output ?? {}) as Record<string, unknown>) } as ProductionOutput

    switch (step) {
      case 1:
        if (data.script_id) output.script_id = Number(data.script_id)
        if (data.full_text !== undefined) output.full_text = String(data.full_text)
        if (data.segment_ids) output.segment_ids = data.segment_ids as number[]
        break
      case 2:
        if (data.audio_urls) output.audio_urls = data.audio_urls as string[]
        if (data.audio_duration !== undefined) output.audio_duration = Number(data.audio_duration)
        break
      case 3:
        if (data.video_product_id) output.video_product_id = String(data.video_product_id)
        if (data.video_url) output.video_url = String(data.video_url)
        if (data.render_job_id) output.render_job_id = String(data.render_job_id)
        break
      case 4:
        if (data.subtitle_style) output.subtitle_style = data.subtitle_style as Record<string, unknown>
        break
      case 5:
        if (data.publish_records) output.publish_records = data.publish_records as Record<string, unknown>[]
        break
    }

    await prisma.pipelineJob.update({
      where: { id: jobId },
      data: { output: output as any },
    })

    res.json({ job_id: jobId, step, status: 'updated' })
  } catch (error) {
    console.error('[POST /pipeline/production/:jobId/update-step]', error)
    res.status(500).json({ error: 'Failed to update step' })
  }
})

// ============================================================
// POST /api/v1/pipeline/production/:jobId/rollback — 回退到指定步骤
// ============================================================

router.post('/pipeline/production/:jobId/rollback', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const userId = getUserId(req as any)
    const { step } = req.body as { step: number }

    if (!step || step < 1 || step > 5) {
      res.status(400).json({ error: 'step must be 1-5' })
      return
    }

    const job = await prisma.pipelineJob.findUnique({
      where: { id: jobId, userId },
    })
    if (!job) { res.status(404).json({ error: 'job not found' }); return }

    // 清除该步骤及之后所有步骤的产出数据
    const output = { ...((job.output ?? {}) as Record<string, unknown>) }
    const fieldsToClear: Record<number, string[]> = {
      1: ['segment_ids'],
      2: ['audio_urls', 'audio_duration'],
      3: ['video_product_id', 'video_url', 'render_job_id'],
      4: ['subtitle_style'],
      5: ['publish_records'],
    }

    for (let s = step; s <= 5; s++) {
      for (const field of (fieldsToClear[s] || [])) {
        delete output[field]
      }
    }

    await prisma.pipelineJob.update({
      where: { id: jobId },
      data: { output: output as any, status: 'pending' },
    })

    res.json({ job_id: jobId, rolled_back_to: step, status: 'rolled_back' })
  } catch (error) {
    console.error('[POST /pipeline/production/:jobId/rollback]', error)
    res.status(500).json({ error: 'Failed to rollback' })
  }
})

// ============================================================
// 模板 CRUD
// ============================================================

// GET /api/v1/pipeline/templates — 模板列表
router.get('/pipeline/templates', async (req: Request, res: Response) => {
  try {
    const templates = await prisma.pipelineTemplate.findMany({
      where: { userId: getUserId(req as any), isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ items: templates })
  } catch (error) {
    console.error('[GET /pipeline/templates]', error)
    res.status(500).json({ error: 'Failed to list templates' })
  }
})

// POST /api/v1/pipeline/templates — 创建模板
router.post('/pipeline/templates', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req as any)
    const { name, steps } = req.body

    if (!name) { res.status(400).json({ error: 'name is required' }); return }
    if (!Array.isArray(steps)) { res.status(400).json({ error: 'steps must be an array' }); return }

    const template = await prisma.pipelineTemplate.create({
      data: { userId, name, mode: 'production', steps: steps as any },
    })
    res.status(201).json({ id: template.id, name: template.name })
  } catch (error) {
    console.error('[POST /pipeline/templates]', error)
    res.status(500).json({ error: 'Failed to create template' })
  }
})

// PUT /api/v1/pipeline/templates/:id — 更新模板
router.put('/pipeline/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const userId = getUserId(req as any)
    const { name, steps } = req.body

    const existing = await prisma.pipelineTemplate.findFirst({
      where: { id, userId },
    })
    if (!existing) { res.status(404).json({ error: 'template not found' }); return }

    const data: Record<string, unknown> = {}
    if (name) data.name = name
    if (Array.isArray(steps)) data.steps = steps as any

    await prisma.pipelineTemplate.update({ where: { id }, data })
    res.json({ id, status: 'updated' })
  } catch (error) {
    console.error('[PUT /pipeline/templates/:id]', error)
    res.status(500).json({ error: 'Failed to update template' })
  }
})

// DELETE /api/v1/pipeline/templates/:id — 删除模板（软删除）
router.delete('/pipeline/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const userId = getUserId(req as any)

    const existing = await prisma.pipelineTemplate.findFirst({
      where: { id, userId },
    })
    if (!existing) { res.status(404).json({ error: 'template not found' }); return }

    await prisma.pipelineTemplate.update({
      where: { id },
      data: { isActive: false },
    })
    res.json({ id, status: 'deleted' })
  } catch (error) {
    console.error('[DELETE /pipeline/templates/:id]', error)
    res.status(500).json({ error: 'Failed to delete template' })
  }
})

// ============================================================
// 步骤执行器
// ============================================================

async function executeStep(
  jobId: string,
  userId: string,
  step: number,
  output: ProductionOutput,
  config?: Record<string, unknown>,
): Promise<void> {
  try {
    switch (step) {
      case 1: await executeScriptStep(jobId, output, config); break
      case 2: await executeTtsStep(jobId, output, config); break
      case 3: await executeVisualStep(jobId, userId, output, config); break
      case 4: await executeSubtitleStep(jobId, output, config); break
      case 5: await executePublishStep(jobId, userId, output, config); break
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[executeStep] step=${step} error:`, errMsg)
    await prisma.pipelineJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: `Step ${step} failed: ${errMsg}` },
    })
  }
}

/** 步骤1: AI 生成分镜 → 写入 StoryboardSegment 表 */
async function executeScriptStep(
  jobId: string,
  output: ProductionOutput,
  config?: Record<string, unknown>,
): Promise<void> {
  const scriptId = output.script_id
  if (!scriptId) throw new Error('script_id not found in output')

  const videoType = (config?.video_type as string) || 'knowledge'

  // 先确保脚本已保存
  if (output.full_text) {
    await prisma.script.update({
      where: { id: scriptId },
      data: { fullText: output.full_text, videoType },
    })
  }

  // 直接调用生成器（不走 runTask，避免 AITask 中间层）
  const result = await generateStoryboard({ script_id: scriptId, video_type: videoType })

  // 解析分镜数据并写入 DB
  const rawSegments = Array.isArray(result) ? result : (result as any)?.segments ?? []
  const validTypes = ['oral', 'visual', 'transition']

  // 删除旧分镜
  await prisma.storyboardSegment.deleteMany({ where: { scriptId } })

  const segmentIds: number[] = []
  for (let i = 0; i < rawSegments.length; i++) {
    const item: StoryboardItem = rawSegments[i]
    const segType = validTypes.includes(item.segmentType || '') ? item.segmentType! : 'oral'

    const seg = await prisma.storyboardSegment.create({
      data: {
        scriptId,
        segmentIndex: i,
        segmentType: segType as any,
        oralText: item.oralText || null,
        visualDescription: item.visualDescription || '',
        duration: item.duration || 3.0,
        transitionType: item.transitionType || null,
      },
    })
    segmentIds.push(seg.id)
  }

  await updateOutput(jobId, { segment_ids: segmentIds })
}

/** 步骤2: TTS 配音 */
async function executeTtsStep(
  jobId: string,
  output: ProductionOutput,
  config?: Record<string, unknown>,
): Promise<void> {
  const scriptId = output.script_id
  if (!scriptId) throw new Error('script_id not found in output')

  const voice = (config?.voice as string) || 'zh-CN-XiaoxiaoNeural'
  const rate = (config?.rate as string) || '+0%'
  const volume = (config?.volume as string) || '+0%'

  // 获取所有 oral 类型的分镜片段
  const segments = await prisma.storyboardSegment.findMany({
    where: { scriptId, segmentType: 'oral' },
    orderBy: { segmentIndex: 'asc' },
  })

  if (segments.length === 0) throw new Error('No oral segments found')

  const audioUrls: string[] = []
  let totalDuration = 0

  for (const seg of segments) {
    if (!seg.oralText) continue
    const result = await synthesizeSpeech({
      text: seg.oralText,
      voice,
      rate,
      volume,
    })

    // 更新分镜片段的音频 URL
    await prisma.storyboardSegment.update({
      where: { id: seg.id },
      data: { oralAudioUrl: result.filePath },
    })

    audioUrls.push(result.filePath)
    totalDuration += result.duration
  }

  await updateOutput(jobId, { audio_urls: audioUrls, audio_duration: totalDuration })
}

/** 步骤3: 视频渲染 */
async function executeVisualStep(
  jobId: string,
  _userId: string,
  output: ProductionOutput,
  _config?: Record<string, unknown>,
): Promise<void> {
  const scriptId = output.script_id
  if (!scriptId) throw new Error('script_id not found in output')

  // 确保有 VideoProduct
  let videoProductId = output.video_product_id

  if (!videoProductId) {
    const vp = await prisma.videoProduct.create({
      data: {
        taskId: output.task_id || '',
        scriptId,
        title: '生产流水线视频',
        platform: 'douyin',
        resolution: '1080x1920',
        duration: 0,
        renderConfig: {
          subtitle_style: output.subtitle_style || {},
          bgm_volume: 0.3,
          voice_volume: 1.0,
        } as any,
      },
    })
    videoProductId = vp.id
  }

  // 启动渲染
  const renderJobId = await startRender(videoProductId)

  await updateOutput(jobId, {
    video_product_id: videoProductId,
    render_job_id: renderJobId,
  })
}

/** 步骤4: 字幕配置 */
async function executeSubtitleStep(
  jobId: string,
  output: ProductionOutput,
  config?: Record<string, unknown>,
): Promise<void> {
  const subtitleStyle = config?.subtitle_style || {
    font_size: 48,
    color: '#FFFFFF',
    position: 'bottom',
    bg_color: '#000000',
    bg_opacity: 0.6,
  }

  // 更新 VideoProduct 的 renderConfig
  if (output.video_product_id) {
    const vp = await prisma.videoProduct.findUnique({
      where: { id: output.video_product_id },
    })
    if (vp) {
      const renderConfig = (vp.renderConfig || {}) as Record<string, unknown>
      await prisma.videoProduct.update({
        where: { id: output.video_product_id },
        data: { renderConfig: { ...renderConfig, subtitle_style: subtitleStyle } as any },
      })
    }
  }

  await updateOutput(jobId, {
    subtitle_style: subtitleStyle as Record<string, unknown>,
  })
}

/** 步骤5: 发布 — 为每个目标平台创建 PublishRecord + DistributionRecord */
async function executePublishStep(
  jobId: string,
  userId: string,
  output: ProductionOutput,
  config?: Record<string, unknown>,
): Promise<void> {
  const videoProductId = output.video_product_id
  if (!videoProductId) throw new Error('video_product_id not found — 请先完成视频渲染步骤')

  // 读取目标平台列表（从 config 或 job input 获取）
  const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
  const jobInput = (job?.input ?? {}) as Record<string, unknown>
  const platforms = (config?.platforms ?? jobInput.platforms ?? ['douyin']) as string[]

  // 获取视频作品和脚本信息
  const vp = await prisma.videoProduct.findUnique({
    where: { id: videoProductId },
    include: { script: { include: { topicProposal: true } } },
  })
  if (!vp) throw new Error(`VideoProduct ${videoProductId} not found`)

  const title = vp.title || vp.script?.topicProposal?.title || '未命名视频'
  const description = vp.script?.fullText || ''

  const publishRecords: Record<string, unknown>[] = []

  for (const platform of platforms) {
    // 1. 创建 PublishRecord
    const publishRecord = await prisma.publishRecord.create({
      data: {
        videoProductId,
        platform,
        title,
        description: description.slice(0, 500),
        status: 'unpublished',
        conversionType: 'awareness',
      },
    })

    // 2. 创建 DistributionRecord（供后续内容适配 + 发布排期）
    await prisma.distributionRecord.create({
      data: {
        userId,
        sourceContentId: publishRecord.id,
        sourceType: 'publish_record',
        platform,
        adaptedTitle: title,
        adaptedContent: description.slice(0, 500),
        characterCount: Math.min(description.length, 500),
        status: 'draft',
      },
    })

    publishRecords.push({
      publish_record_id: publishRecord.id,
      platform,
      status: 'unpublished',
    })
  }

  await prisma.pipelineJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      output: { ...output, publish_records: publishRecords } as any,
    },
  })
}

export default router
