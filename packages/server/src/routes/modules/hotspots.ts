import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { toInt } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

const PLATFORM_LABELS: Record<string, string> = { xiaohongshu: '小红书', douyin: '抖音', weixin: '视频号', weibo: '微博' }

function mapHotspot(h: {
  id: number; title: string; sourcePlatform: string; source: string;
  sourceUrl: string | null; relevanceScore: { toNumber: () => number };
  validUntil: Date | null; createdAt: Date;
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
    created_at: h.createdAt.toISOString(),
  }
}

// GET /api/v1/hotspots — 热点列表
router.get('/hotspots', async (req: Request, res: Response) => {
  try {
    const { platform, page = '1', page_size = '20' } = req.query
    const ps = Math.min(Number(page_size), 100)
    const skip = (Number(page) - 1) * ps

    const where: Record<string, unknown> = {}
    if (platform && platform !== 'all') where.sourcePlatform = String(platform)

    const [items, total] = await Promise.all([
      prisma.hotspot.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: ps,
      }),
      prisma.hotspot.count({ where }),
    ])

    res.json({ items: items.map(mapHotspot), total })
  } catch (error) {
    console.error('[GET /hotspots]', error)
    res.status(500).json({ error: 'Failed to load hotspots' })
  }
})

// POST /api/v1/hotspots/refresh — 刷新热点（桩）
router.post('/hotspots/refresh', async (_req: Request, res: Response) => {
  try {
    // TODO: 接入热点爬取服务
    markStub(res, '热点刷新未接入爬取服务')
    res.json({ success: true, message: 'Refresh queued (stub)' })
  } catch (error) {
    console.error('[POST /hotspots/refresh]', error)
    res.status(500).json({ error: 'Failed to refresh hotspots' })
  }
})

// POST /api/v1/hotspots — 手动创建热点
router.post('/hotspots', async (req: Request, res: Response) => {
  try {
    const { title, source_platform, source, source_url, relevance_score, valid_until } = req.body
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
        relevanceScore: relevance_score ?? 0,
        validUntil: valid_until ? new Date(valid_until) : null,
      },
    })
    res.json(mapHotspot(hotspot))
  } catch (error) {
    console.error('[POST /hotspots]', error)
    res.status(500).json({ error: 'Failed to create hotspot' })
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
