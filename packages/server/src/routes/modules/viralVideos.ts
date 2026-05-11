import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { toInt } from '../../constants.js'
import { runTask } from '../../services/ai/taskManager.js'
import { analyzeViralVideo } from '../../services/ai/generators/videoAnalyze.js'

const router: Router = Router()

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

// POST /api/v1/viral-videos/analyze-batch — 批量分析
router.post('/viral-videos/analyze-batch', async (req: Request, res: Response) => {
  try {
    const { video_ids, ids } = req.body
    const videoIds = Array.isArray(video_ids) ? video_ids : Array.isArray(ids) ? ids : null
    if (!Array.isArray(videoIds)) {
      res.status(400).json({ error: 'video_ids array is required' })
      return
    }

    const taskIds: string[] = []
    const results = await Promise.allSettled(
      videoIds.map(async (videoId: number) => {
        const video = await prisma.viralVideo.findUnique({ where: { id: videoId } })
        if (!video) throw new Error(`Video ${videoId} not found`)

        const task = await runTask(
          { type: 'video_analyze_batch', input: { video_id: videoId }, refId: String(videoId), refType: 'viral_video' },
          () => analyzeViralVideo({ video_id: videoId }),
        )
        taskIds.push(task.id)
      }),
    )

    const failed = results.filter(r => r.status === 'rejected').length
    res.json({
      success: true,
      count: videoIds.length,
      task_ids: taskIds,
      failed_count: failed,
    })
  } catch (error) {
    console.error('[POST /viral-videos/analyze-batch]', error)
    res.status(500).json({ error: 'Failed to start batch analysis' })
  }
})

// GET /api/v1/viral-videos/export — 导出 CSV
router.get('/viral-videos/export', async (req: Request, res: Response) => {
  try {
    const {
      platform, account_id, keyword, time_range = 'all',
    } = req.query as Record<string, string>
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
    const whereClause = where.length > 0 ? { AND: where } : undefined
    const videos = await prisma.viralVideo.findMany({
      where: whereClause,
      orderBy: { playCount: 'desc' },
      take: 1000,
    })
    const header = '平台,标题,播放量,点赞数,评论数,收藏数,分享数,互动率,发布时间,收集时间\n'
    const rows = videos.map(v =>
      [
        v.platform, `"${(v.title ?? '').replace(/"/g, '""')}"`,
        v.playCount, v.likeCount, v.commentCount, v.collectCount, v.shareCount,
        v.interactionRate ? Number(v.interactionRate).toFixed(4) : '0',
        v.publishedAt.toISOString().slice(0, 10), v.collectedAt.toISOString().slice(0, 10),
      ].join(',')
    ).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=viral-videos-${Date.now()}.csv`)
    res.send('﻿' + header + rows)
  } catch (error) {
    console.error('[GET /viral-videos/export]', error)
    res.status(500).json({ error: 'Failed to export' })
  }
})

// POST /api/v1/viral-videos/:id/transcript/extract — 提取文案
router.post('/viral-videos/:id/transcript/extract', async (req: Request, res: Response) => {
  try {
    const videoId = toInt(req.params.id)
    const video = await prisma.viralVideo.findUnique({ where: { id: videoId } })
    if (!video) {
      res.status(404).json({ error: 'Video not found' })
      return
    }
    if (!video.videoUrl) {
      res.status(400).json({ error: '视频无 URL，无法提取文案' })
      return
    }

    const task = await runTask(
      { type: 'transcript_extract', input: { video_id: videoId, video_url: video.videoUrl }, refId: String(videoId), refType: 'viral_video' },
      async () => {
        const { extractTranscript } = await import('../../services/stt/index.js')
        const transcript = await extractTranscript({ video_url: video.videoUrl!, video_id: videoId })
        await prisma.viralVideo.update({
          where: { id: videoId },
          data: { transcript },
        })
        return { transcript }
      },
    )

    res.json({ task_id: task.id, status: 'pending' })
  } catch (error) {
    console.error('[POST transcript/extract]', error)
    res.status(500).json({ error: 'Failed to extract transcript' })
  }
})

// POST /api/v1/viral-videos/:id/analyze — 分析视频
router.post('/viral-videos/:id/analyze', async (req: Request, res: Response) => {
  try {
    const videoId = toInt(req.params.id)
    const video = await prisma.viralVideo.findUnique({ where: { id: videoId } })
    if (!video) {
      res.status(404).json({ error: 'Video not found' })
      return
    }

    const task = await runTask(
      { type: 'video_analyze', input: { video_id: videoId }, refId: String(videoId), refType: 'viral_video' },
      () => analyzeViralVideo({ video_id: videoId }),
    )

    res.json({ task_id: task.id, status: 'pending' })
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

// GET /api/v1/viral-videos/:id/download — 下载
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
