import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

// GET /api/v1/dashboard/workflow — 任务工作流状态
router.get('/dashboard/workflow', async (_req: Request, res: Response) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, title: true, status: true, currentStep: true, createdAt: true,
        topicProposals: { select: { id: true } },
        scripts: { select: { id: true, status: true } },
        videoProducts: { select: { id: true, status: true } },
      },
    })
    res.json({
      items: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        current_step: t.currentStep,
        has_topic: t.topicProposals.length > 0,
        has_script: t.scripts.length > 0,
        script_status: t.scripts[0]?.status ?? null,
        has_video: t.videoProducts.length > 0,
        video_status: t.videoProducts[0]?.status ?? null,
        created_at: t.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[GET /dashboard/workflow]', error)
    res.status(500).json({ error: 'Failed to load workflow' })
  }
})

// GET /api/v1/dashboard/stats — 总体统计
router.get('/dashboard/stats', async (_req: Request, res: Response) => {
  try {
    const [totalTasks, activeTasks, totalVideos, publishedVideos, totalMaterials, totalAssets] = await Promise.all([
      prisma.task.count({ where: { userId: DEMO_USER_ID } }),
      prisma.task.count({ where: { userId: DEMO_USER_ID, status: { not: 'completed' } } }),
      prisma.videoProduct.count({ where: { task: { userId: DEMO_USER_ID } } }),
      prisma.videoProduct.count({ where: { task: { userId: DEMO_USER_ID }, status: 'published' } }),
      prisma.material.count({ where: { userId: DEMO_USER_ID } }),
      prisma.contentAsset.count({ where: { userId: DEMO_USER_ID } }),
    ])

    // 近7天新增任务数（用于趋势对比）
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentTasks = await prisma.task.count({ where: { userId: DEMO_USER_ID, createdAt: { gte: sevenDaysAgo } } })
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const prevTasks = await prisma.task.count({ where: { userId: DEMO_USER_ID, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } })
    const taskTrend = prevTasks > 0
      ? Math.round((recentTasks - prevTasks) / prevTasks * 100)
      : (recentTasks > 0 ? 100 : null)

    // 近7天新增视频数
    const recentVideos = await prisma.videoProduct.count({ where: { task: { userId: DEMO_USER_ID }, createdAt: { gte: sevenDaysAgo } } })
    const prevVideos = await prisma.videoProduct.count({ where: { task: { userId: DEMO_USER_ID }, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } })
    const videoTrend = prevVideos > 0
      ? Math.round((recentVideos - prevVideos) / prevVideos * 100)
      : (recentVideos > 0 ? 100 : null)

    res.json({
      total_tasks: totalTasks, active_tasks: activeTasks, total_videos: totalVideos,
      published_videos: publishedVideos, total_materials: totalMaterials, total_assets: totalAssets,
      task_trend: taskTrend, video_trend: videoTrend,
    })
  } catch (error) {
    console.error('[GET /dashboard/stats]', error)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})

// GET /api/v1/dashboard/overview — 概览指标
router.get('/dashboard/overview', async (_req: Request, res: Response) => {
  try {
    // 最近7天发布数
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentPublishes = await prisma.publishRecord.count({
      where: { videoProduct: { task: { userId: DEMO_USER_ID } }, publishedAt: { gte: sevenDaysAgo } },
    })

    // 上周发布数（趋势对比）
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const prevWeekPublishes = await prisma.publishRecord.count({
      where: { videoProduct: { task: { userId: DEMO_USER_ID } }, publishedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    })
    const publishTrend = prevWeekPublishes > 0
      ? Math.round((recentPublishes - prevWeekPublishes) / prevWeekPublishes * 100)
      : (recentPublishes > 0 ? 100 : null)

    // 平均完播率
    const snapshots = await prisma.dataSnapshot.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { completionRate: true, playCount: true },
    })
    const avgCompletion = snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + Number(s.completionRate), 0) / snapshots.length
      : 0

    // 总播放量
    const totalPlays = await prisma.dataSnapshot.aggregate({
      where: { userId: DEMO_USER_ID },
      _max: { playCount: true },
    })

    res.json({
      recent_publishes_7d: recentPublishes,
      recent_publishes_7d_trend: publishTrend,
      avg_completion_rate: Math.round(avgCompletion * 100) / 100,
      total_plays: totalPlays._max.playCount ?? 0,
      total_snapshots: snapshots.length,
    })
  } catch (error) {
    console.error('[GET /dashboard/overview]', error)
    res.status(500).json({ error: 'Failed to load overview' })
  }
})

