/**
 * 画面制作链 API
 *
 * 拍摄清单:
 *   POST   /pipeline/production/:jobId/shooting-plan/generate   AI 生成拍摄清单
 *   GET    /pipeline/production/:jobId/shooting-plan            获取列表
 *   PUT    /pipeline/production/:jobId/shooting-plan/:id        更新单条
 *   PUT    /pipeline/production/:jobId/shooting-plan/:id/status 标记状态
 *   POST   /pipeline/production/:jobId/shooting-plan/:id/match  手动匹配素材
 *
 * AI 画面生成:
 *   POST   /pipeline/production/:jobId/segment/:segmentIndex/generate-visual  即梦生成画面
 *   GET    /pipeline/production/:jobId/visual-task/:taskId/status              轮询生成状态
 *
 * 时间轴:
 *   POST   /pipeline/production/:jobId/timeline/build       构建时间轴
 *   GET    /pipeline/production/:jobId/timeline              获取时间轴
 *   PUT    /pipeline/production/:jobId/timeline/adjust       手动调整
 *   POST   /pipeline/production/:jobId/timeline/auto-align   AI 自动对齐
 *
 * 导出:
 *   POST   /pipeline/production/:jobId/export/remotion       Remotion 渲染
 *   POST   /pipeline/production/:jobId/export/jianying       导出剪映草稿
 */

import { Router } from 'express'
import { prisma } from '../../db.js'
import { str } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { generateShootingPlan } from '../../services/production/shootingPlanGenerator.js'
import { matchMaterialsForPlan, batchMatchByAi } from '../../services/production/materialMatcher.js'
import { JimengClient } from '../../services/ai/jimengClient.js'
import { createTask, getTask } from '../../services/ai/taskManager.js'
import { buildTimeline, autoAlignByDubbing, exportJianyingDraft, remotionRender } from '../../services/production/timelineService.js'
import type { Request, Response } from 'express'

const router: Router = Router()
router.use(optionalAuth)

// ── 辅助：从 jobId 获取 scriptId ───────────────────────
async function getScriptIdFromJob(jobId: string): Promise<number> {
  const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('流水线任务不存在')
  const output = (job.output || {}) as Record<string, unknown>
  const scriptId = output.script_id
  if (!scriptId) throw new Error('脚本尚未生成，请先完成步骤1')
  return Number(scriptId)
}

// ══════════════════════════════════════════════════════════
// 拍摄清单
// ══════════════════════════════════════════════════════════

/** AI 生成拍摄清单 */
router.post('/pipeline/production/:jobId/shooting-plan/generate', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const scriptId = await getScriptIdFromJob(jobId)
    const result = await generateShootingPlan(scriptId)
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ShootingPlan] generate error:', msg)
    res.status(500).json({ error: msg })
  }
})

