import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { toInt } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

const PLATFORM_LABELS: Record<string, string> = { xiaohongshu: '小红书', douyin: '抖音', weixin: '视频号' }

function mapVideo(v: {
  id: number; accountId: string; platform: string; platformVideoId: string;
  title: string; coverUrl: string | null; videoUrl: string | null; duration: number;
  playCount: number; likeCount: number; commentCount: number; collectCount: number; shareCount: number;
  interactionRate: { toNumber: () => number } | null; transcript: string | null;
  analysisJson: unknown; publishedAt: Date; collectedAt: Date; taskId: string | null;
}) {
  return {
    id: v.id,
    account_id: v.accountId,
    platform: v.platform,
    platform_label: PLATFORM_LABELS[v.platform] ?? v.platform,
    platform_video_id: v.platformVideoId,
    title: v.title,
    cover_url: v.coverUrl,
    video_url: v.videoUrl,
    duration: v.duration,
    play_count: v.playCount,
    like_count: v.likeCount,
    comment_count: v.commentCount,
    collect_count: v.collectCount,
    share_count: v.shareCount,
    interaction_rate: v.interactionRate ? Number(v.interactionRate) : null,
    has_transcript: !!v.transcript,
    has_analysis: !!v.analysisJson,
    published_at: v.publishedAt.toISOString(),
    collected_at: v.collectedAt.toISOString(),
  }
}

// GET /api/v1/viral-videos — 列表
router.get('/viral-videos', async (req: Request, res: Response) => {
  try {
    const {
      platform, account_id,
      keyword, time_range = 'all',
      sort_by = 'play_count', order = 'desc',
      page = '1', page_size = '20',
    } = req.query as Record<string, string>
    const ps = Math.min(toInt(page_size, 20), 100)
    const skip = (toInt(page, 1) - 1) * ps

    const where: Record<string, unknown>[] = []
    if (platform && platform !== 'all') where.push({ platform })
    if (account_id) where.push({ accountId: account_id })
    if (keyword) where.push({ title: { contains: keyword, mode: 'insensitive' } })
    if (time_range && time_range !== 'all') {
      const days = toInt(time_range, 30)
      const since = new Date()
      since.setDate(since.getDate() - days)
      where.push({ createdAt: { gte: since } })
    }

    const sortFieldMap: Record<string, string> = {
      play_count: 'playCount',
      like_count: 'likeCount',
      comment_count: 'commentCount',
      created_at: 'createdAt',
    }
    const sortField = sortFieldMap[sort_by] ?? 'playCount'
    const sortOrder = order === 'asc' ? 'asc' : 'desc'

    const whereClause = where.length > 0 ? { AND: where } : undefined

    const [items, total] = await Promise.all([
      prisma.viralVideo.findMany({
        where: whereClause,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: ps,
      }),
      prisma.viralVideo.count({ where: whereClause }),
    ])

    res.json({ items: items.map(mapVideo), total })
  } catch (error) {
    console.error('[GET /viral-videos]', error)
    res.status(500).json({ error: 'Failed to load viral videos' })
  }
})

// GET /api/v1/viral-videos/:id — 详情
router.get('/viral-videos/:id', async (req: Request, res: Response) => {
  try {
    const video = await prisma.viralVideo.findUnique({
      where: { id: toInt(req.params.id) },
      include: { account: { select: { accountName: true, platform: true } } },
    })
    if (!video) {
      res.status(404).json({ error: 'Video not found' })
      return
    }
    res.json({
      ...mapVideo(video),
      account_name: video.account.accountName,
      transcript: video.transcript,
      analysis: video.analysisJson,
    })
  } catch (error) {
    console.error('[GET /viral-videos/:id]', error)
    res.status(500).json({ error: 'Failed to load video detail' })
  }
})

// POST /api/v1/viral-videos/analyze-batch — 批量分析（桩）
router.post('/viral-videos/analyze-batch', async (req: Request, res: Response) => {
  try {
    const { video_ids, ids } = req.body
    const videoIds = Array.isArray(video_ids) ? video_ids : Array.isArray(ids) ? ids : null
    if (!Array.isArray(videoIds)) {
      res.status(400).json({ error: 'video_ids array is required' })
      return
    }
    // TODO: 接入 AI 视频分析服务
    markStub(res, '批量分析未接入 AI 服务')
    res.json({ success: true, count: videoIds.length, message: 'Batch analysis queued (stub)' })
  } catch (error) {
    console.error('[POST /viral-videos/analyze-batch]', error)
    res.status(500).json({ error: 'Failed to start batch analysis' })
  }
})

// GET /api/v1/viral-videos/export — 导出（桩）
router.get('/viral-videos/export', async (_req: Request, res: Response) => {
  markStub(res, '导出功能未实现')
  res.json({ url: '', message: 'Export — stub' })
})

// POST /api/v1/viral-videos/:id/transcript/extract — 提取文案（桩）
router.post('/viral-videos/:id/transcript/extract', async (req: Request, res: Response) => {
  try {
    // TODO: 接入语音转文字服务
    markStub(res, '文案提取未接入语音转文字服务')
    const taskId = crypto.randomUUID()
    res.json({ task_id: taskId, status: 'pending' })
  } catch (error) {
    console.error('[POST transcript/extract]', error)
    res.status(500).json({ error: 'Failed to extract transcript' })
  }
})

// POST /api/v1/viral-videos/:id/analyze — 分析视频（桩）
router.post('/viral-videos/:id/analyze', async (req: Request, res: Response) => {
  try {
    // TODO: 接入 AI 分析服务
    markStub(res, '视频分析未接入 AI 服务')
    res.json({ success: true, message: 'Analysis queued (stub)' })
  } catch (error) {
    console.error('[POST viral-videos/:id/analyze]', error)
    res.status(500).json({ error: 'Failed to analyze video' })
  }
})

// PUT /api/v1/viral-videos/:id/transcript — 保存文案
router.put('/viral-videos/:id/transcript', async (req: Request, res: Response) => {
  try {
    const { transcript_text, transcript } = req.body
    const text = transcript_text ?? transcript
    const video = await prisma.viralVideo.update({
      where: { id: toInt(req.params.id) },
      data: { transcript: text ?? '' },
    })
    res.json({ success: true, has_transcript: !!video.transcript })
  } catch (error) {
    console.error('[PUT transcript]', error)
    res.status(500).json({ error: 'Failed to save transcript' })
  }
})

// GET /api/v1/viral-videos/:id/download — 下载（桩）
router.get('/viral-videos/:id/download', async (req: Request, res: Response) => {
  try {
    const video = await prisma.viralVideo.findUnique({ where: { id: toInt(req.params.id) } })
    if (!video) {
      res.status(404).json({ error: 'Video not found' })
      return
    }
    res.json({ url: video.videoUrl, title: video.title })
  } catch (error) {
    console.error('[GET download]', error)
    res.status(500).json({ error: 'Failed to get download URL' })
  }
})

export default router