// GET /api/v1/dashboard/video-records — 视频发布记录
router.get('/dashboard/video-records', async (req: Request, res: Response) => {
  try {
    const { page = '1', page_size = '20', platform } = req.query
    const ps = Math.min(Number(page_size), 100)
    const skip = (Number(page) - 1) * ps

    const whereClause: any = { videoProduct: { task: { userId: DEMO_USER_ID } } }
    if (platform && platform !== 'all') {
      whereClause.platform = platform as string
    }

    const records = await prisma.publishRecord.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: ps,
      include: {
        videoProduct: { select: { title: true, status: true } },
        dataSnapshots: {
          orderBy: { snapshotAt: 'desc' },
          take: 1,
          select: { playCount: true, completionRate: true, commentCount: true },
        },
      },
    })
    const total = await prisma.publishRecord.count({
      where: whereClause,
    })

    res.json({
      items: records.map(r => ({
        id: r.id,
        video_title: r.videoProduct.title,
        platform: r.platform,
        status: r.status,
        publish_url: r.publishUrl,
        published_at: r.publishedAt?.toISOString() ?? null,
        latest_metrics: r.dataSnapshots[0] ? {
          play_count: r.dataSnapshots[0].playCount,
          completion_rate: Number(r.dataSnapshots[0].completionRate),
          comment_count: r.dataSnapshots[0].commentCount,
        } : null,
      })),
      total,
    })
  } catch (error) {
    console.error('[GET /dashboard/video-records]', error)
    res.status(500).json({ error: 'Failed to load video records' })
  }
})

// GET /api/v1/dashboard/trends — 趋势数据
router.get('/dashboard/trends', async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const snapshots = await prisma.dataSnapshot.findMany({
      where: { userId: DEMO_USER_ID, snapshotAt: { gte: thirtyDaysAgo } },
      orderBy: { snapshotAt: 'asc' },
      select: { snapshotAt: true, playCount: true, completionRate: true, commentCount: true },
    })

    res.json({
      points: snapshots.map(s => ({
        date: s.snapshotAt.toISOString().slice(0, 10),
        play_count: s.playCount,
        completion_rate: Number(s.completionRate),
        comment_count: s.commentCount,
      })),
    })
  } catch (error) {
    console.error('[GET /dashboard/trends]', error)
    res.status(500).json({ error: 'Failed to load trends' })
  }
})

// GET /api/v1/dashboard/snapshots — 快照列表
router.get('/dashboard/snapshots', async (req: Request, res: Response) => {
  try {
    const { page = '1', page_size = '20' } = req.query
    const ps = Math.min(Number(page_size), 100)
    const skip = (Number(page) - 1) * ps

    const [items, total] = await Promise.all([
      prisma.dataSnapshot.findMany({
        where: { userId: DEMO_USER_ID },
        orderBy: { createdAt: 'desc' },
        skip,
        take: ps,
        include: { publishRecord: { select: { id: true, platform: true } } },
      }),
      prisma.dataSnapshot.count({ where: { userId: DEMO_USER_ID } }),
    ])

    res.json({
      items: items.map(s => ({
        id: s.id,
        publish_record_id: s.publishRecordId,
        platform: s.publishRecord.platform,
        snapshot_at: s.snapshotAt.toISOString(),
        play_count: s.playCount,
        completion_rate: Number(s.completionRate),
        bounce_rate: Number(s.threeSecondBounceRate),
        comment_count: s.commentCount,
        message_count: s.privateMessageCount,
      })),
      total,
    })
  } catch (error) {
    console.error('[GET /dashboard/snapshots]', error)
    res.status(500).json({ error: 'Failed to load snapshots' })
  }
})

// POST /api/v1/dashboard/ai-analysis — AI 分析（桩）
router.post('/dashboard/ai-analysis', async (_req: Request, res: Response) => {
  try {
    const taskId = crypto.randomUUID()
    markStub(res, 'AI 分析服务未接入')
    res.json({ task_id: taskId, status: 'pending' })
  } catch (error) {
    console.error('[POST /dashboard/ai-analysis]', error)
    res.status(500).json({ error: 'Failed to start AI analysis' })
  }
})

// GET /api/v1/dashboard/ai-analysis/:taskId/status — AI 分析状态（桩）
router.get('/dashboard/ai-analysis/:taskId/status', async (_req: Request, res: Response) => {
  markStub(res, 'AI 分析状态查询为桩')
  res.json({ status: 'pending', progress: 0 })
})

export default router
