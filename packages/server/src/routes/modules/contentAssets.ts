import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str, toInt } from '../../constants.js'

const router: Router = Router()

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
    const type = str(req.query.type)
    const status = str(req.query.status)
    const keyword = str(req.query.keyword)
    const p = toInt(req.query.page, 1)
    const ps = Math.min(toInt(req.query.page_size, 20), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown>[] = [{ userId: DEMO_USER_ID }]
    if (type && type !== 'all') where.push({ type })
    if (status && status !== 'all') where.push({ status })
    if (keyword) where.push({ title: { contains: keyword, mode: 'insensitive' } })

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
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
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
    const id = str(req.params.id)
    const asset = await prisma.contentAsset.findFirst({
      where: { id, userId: DEMO_USER_ID },
    })
    if (!asset?.videoProductId) {
      res.json({ items: [] })
      return
    }
    const vMaterials = await prisma.videoMaterial.findMany({
      where: { videoProductId: asset.videoProductId },
      include: { material: true },
    })
    res.json({
      items: vMaterials.map(vm => ({
        id: vm.material.id, name: vm.material.name, type: vm.material.type, thumbnail_url: vm.material.thumbnailUrl,
      })),
    })
  } catch (error) {
    console.error('[GET /content-assets/:id/materials]', error)
    res.status(500).json({ error: 'Failed to load materials' })
  }
})

// GET /api/v1/content-assets/:id/trends — 趋势数据
router.get('/content-assets/:id/trends', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const asset = await prisma.contentAsset.findFirst({ where: { id, userId: DEMO_USER_ID } })
    if (!asset?.videoProductId) {
      res.json({ points: [], total_play_count: 0, avg_interaction_rate: 0 })
      return
    }
    const days = Math.min(toInt(req.query.days, 30), 90)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const metrics = await prisma.videoMetric.findMany({
      where: { userId: DEMO_USER_ID, videoId: asset.videoProductId, date: { gte: since } },
      orderBy: { date: 'asc' },
    })
    const points = metrics.map(m => ({
      date: m.date.toISOString().slice(0, 10),
      play_count: m.playCount,
      like_count: m.likeCount,
      comment_count: m.commentCount,
      collect_count: m.collectCount,
      interaction_rate: m.interactionRate ? Number(m.interactionRate) : 0,
    }))
    const totalPlayCount = metrics.reduce((sum, m) => sum + m.playCount, 0)
    const avgRate = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.interactionRate ? Number(m.interactionRate) : 0), 0) / metrics.length
      : 0
    res.json({ points, total_play_count: totalPlayCount, avg_interaction_rate: Number(avgRate.toFixed(4)) })
  } catch (error) {
    console.error('[GET /content-assets/:id/trends]', error)
    res.status(500).json({ error: 'Failed to load trends' })
  }
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
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
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

// POST /api/v1/content-assets/:id/reuse-script — 复用脚本结构
router.post('/content-assets/:id/reuse-script', async (req: Request, res: Response) => {
  try {
    const { target_task_id, target_topic_id } = req.body
    if (!target_task_id || !target_topic_id) {
      res.status(400).json({ error: 'target_task_id and target_topic_id are required' })
      return
    }
    const asset = await prisma.contentAsset.findFirst({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
      include: { videoProduct: { include: { script: { include: { storyboardSegments: { orderBy: { segmentIndex: 'asc' } } } } } } },
    })
    if (!asset?.videoProduct?.script) {
      res.status(404).json({ error: 'Source script not found' })
      return
    }
    const source = asset.videoProduct.script
    const newScript = await prisma.script.create({
      data: {
        taskId: target_task_id,
        topicId: target_topic_id,
        fullText: source.fullText,
        videoType: source.videoType,
        oralRatio: Number(source.oralRatio),
        status: 'draft',
      },
    })
    if (source.storyboardSegments.length > 0) {
      await prisma.storyboardSegment.createMany({
        data: source.storyboardSegments.map(seg => ({
          scriptId: newScript.id,
          segmentIndex: seg.segmentIndex,
          segmentType: seg.segmentType,
          oralText: seg.oralText,
          visualDescription: seg.visualDescription,
          duration: seg.duration,
          materialIds: seg.materialIds,
          transitionType: seg.transitionType,
        })),
      })
    }
    res.json({ success: true, new_script_id: newScript.id, source_asset_id: asset.id })
  } catch (error) {
    console.error('[POST /content-assets/:id/reuse-script]', error)
    res.status(500).json({ error: 'Failed to reuse script' })
  }
})

// DELETE /api/v1/content-assets/:id — 删除
router.delete('/content-assets/:id', async (req: Request, res: Response) => {
  try {
    const asset = await prisma.contentAsset.findFirst({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
    })
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' })
      return
    }
    if (asset.status !== 'draft') {
      res.status(400).json({ error: 'Only draft assets can be deleted' })
      return
    }
    await prisma.contentAsset.delete({ where: { id: str(req.params.id) } })
    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /content-assets/:id]', error)
    res.status(500).json({ error: 'Failed to delete asset' })
  }
})

// GET /api/v1/content-assets/:id/export — 导出 JSON
router.get('/content-assets/:id/export', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const asset = await prisma.contentAsset.findFirst({
      where: { id, userId: DEMO_USER_ID },
      include: { videoProduct: { include: { script: true } } },
    })
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' })
      return
    }
    const exportData = {
      title: asset.title,
      type: asset.type,
      status: asset.status,
      platforms: asset.platforms,
      core_metrics: asset.coreMetrics,
      element_highlights: asset.elementHighlights,
      custom_tags: asset.customTags,
      performance_tags: asset.performanceTags,
      script: asset.videoProduct?.script ? {
        full_text: asset.videoProduct.script.fullText,
        video_type: asset.videoProduct.script.videoType,
        oral_ratio: Number(asset.videoProduct.script.oralRatio),
      } : null,
      exported_at: new Date().toISOString(),
    }
    const fmt = str(req.query.format, 'json')
    if (fmt === 'csv') {
      const header = '标题,类型,状态,平台,自定义标签,导出时间\n'
      const row = [
        `"${asset.title}"`, asset.type, asset.status,
        asset.platforms.join(';'),
        asset.customTags.join(';'),
        new Date().toISOString().slice(0, 10),
      ].join(',')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename=asset-${Date.now()}.csv`)
      res.send('﻿' + header + row)
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename=asset-${Date.now()}.json`)
      res.json(exportData)
    }
  } catch (error) {
    console.error('[GET /content-assets/:id/export]', error)
    res.status(500).json({ error: 'Failed to export' })
  }
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
