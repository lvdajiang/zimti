/**
 * 数据追踪路由 — DataSnapshot + VideoMetric CRUD + 趋势查询
 *
 * 提供发布后数据的手动录入、查询和聚合趋势展示。
 * 当前为手动录入模式，后续可接入平台 API 自动采集。
 */

import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str, toInt } from '../../constants.js'
import { getMetricsTrend } from '../../services/dataTracking/aggregator.js'

const router: Router = Router()

// ─── DataSnapshot CRUD ───

// POST /api/v1/data-tracking/snapshots — 创建单条快照
router.post('/data-tracking/snapshots', async (req: Request, res: Response) => {
  try {
    const {
      publish_record_id,
      snapshot_at,
      play_count,
      completion_rate,
      three_second_bounce_rate,
      comment_count,
      private_message_count,
    } = req.body

    if (!publish_record_id || !snapshot_at) {
      res.status(400).json({ error: 'publish_record_id and snapshot_at are required' })
      return
    }

    // 数值范围校验
    const pc = Math.max(0, Math.floor(play_count ?? 0))
    const cr = Math.min(100, Math.max(0, Number(completion_rate ?? 0)))
    const br = Math.min(100, Math.max(0, Number(three_second_bounce_rate ?? 0)))
    const cc = Math.max(0, Math.floor(comment_count ?? 0))
    const pmc = Math.max(0, Math.floor(private_message_count ?? 0))

    const snapshot = await prisma.dataSnapshot.create({
      data: {
        userId: DEMO_USER_ID,
        publishRecordId: publish_record_id,
        snapshotAt: new Date(snapshot_at),
        playCount: pc,
        completionRate: cr,
        threeSecondBounceRate: br,
        commentCount: cc,
        privateMessageCount: pmc,
      },
    })

    res.json(mapSnapshot(snapshot))
  } catch (error) {
    console.error('[POST data-tracking/snapshots]', error)
    res.status(500).json({ error: 'Failed to create snapshot' })
  }
})

// POST /api/v1/data-tracking/snapshots/batch — 批量创建
router.post('/data-tracking/snapshots/batch', async (req: Request, res: Response) => {
  try {
    const { snapshots } = req.body as {
      snapshots: Array<{
        publish_record_id: string
        snapshot_at: string
        play_count: number
        completion_rate: number
        three_second_bounce_rate: number
        comment_count: number
        private_message_count: number
      }>
    }

    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      res.status(400).json({ error: 'snapshots array is required' })
      return
    }

    if (snapshots.length > 100) {
      res.status(400).json({ error: 'snapshots array exceeds maximum of 100 items' })
      return
    }

    let created = 0
    for (const s of snapshots) {
      try {
        await prisma.dataSnapshot.create({
          data: {
            userId: DEMO_USER_ID,
            publishRecordId: s.publish_record_id,
            snapshotAt: new Date(s.snapshot_at),
            playCount: s.play_count ?? 0,
            completionRate: s.completion_rate ?? 0,
            threeSecondBounceRate: s.three_second_bounce_rate ?? 0,
            commentCount: s.comment_count ?? 0,
            privateMessageCount: s.private_message_count ?? 0,
          },
        })
        created++
      } catch (err) {
        // 单条失败不阻塞，但记录日志以便排查
        console.warn(`[batch snapshots] 创建失败 publish_record_id=${s.publish_record_id}:`, err instanceof Error ? err.message : err)
      }
    }

    res.json({ created })
  } catch (error) {
    console.error('[POST data-tracking/snapshots/batch]', error)
    res.status(500).json({ error: 'Failed to create batch snapshots' })
  }
})

