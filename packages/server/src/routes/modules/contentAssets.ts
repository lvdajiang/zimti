import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

const VALID_TYPES = ['script', 'video', 'image_text']

const TYPE_LABELS: Record<string, string> = { script: '脚本', video: '视频', image_text: '图文' }
const STATUS_LABELS: Record<string, string> = { draft: '草稿', published: '已发布', archived: '已归档' }
const PLATFORM_LABELS: Record<string, string> = { xiaohongshu: '小红书', douyin: '抖音', weixin: '视频号' }

function mapAsset(a: {
  id: string; userId: string; title: string; type: string; videoProductId: string | null;
  platforms: string[]; status: string; coreMetrics: unknown; elementHighlights: string[];
  customTags: string[]; performanceTags: string[]; publishedAt: Date | null; archivedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: a.id,
    title: a.title,
    type: a.type,
    type_label: TYPE_LABELS[a.type] ?? a.type,
    video_product_id: a.videoProductId,
    platforms: a.platforms,
    platform_labels: a.platforms.map((p: string) => PLATFORM_LABELS[p] ?? p),
    status: a.status,
    status_label: STATUS_LABELS[a.status] ?? a.status,
    core_metrics: a.coreMetrics ?? {},
    element_highlights: a.elementHighlights,
    custom_tags: a.customTags,
    performance_tags: a.performanceTags,
    published_at: a.publishedAt?.toISOString() ?? null,
    archived_at: a.archivedAt?.toISOString() ?? null,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
  }
}

