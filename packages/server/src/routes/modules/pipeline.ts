import { Router } from 'express'
import { prisma } from '../../db.js'
import { getUserId, str, toInt } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { getAIProvider } from '../../services/ai/provider.js'
import { BrandMemoryService } from '../../services/aiHub/brandMemory.js'
import type { Request, Response } from 'express'
import type { PipelineMode } from '@zimti/shared'

const VALID_MODES: PipelineMode[] = ['viral_remind', 'daily_auto', 'hotspot_rush', 'customer_question']

const router: Router = Router()
router.use(optionalAuth)

// POST /api/v1/pipeline/viral-remind — 爆款翻新
router.post('/pipeline/viral-remind', async (req: Request, res: Response) => {
  const { video_url, video_text } = req.body
  if (!video_url && !video_text) {
    res.status(400).json({ error: 'video_url or video_text is required' })
    return
  }

  const job = await prisma.pipelineJob.create({
    data: {
      userId: getUserId(req as any),
      mode: 'viral_remind',
      status: 'pending',
      input: { video_url, video_text },
    },
  })

  // 异步执行流水线（实际项目中应使用任务队列）
  runViralRemindPipeline(job.id, getUserId(req as any)).catch(() => {})

  res.status(201).json({ id: job.id, status: 'pending' })
})

// GET /api/v1/pipeline/daily-status — 每日自动状态
router.get('/pipeline/daily-status', async (req: Request, res: Response) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayJobs = await prisma.pipelineJob.findMany({
    where: { userId: getUserId(req as any), mode: 'daily_auto', createdAt: { gte: today } },
    orderBy: { createdAt: 'desc' },
  })

  res.json({ today_jobs: todayJobs, has_run_today: todayJobs.length > 0 })
})

// POST /api/v1/pipeline/hotspot-rush — 热点紧急出片
router.post('/pipeline/hotspot-rush', async (req: Request, res: Response) => {
  const { hotspot_title, hotspot_desc } = req.body
  if (!hotspot_title) {
    res.status(400).json({ error: 'hotspot_title is required' })
    return
  }

  const job = await prisma.pipelineJob.create({
    data: {
      userId: getUserId(req as any),
      mode: 'hotspot_rush',
      status: 'pending',
      input: { hotspot_title, hotspot_desc },
    },
  })

  res.status(201).json({ id: job.id, status: 'pending' })
})

// POST /api/v1/pipeline/customer-question — CRM 驱动出片
router.post('/pipeline/customer-question', async (req: Request, res: Response) => {
  const { question, customer_ids } = req.body
  if (!question) {
    res.status(400).json({ error: 'question is required' })
    return
  }

  const job = await prisma.pipelineJob.create({
    data: {
      userId: getUserId(req as any),
      mode: 'customer_question',
      status: 'pending',
      input: { question, customer_ids },
    },
  })

  res.status(201).json({ id: job.id, status: 'pending' })
})

// GET /api/v1/pipeline/jobs — 任务列表
router.get('/pipeline/jobs', async (req: Request, res: Response) => {
  const mode = str(req.query.mode) as PipelineMode | ''
  const status = str(req.query.status)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 20), 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (mode && VALID_MODES.includes(mode)) where.mode = mode
  if (status) where.status = status

  const [items, total] = await Promise.all([
    prisma.pipelineJob.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p - 1) * ps, take: ps }),
    prisma.pipelineJob.count({ where }),
  ])

  res.json({ items, total })
})

// GET /api/v1/pipeline/jobs/:id — 任务详情
router.get('/pipeline/jobs/:id', async (req: Request, res: Response) => {
  const job = await prisma.pipelineJob.findUnique({
    where: { id: str(req.params.id), userId: getUserId(req as any) },
  })
  if (!job) { res.status(404).json({ error: 'job not found' }); return }
  res.json(job)
})

// ============================================================
// 流水线执行（简化版，实际应使用任务队列）
// ============================================================

async function runViralRemindPipeline(jobId: string, userId: string): Promise<void> {
  try {
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
    if (!job) return

    await prisma.pipelineJob.update({ where: { id: jobId }, data: { status: 'running' } })

    const input = job.input as { video_url?: string; video_text?: string }
    const ai = getAIProvider()
    if (!ai) throw new Error('AI 服务不可用')

    // Step 1: 如果有视频URL，提取文案（此处简化，实际需要下载+whisper）
    let originalText = input.video_text ?? ''
    if (!originalText && input.video_url) {
      originalText = `[待提取: ${input.video_url}]`
    }

    // Step 2: AI 改写（注入品牌记忆 + 去AI味）
    const brandMemory = new BrandMemoryService(userId)
    const context = await brandMemory.getContext()

    const prompt = `将以下爆款文案改写为自己的版本，注入个人风格。${context ? `\n\n${context}` : ''}

原始文案：
${originalText}

要求：
1. 保持核心信息点
2. 改写为口语化、真诚的表达
3. 避免"不可错过"、"总而言之"等AI味表达
4. 如果有品牌画像，匹配对应风格

返回 JSON：{ "rewritten_text": "改写后的文案" }`

    const result = await ai.generate(prompt, '你是文案改写专家。返回纯 JSON。')
    const parsed = JSON.parse(result)

    await prisma.pipelineJob.update({
      where: { id: jobId },
      data: {
        status: 'waiting_confirm',
        output: { rewritten_text: parsed.rewritten_text },
      },
    })
  } catch (err) {
    await prisma.pipelineJob.update({
      where: { id: jobId },
      data: { status: 'failed', error: String(err) },
    })
  }
}

export default router