// GET /api/v1/data-tracking/snapshots — 列表查询
router.get('/data-tracking/snapshots', async (req: Request, res: Response) => {
  try {
    const publishRecordId = str(req.query.publish_record_id)
    const p = toInt(req.query.page, 1)
    const ps = Math.min(toInt(req.query.page_size, 20), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown> = { userId: DEMO_USER_ID }
    if (publishRecordId) where.publishRecordId = publishRecordId

    const [items, total] = await Promise.all([
      prisma.dataSnapshot.findMany({
        where,
        orderBy: { snapshotAt: 'desc' },
        skip,
        take: ps,
        include: {
          publishRecord: {
            select: { platform: true, title: true },
          },
        },
      }),
      prisma.dataSnapshot.count({ where }),
    ])

    res.json({
      items: items.map(s => ({
        ...mapSnapshot(s),
        platform: s.publishRecord.platform,
        publish_title: s.publishRecord.title,
      })),
      total,
    })
  } catch (error) {
    console.error('[GET data-tracking/snapshots]', error)
    res.status(500).json({ error: 'Failed to fetch snapshots' })
  }
})

// ─── VideoMetric CRUD ───

// POST /api/v1/data-tracking/video-metrics — 创建视频指标
router.post('/data-tracking/video-metrics', async (req: Request, res: Response) => {
  try {
    const {
      video_id,
      date,
      play_count,
      like_count,
      comment_count,
      collect_count,
      interaction_rate,
    } = req.body

    if (!video_id || !date) {
      res.status(400).json({ error: 'video_id and date are required' })
      return
    }

    // upsert: 同一天同一视频只保留一条
    const metric = await prisma.videoMetric.upsert({
      where: {
        userId_videoId_date: {
          userId: DEMO_USER_ID,
          videoId: video_id,
          date: new Date(date),
        },
      },
      create: {
        userId: DEMO_USER_ID,
        videoId: video_id,
        date: new Date(date),
        playCount: play_count ?? 0,
        likeCount: like_count ?? 0,
        commentCount: comment_count ?? 0,
        collectCount: collect_count ?? 0,
        interactionRate: interaction_rate ?? null,
      },
      update: {
        playCount: play_count ?? 0,
        likeCount: like_count ?? 0,
        commentCount: comment_count ?? 0,
        collectCount: collect_count ?? 0,
        interactionRate: interaction_rate ?? null,
      },
    })

    res.json(mapMetric(metric))
  } catch (error) {
    console.error('[POST data-tracking/video-metrics]', error)
    res.status(500).json({ error: 'Failed to create video metric' })
  }
})

// GET /api/v1/data-tracking/video-metrics — 列表查询
router.get('/data-tracking/video-metrics', async (req: Request, res: Response) => {
  try {
    const videoId = str(req.query.video_id)
    const dateFrom = req.query.date_from ? new Date(req.query.date_from as string) : undefined
    const dateTo = req.query.date_to ? new Date(req.query.date_to as string) : undefined
    const p = toInt(req.query.page, 1)
    const ps = Math.min(toInt(req.query.page_size, 20), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown>[] = [{ userId: DEMO_USER_ID }]
    if (videoId) where.push({ videoId })
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (dateFrom) dateFilter.gte = dateFrom
      if (dateTo) dateFilter.lte = dateTo
      where.push({ date: dateFilter })
    }

    const [items, total] = await Promise.all([
      prisma.videoMetric.findMany({
        where: { AND: where },
        orderBy: { date: 'desc' },
        skip,
        take: ps,
      }),
      prisma.videoMetric.count({ where: { AND: where } }),
    ])

    res.json({
      items: items.map(mapMetric),
      total,
    })
  } catch (error) {
    console.error('[GET data-tracking/video-metrics]', error)
    res.status(500).json({ error: 'Failed to fetch video metrics' })
  }
})

// ─── 趋势查询 ───

// GET /api/v1/data-tracking/publish-records/:id/metrics-trend
router.get('/data-tracking/publish-records/:id/metrics-trend', async (req: Request, res: Response) => {
  try {
    const publishRecordId = str(req.params.id)
    const days = toInt(req.query.days, 30)

    const result = await getMetricsTrend(publishRecordId, days)
    res.json(result)
  } catch (error) {
    console.error('[GET metrics-trend]', error)
    res.status(500).json({ error: 'Failed to get metrics trend' })
  }
})

// ─── 辅助函数 ───

function mapSnapshot(s: {
  id: number
  userId: string
  publishRecordId: string
  snapshotAt: Date
  playCount: number
  completionRate: unknown
  threeSecondBounceRate: unknown
  commentCount: number
  privateMessageCount: number
  createdAt: Date
  publishRecord?: { platform: string; title: string | null }
}) {
  return {
    id: s.id,
    user_id: s.userId,
    publish_record_id: s.publishRecordId,
    snapshot_at: s.snapshotAt.toISOString(),
    play_count: s.playCount,
    completion_rate: Number(s.completionRate),
    three_second_bounce_rate: Number(s.threeSecondBounceRate),
    comment_count: s.commentCount,
    private_message_count: s.privateMessageCount,
    created_at: s.createdAt.toISOString(),
  }
}

function mapMetric(m: {
  id: string
  userId: string
  videoId: string
  date: Date
  playCount: number
  likeCount: number
  commentCount: number
  collectCount: number
  interactionRate: unknown
}) {
  return {
    id: m.id,
    user_id: m.userId,
    video_id: m.videoId,
    date: m.date.toISOString().slice(0, 10),
    play_count: m.playCount,
    like_count: m.likeCount,
    comment_count: m.commentCount,
    collect_count: m.collectCount,
    interaction_rate: m.interactionRate != null ? Number(m.interactionRate) : null,
  }
}

export default router