// GET /api/v1/content-assets — 列表
router.get('/content-assets', async (req: Request, res: Response) => {
  try {
    const { type, status, keyword, page = '1', page_size = '20' } = req.query
    const p = Number(page)
    const ps = Math.min(Number(page_size), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown>[] = [{ userId: DEMO_USER_ID }]
    if (type && type !== 'all') where.push({ type: String(type) })
    if (status && status !== 'all') where.push({ status: String(status) })
    if (keyword) where.push({ title: { contains: String(keyword), mode: 'insensitive' } })

    const [items, total] = await Promise.all([
      prisma.contentAsset.findMany({
        where: { AND: where },
        orderBy: { createdAt: 'desc' },
        skip,
        take: ps,
      }),
      prisma.contentAsset.count({ where: { AND: where } }),
    ])

    res.json({ items: items.map(mapAsset), total })
  } catch (error) {
    console.error('[GET /content-assets]', error)
    res.status(500).json({ error: 'Failed to load content assets' })
  }
})

// GET /api/v1/content-assets/:id — 详情
router.get('/content-assets/:id', async (req: Request, res: Response) => {
  try {
    const asset = await prisma.contentAsset.findFirst({
      where: { id: req.params.id, userId: DEMO_USER_ID },
    })
    if (!asset) {
      res.status(404).json({ error: 'Content asset not found' })
      return
    }
    res.json(mapAsset(asset))
  } catch (error) {
    console.error('[GET /content-assets/:id]', error)
    res.status(500).json({ error: 'Failed to load asset' })
  }
})

// GET /api/v1/content-assets/:id/materials — 关联素材
router.get('/content-assets/:id/materials', async (req: Request, res: Response) => {
  try {
    const asset = await prisma.contentAsset.findFirst({
      where: { id: req.params.id, userId: DEMO_USER_ID },
      include: { videoProduct: { include: { videoMaterials: { include: { material: true } } } } },
    })
    const vp = asset?.videoProduct
    if (!vp || !('videoMaterials' in vp)) {
      res.json({ items: [] })
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vMaterials = (vp as any).videoMaterials ?? []
    const materials = vMaterials.map((vm: any) => vm.material)
    res.json({
      items: materials.map((m: any) => ({
        id: m.id, name: m.name, type: m.type, thumbnail_url: m.thumbnailUrl,
      })),
    })
  } catch (error) {
    console.error('[GET /content-assets/:id/materials]', error)
    res.status(500).json({ error: 'Failed to load materials' })
  }
})

// GET /api/v1/content-assets/:id/trends — 趋势数据（桩）
router.get('/content-assets/:id/trends', async (_req: Request, res: Response) => {
  res.json({
    points: [],
    total_play_count: 0,
    avg_interaction_rate: 0,
  })
})

// POST /api/v1/content-assets/:id/highlights — 创建亮点
router.post('/content-assets/:id/highlights', async (req: Request, res: Response) => {
  try {
    const { highlights } = req.body
    if (!Array.isArray(highlights)) {
      res.status(400).json({ error: 'highlights array is required' })
      return
    }
    const asset = await prisma.contentAsset.update({
      where: { id: req.params.id, userId: DEMO_USER_ID },
      data: { elementHighlights: highlights },
    })
    res.json(mapAsset(asset))
  } catch (error) {
    console.error('[POST /content-assets/:id/highlights]', error)
    res.status(500).json({ error: 'Failed to create highlights' })
  }
})

// POST /api/v1/content-assets/:id/reuse-materials — 复用素材
router.post('/content-assets/:id/reuse-materials', async (req: Request, res: Response) => {
  try {
    const { material_ids } = req.body
    if (!Array.isArray(material_ids)) {
      res.status(400).json({ error: 'material_ids array is required' })
      return
    }
    res.json({ success: true, material_ids })
  } catch (error) {
    console.error('[POST /content-assets/:id/reuse-materials]', error)
    res.status(500).json({ error: 'Failed to reuse materials' })
  }
})

// POST /api/v1/content-assets/:id/reuse-script — 复用脚本结构（桩）
router.post('/content-assets/:id/reuse-script', async (req: Request, res: Response) => {
  try {
    const asset = await prisma.contentAsset.findFirst({
      where: { id: req.params.id, userId: DEMO_USER_ID },
    })
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' })
      return
    }
    // TODO: 实际复用脚本结构逻辑
    res.json({ success: true, source_asset_id: asset.id })
  } catch (error) {
    console.error('[POST /content-assets/:id/reuse-script]', error)
    res.status(500).json({ error: 'Failed to reuse script' })
  }
})

// DELETE /api/v1/content-assets/:id — 删除
router.delete('/content-assets/:id', async (req: Request, res: Response) => {
  try {
    const asset = await prisma.contentAsset.findFirst({
      where: { id: req.params.id, userId: DEMO_USER_ID },
    })
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' })
      return
    }
    if (asset.status !== 'draft') {
      res.status(400).json({ error: 'Only draft assets can be deleted' })
      return
    }
    await prisma.contentAsset.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /content-assets/:id]', error)
    res.status(500).json({ error: 'Failed to delete asset' })
  }
})

// GET /api/v1/content-assets/:id/export — 导出（桩）
router.get('/content-assets/:id/export', async (_req: Request, res: Response) => {
  markStub(res, '导出功能未实现')
  res.json({ url: '', message: 'Export — stub' })
})

// POST /api/v1/content-assets/auto-create — 自动创建（桩）
router.post('/content-assets/auto-create', async (req: Request, res: Response) => {
  try {
    const { title, type, video_product_id, platforms } = req.body
    if (!title || !type) {
      res.status(400).json({ error: 'title and type are required' })
      return
    }
    const asset = await prisma.contentAsset.create({
      data: {
        userId: DEMO_USER_ID,
        title,
        type: VALID_TYPES.includes(type) ? type : 'video',
        videoProductId: video_product_id ?? null,
        platforms: Array.isArray(platforms) ? platforms : [],
        status: 'draft',
      },
    })
    res.json(mapAsset(asset))
  } catch (error) {
    console.error('[POST /content-assets/auto-create]', error)
    res.status(500).json({ error: 'Failed to auto-create asset' })
  }
})

export default router