/** 获取拍摄清单列表 */
router.get('/pipeline/production/:jobId/shooting-plan', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const scriptId = await getScriptIdFromJob(jobId)

    const plans = await prisma.shootingPlan.findMany({
      where: { scriptId },
      orderBy: { segmentIndex: 'asc' },
    })
    res.json(plans)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

/** 更新单条拍摄项 */
router.put('/pipeline/production/:jobId/shooting-plan/:id', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const { scene, props, cameraMovement, duration, notes } = req.body

    const updated = await prisma.shootingPlan.update({
      where: { id },
      data: {
        ...(scene !== undefined && { scene }),
        ...(props !== undefined && { props }),
        ...(cameraMovement !== undefined && { cameraMovement }),
        ...(duration !== undefined && { duration }),
        ...(notes !== undefined && { notes }),
        source: 'manual',
      },
    })
    res.json(updated)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

/** 标记拍摄状态 */
router.put('/pipeline/production/:jobId/shooting-plan/:id/status', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const { status } = req.body as { status: string }

    if (!['pending', 'shot', 'matched', 'skipped'].includes(status)) {
      res.status(400).json({ error: '无效状态，可选: pending/shot/matched/skipped' })
      return
    }

    const updated = await prisma.shootingPlan.update({
      where: { id },
      data: { status },
    })
    res.json(updated)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

/** 手动匹配素材 */
router.post('/pipeline/production/:jobId/shooting-plan/:id/match', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const { materialIds } = req.body as { materialIds: string[] }

    if (!Array.isArray(materialIds)) {
      res.status(400).json({ error: 'materialIds 必须是数组' })
      return
    }

    await matchMaterialsForPlan(id, materialIds)
    const plan = await prisma.shootingPlan.findUnique({ where: { id } })
    res.json(plan)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

// ══════════════════════════════════════════════════════════
// 批量 AI 素材匹配
// ══════════════════════════════════════════════════════════

/** AI 批量匹配素材到拍摄计划 */
router.post('/pipeline/production/:jobId/shooting-plan/batch-match', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const scriptId = await getScriptIdFromJob(jobId)
    const result = await batchMatchByAi(scriptId)
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

// ══════════════════════════════════════════════════════════
// AI 画面生成（即梦 t2v）
// ══════════════════════════════════════════════════════════

/** 用即梦 AI 为指定分镜段生成画面 */
router.post('/pipeline/production/:jobId/segment/:segmentIndex/generate-visual', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const segmentIndex = Number(req.params.segmentIndex)
    const scriptId = await getScriptIdFromJob(jobId)

    const client = JimengClient.createFromEnv()
    if (!client) {
      res.status(503).json({ error: '即梦 API 未配置（JIMENG_ACCESS_KEY/SECRET_KEY）' })
      return
    }

    // 获取分镜段的画面描述
    const segment = await prisma.storyboardSegment.findFirst({
      where: { scriptId, segmentIndex },
    })
    if (!segment) {
      res.status(404).json({ error: '分镜段不存在' })
      return
    }

    const prompt = segment.visualDescription || '通用视频画面'
    const { duration } = req.body as { duration?: number }

    // 提交即梦 t2v 任务
    const taskId = await client.submitTask({
      req_key: 'high_aes_t2v_25s_250514',
      prompt,
      duration: duration || 5,
    })

    // 通过 taskManager 跟踪（即梦是异步任务，状态通过即梦 API 轮询）
    const aiTask = await createTask({
      type: 'jimeng_t2v',
      input: {
        script_id: scriptId,
        segment_index: segmentIndex,
        jimeng_task_id: taskId,
        prompt,
      },
    })

    res.json({ task_id: aiTask.id, jimeng_task_id: taskId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ProductionVisual] generate-visual error:', msg)
    res.status(500).json({ error: msg })
  }
})

/** 轮询 AI 画面生成任务状态 */
router.get('/pipeline/production/:jobId/visual-task/:taskId/status', async (req: Request, res: Response) => {
  try {
    const taskId = str(req.params.taskId)
    const task = await getTask(taskId)

    if (!task) {
      res.status(404).json({ error: '任务不存在' })
      return
    }

    // 如果任务完成，将生成的视频推送到分镜段
    const output = task.output as Record<string, unknown> | null
    if (task.status === 'success' && output?.video_url) {
      const jobId = str(req.params.jobId)
      const scriptId = await getScriptIdFromJob(jobId)
      const input = task.input as Record<string, unknown> | undefined
      const segmentIndex = input?.segment_index as number | undefined

      if (segmentIndex !== undefined) {
        // 创建素材记录
        const material = await prisma.material.create({
          data: {
            userId: '',
            name: `AI生成画面 #${segmentIndex + 1}`,
            type: 'video',
            source: 'ai_generated',
            fileUrl: output.video_url as string,
            copyrightStatus: 'ai_generated',
            fileSize: BigInt(0),
            tags: ['ai_generated', 'jimeng'],
            metadata: { scriptId, segmentIndex, prompt: input?.prompt } as any,
          },
        })

        // 关联到分镜段
        const segment = await prisma.storyboardSegment.findFirst({
          where: { scriptId, segmentIndex },
        })
        if (segment) {
          const existingIds = segment.materialIds || []
          await prisma.storyboardSegment.update({
            where: { id: segment.id },
            data: { materialIds: [...existingIds, material.id] },
          })
        }
      }
    }

    res.json(task)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

// ══════════════════════════════════════════════════════════
// 时间轴
// ══════════════════════════════════════════════════════════

/** 构建时间轴 */
router.post('/pipeline/production/:jobId/timeline/build', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
    if (!job) { res.status(404).json({ error: '流水线任务不存在' }); return }
    const output = (job.output || {}) as Record<string, unknown>
    const videoProductId = output.video_product_id as string
    if (!videoProductId) { res.status(400).json({ error: '请先完成画面步骤（创建 VideoProduct）' }); return }

    const result = await buildTimeline(videoProductId)
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Timeline] build error:', msg)
    res.status(500).json({ error: msg })
  }
})

/** 获取时间轴 */
router.get('/pipeline/production/:jobId/timeline', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
    if (!job) { res.status(404).json({ error: '流水线任务不存在' }); return }
    const output = (job.output || {}) as Record<string, unknown>
    const videoProductId = output.video_product_id as string
    if (!videoProductId) { res.json(null); return }

    const timeline = await prisma.timeline.findUnique({ where: { videoProductId } })
    res.json(timeline)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

/** 手动调整时间轴 */
router.put('/pipeline/production/:jobId/timeline/adjust', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
    if (!job) { res.status(404).json({ error: '流水线任务不存在' }); return }
    const output = (job.output || {}) as Record<string, unknown>
    const videoProductId = output.video_product_id as string
    if (!videoProductId) { res.status(400).json({ error: '时间轴不存在' }); return }

    const { tracks } = req.body as { tracks: unknown }
    const timeline = await prisma.timeline.update({
      where: { videoProductId },
      data: { tracks: tracks as any, status: 'draft' },
    })
    res.json(timeline)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

/** AI 自动对齐 */
router.post('/pipeline/production/:jobId/timeline/auto-align', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
    if (!job) { res.status(404).json({ error: '流水线任务不存在' }); return }
    const output = (job.output || {}) as Record<string, unknown>
    const videoProductId = output.video_product_id as string
    if (!videoProductId) { res.status(400).json({ error: '请先构建时间轴' }); return }

    const result = await autoAlignByDubbing(videoProductId)
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Timeline] auto-align error:', msg)
    res.status(500).json({ error: msg })
  }
})

// ══════════════════════════════════════════════════════════
// 导出
// ══════════════════════════════════════════════════════════

/** Remotion 渲染 MP4 */
router.post('/pipeline/production/:jobId/export/remotion', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
    if (!job) { res.status(404).json({ error: '流水线任务不存在' }); return }
    const output = (job.output || {}) as Record<string, unknown>
    const videoProductId = output.video_product_id as string
    if (!videoProductId) { res.status(400).json({ error: '请先完成画面步骤' }); return }

    const renderJobId = await remotionRender(videoProductId)
    res.json({ render_job_id: renderJobId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Export] remotion error:', msg)
    res.status(500).json({ error: msg })
  }
})

/** 导出剪映草稿 JSON */
router.post('/pipeline/production/:jobId/export/jianying', async (req: Request, res: Response) => {
  try {
    const jobId = str(req.params.jobId)
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
    if (!job) { res.status(404).json({ error: '流水线任务不存在' }); return }
    const output = (job.output || {}) as Record<string, unknown>
    const videoProductId = output.video_product_id as string
    if (!videoProductId) { res.status(400).json({ error: '请先完成画面步骤' }); return }

    const timeline = await prisma.timeline.findUnique({ where: { videoProductId } })
    if (!timeline) { res.status(400).json({ error: '请先构建时间轴' }); return }

    const draft = await exportJianyingDraft(timeline.id)
    res.json(draft)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Export] jianying error:', msg)
    res.status(500).json({ error: msg })
  }
})

export default router
