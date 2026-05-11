import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { toInt } from '../../constants.js'
import { runTask } from '../../services/ai/taskManager.js'

const router: Router = Router()

const PLATFORM_LABELS: Record<string, string> = { xiaohongshu: '小红书', douyin: '抖音', weixin: '视频号', weibo: '微博' }

function mapHotspot(h: {
  id: number; title: string; sourcePlatform: string; source: string;
  sourceUrl: string | null; relevanceScore: { toNumber: () => number };
  validUntil: Date | null; createdAt: Date;
  heatValue: number; heatTrend: string; keywords: string[];
  usageStatus: string; note: string | null;
}) {
  return {
    id: h.id,
    title: h.title,
    source_platform: h.sourcePlatform,
    source_platform_label: PLATFORM_LABELS[h.sourcePlatform] ?? h.sourcePlatform,
    source: h.source,
    source_url: h.sourceUrl,
    relevance_score: Number(h.relevanceScore),
    valid_until: h.validUntil?.toISOString() ?? null,
    is_expired: h.validUntil ? h.validUntil < new Date() : false,
    heat_value: h.heatValue,
    heat_trend: h.heatTrend,
    keywords: h.keywords,
    usage_status: h.usageStatus,
    note: h.note,
    created_at: h.createdAt.toISOString(),
  }
}

// GET /api/v1/hotspots — 热点列表
router.get('/hotspots', async (req: Request, res: Response) => {
  try {
    const {
      platform, keyword, sort_by = 'heat_value', order = 'desc',
      time_range, page = '1', page_size = '20',
    } = req.query
    const p = toInt(String(page), 1)
    const ps = Math.min(toInt(String(page_size), 20), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown> = {}
    if (platform && platform !== 'all') where.sourcePlatform = String(platform)

    if (keyword) {
      where.OR = [
        { title: { contains: String(keyword), mode: 'insensitive' } },
        { keywords: { has: String(keyword) } },
      ]
    }

    if (time_range) {
      const now = new Date()
      let start: Date
      if (time_range === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (time_range === 'week') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else if (time_range === 'month') {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      } else {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }
      where.createdAt = { gte: start }
    }

    const sortField = String(sort_by) === 'relevance_score' ? 'relevanceScore'
      : String(sort_by) === 'created_at' ? 'createdAt'
      : 'heatValue'
    const orderBy: Record<string, string> = { [sortField]: order === 'asc' ? 'asc' : 'desc' }

    const [items, total] = await Promise.all([
      prisma.hotspot.findMany({ where, orderBy, skip, take: ps }),
      prisma.hotspot.count({ where }),
    ])

    res.json({ items: items.map(mapHotspot), total })
  } catch (error) {
    console.error('[GET /hotspots]', error)
    res.status(500).json({ error: 'Failed to load hotspots' })
  }
})

// POST /api/v1/hotspots/refresh — 刷新热点
router.post('/hotspots/refresh', async (req: Request, res: Response) => {
  try {
    const sourcePlatform = req.query.source_platform as string | undefined

    const task = await runTask(
      { type: 'hotspot_refresh', input: { platform: sourcePlatform } },
      async () => {
        const { refreshHotspots } = await import('../../services/hotspot/index.js')
        const result = await refreshHotspots(sourcePlatform)
        return result
      },
    )

    res.json({ success: true, task_id: task.id, message: '热点刷新已启动' })
  } catch (error) {
    console.error('[POST /hotspots/refresh]', error)
    res.status(500).json({ error: 'Failed to refresh hotspots' })
  }
})

// POST /api/v1/hotspots — 手动创建热点
router.post('/hotspots', async (req: Request, res: Response) => {
  try {
    const { title, source_platform, source, source_url, keywords, relevance_score, valid_until, note } = req.body
    if (!title || !source_platform || !source) {
      res.status(400).json({ error: 'title, source_platform, source are required' })
      return
    }
    const hotspot = await prisma.hotspot.create({
      data: {
        title,
        sourcePlatform: source_platform,
        source,
        sourceUrl: source_url ?? null,
        keywords: keywords ?? [],
        relevanceScore: relevance_score ?? 0,
        validUntil: valid_until ? new Date(valid_until) : null,
        note: note ?? null,
      },
    })
    res.json(mapHotspot(hotspot))
  } catch (error) {
    console.error('[POST /hotspots]', error)
    res.status(500).json({ error: 'Failed to create hotspot' })
  }
})

// PUT /api/v1/hotspots/:id — 编辑热点
router.put('/hotspots/:id', async (req: Request, res: Response) => {
  try {
    const id = toInt(req.params.id)
    const { note, usage_status, keywords } = req.body
    const data: Record<string, unknown> = {}
    if (note !== undefined) data.note = note
    if (usage_status !== undefined) data.usageStatus = usage_status
    if (keywords !== undefined) data.keywords = keywords

    const hotspot = await prisma.hotspot.update({ where: { id }, data })
    res.json(mapHotspot(hotspot))
  } catch (error) {
    console.error('[PUT /hotspots/:id]', error)
    res.status(500).json({ error: 'Failed to update hotspot' })
  }
})

// POST /api/v1/hotspots/:id/expire — 标记过期
router.post('/hotspots/:id/expire', async (req: Request, res: Response) => {
  try {
    const hotspot = await prisma.hotspot.update({
      where: { id: toInt(req.params.id) },
      data: { validUntil: new Date() },
    })
    res.json(mapHotspot(hotspot))
  } catch (error) {
    console.error('[POST /hotspots/:id/expire]', error)
    res.status(500).json({ error: 'Failed to expire hotspot' })
  }
})

// PUT /api/v1/hotspots/:id/expire — 标记过期（兼容）
router.put('/hotspots/:id/expire', async (req: Request, res: Response) => {
  try {
    const hotspot = await prisma.hotspot.update({
      where: { id: toInt(req.params.id) },
      data: { validUntil: new Date() },
    })
    res.json(mapHotspot(hotspot))
  } catch (error) {
    console.error('[PUT /hotspots/:id/expire]', error)
    res.status(500).json({ error: 'Failed to expire hotspot' })
  }
})

// GET /api/v1/hotspots/recommended — 推荐热点
router.get('/hotspots/recommended', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.hotspot.findMany({
      where: {
        validUntil: { gt: new Date() },
        relevanceScore: { gte: 0.5 },
      },
      orderBy: { relevanceScore: 'desc' },
      take: 10,
    })
    res.json({ items: items.map(mapHotspot) })
  } catch (error) {
    console.error('[GET /hotspots/recommended]', error)
    res.status(500).json({ error: 'Failed to load recommended hotspots' })
  }
})

export default router
