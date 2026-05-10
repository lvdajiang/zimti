import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

const VALID_TYPES = ['image', 'video', 'music', 'sfx', 'map_animation'] as const
const VALID_SOURCES = ['pexels', 'ai_generated', 'self_shot', 'purchased', 'external_import'] as const
const VALID_COPYRIGHT = ['free_commercial', 'purchased', 'ai_generated', 'pending'] as const

const TYPE_LABELS: Record<string, string> = {
  image: '图片', video: '视频', music: '音乐', sfx: '音效', map_animation: '地图动画',
}
const SOURCE_LABELS: Record<string, string> = {
  pexels: 'Pexels', ai_generated: 'AI生成', self_shot: '自拍', purchased: '购买', external_import: '外部导入',
}
const COPYRIGHT_LABELS: Record<string, string> = {
  free_commercial: '免费商用', purchased: '已购买', ai_generated: 'AI生成', pending: '待确认',
}

function mapMaterial(m: {
  id: string; name: string; type: string; source: string; copyrightStatus: string;
  fileUrl: string; thumbnailUrl: string | null; fileSize: bigint; tags: string[];
  useCount: number; metadata: unknown; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    type_label: TYPE_LABELS[m.type] ?? m.type,
    source: m.source,
    source_label: SOURCE_LABELS[m.source] ?? m.source,
    copyright_status: m.copyrightStatus,
    copyright_status_label: COPYRIGHT_LABELS[m.copyrightStatus] ?? m.copyrightStatus,
    file_url: m.fileUrl,
    thumbnail_url: m.thumbnailUrl,
    file_size: Number(m.fileSize),
    tags: m.tags,
    use_count: m.useCount,
    metadata: m.metadata,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

// GET /api/v1/materials — 列表
router.get('/materials', async (req: Request, res: Response) => {
  try {
    const { type, source, keyword, sort_by = 'created_at', page = '1', page_size = '20' } = req.query
    const p = Number(page)
    const ps = Math.min(Number(page_size), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown>[] = [{ userId: DEMO_USER_ID }]
    if (type && type !== 'all') where.push({ type: String(type) })
    if (source && source !== 'all') where.push({ source: String(source) })
    if (keyword) where.push({
      OR: [
        { name: { contains: String(keyword), mode: 'insensitive' } },
        { tags: { has: String(keyword) } },
      ],
    })

    const orderBy: Record<string, string> = {}
    const sortBy = String(sort_by)
    if (sortBy === 'use_count') orderBy.useCount = 'desc'
    else if (sortBy === 'name') orderBy.name = 'asc'
    else if (sortBy === 'file_size') orderBy.fileSize = 'desc'
    else orderBy.createdAt = 'desc'

    const [items, total] = await Promise.all([
      prisma.material.findMany({
        where: { AND: where },
        orderBy,
        skip,
        take: ps,
      }),
      prisma.material.count({ where: { AND: where } }),
    ])

    res.json({
      items: items.map(m => ({ ...mapMaterial(m), file_size_display: formatFileSize(Number(m.fileSize)) })),
      total,
    })
  } catch (error) {
    console.error('[GET /materials]', error)
    res.status(500).json({ error: 'Failed to load materials' })
  }
})

// GET /api/v1/materials/stats — 统计
router.get('/materials/stats', async (_req: Request, res: Response) => {
  try {
    const [total, image, video, music, sfx, map_animation] = await Promise.all([
      prisma.material.count({ where: { userId: DEMO_USER_ID } }),
      prisma.material.count({ where: { userId: DEMO_USER_ID, type: 'image' } }),
      prisma.material.count({ where: { userId: DEMO_USER_ID, type: 'video' } }),
      prisma.material.count({ where: { userId: DEMO_USER_ID, type: 'music' } }),
      prisma.material.count({ where: { userId: DEMO_USER_ID, type: 'sfx' } }),
      prisma.material.count({ where: { userId: DEMO_USER_ID, type: 'map_animation' } }),
    ])
    res.json({ total, image, video, music, sfx, map_animation })
  } catch (error) {
    console.error('[GET /materials/stats]', error)
    res.status(500).json({ error: 'Failed to load material stats' })
  }
})

// POST /api/v1/materials — 上传（桩，multipart 需要额外配置）
router.post('/materials', async (req: Request, res: Response) => {
  try {
    const { name, type, source, copyright_status, file_url, thumbnail_url, file_size, tags } = req.body
    if (!name || !type || !file_url) {
      res.status(400).json({ error: 'name, type, file_url are required' })
      return
    }
    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      res.status(400).json({ error: `Invalid type: ${type}` })
      return
    }
    const material = await prisma.material.create({
      data: {
        userId: DEMO_USER_ID,
        name,
        type,
        source: (source && VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) ? source : 'self_shot',
        copyrightStatus: (copyright_status && VALID_COPYRIGHT.includes(copyright_status as typeof VALID_COPYRIGHT[number])) ? copyright_status : 'pending',
        fileUrl: file_url,
        thumbnailUrl: thumbnail_url ?? null,
        fileSize: BigInt(file_size ?? 0),
        tags: Array.isArray(tags) ? tags : [],
      },
    })
    res.json({ material: mapMaterial(material) })
  } catch (error) {
    console.error('[POST /materials]', error)
    res.status(500).json({ error: 'Failed to upload material' })
  }
})

// POST /api/v1/materials/generate — AI 生成（桩）
router.post('/materials/generate', async (req: Request, res: Response) => {
  try {
    const { type, description } = req.body
    if (!type || !description) {
      res.status(400).json({ error: 'type and description are required' })
      return
    }
    markStub(res, 'AI 生成服务未接入')
    const taskId = crypto.randomUUID()
    res.json({ task_id: taskId, status: 'pending' })
  } catch (error) {
    console.error('[POST /materials/generate]', error)
    res.status(500).json({ error: 'Failed to start generation' })
  }
})

// GET /api/v1/materials/generate/:taskId/status — AI 生成状态（桩）
router.get('/materials/generate/:taskId/status', async (_req: Request, res: Response) => {
  markStub(res, 'AI 生成状态查询为桩')
  res.json({ status: 'pending', progress: 0 })
})

// POST /api/v1/materials/generate/:taskId/confirm — AI 生成确认（桩）
router.post('/materials/generate/:taskId/confirm', async (_req: Request, res: Response) => {
  markStub(res, 'AI 生成确认为桩')
  res.json({ message: 'Generate confirm — stub' })
})

// GET /api/v1/materials/pexels-search — Pexels 搜索（桩）
router.get('/materials/pexels-search', async (req: Request, res: Response) => {
  try {
    const { keyword, type = 'image', page = '1', page_size = '6' } = req.query
    if (!keyword) {
      res.status(400).json({ error: 'keyword is required' })
      return
    }
    markStub(res, 'Pexels API 未接入')
    res.json({
      items: [],
      total: 0,
      keyword,
      type,
      page: Number(page),
    })
  } catch (error) {
    console.error('[GET /materials/pexels-search]', error)
    res.status(500).json({ error: 'Failed to search Pexels' })
  }
})

// POST /api/v1/materials/pexels-import — Pexels 导入（桩）
router.post('/materials/pexels-import', async (req: Request, res: Response) => {
  try {
    const { pexels_id, type, source_url } = req.body
    if (!pexels_id || !source_url) {
      res.status(400).json({ error: 'pexels_id and source_url are required' })
      return
    }
    // TODO: 实际下载并存储文件
    const material = await prisma.material.create({
      data: {
        userId: DEMO_USER_ID,
        name: `pexels-${pexels_id}`,
        type: type ?? 'image',
        source: 'pexels',
        copyrightStatus: 'free_commercial',
        fileUrl: source_url,
        thumbnailUrl: source_url,
        fileSize: BigInt(0),
        tags: [],
        metadata: { pexels_id },
      },
    })
    res.json({ material: mapMaterial(material) })
  } catch (error) {
    console.error('[POST /materials/pexels-import]', error)
    res.status(500).json({ error: 'Failed to import from Pexels' })
  }
})

// PUT /api/v1/materials/:id — 更新
router.put('/materials/:id', async (req: Request, res: Response) => {
  try {
    const { name, tags, copyright_status, source } = req.body
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (tags !== undefined) updateData.tags = tags
    if (copyright_status !== undefined && VALID_COPYRIGHT.includes(copyright_status as typeof VALID_COPYRIGHT[number])) {
      updateData.copyrightStatus = copyright_status
    }
    if (source !== undefined && VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) {
      updateData.source = source
    }

    const material = await prisma.material.update({
      where: { id: req.params.id, userId: DEMO_USER_ID },
      data: updateData,
    })
    res.json({ material: mapMaterial(material) })
  } catch (error) {
    console.error('[PUT /materials/:id]', error)
    res.status(500).json({ error: 'Failed to update material' })
  }
})

// DELETE /api/v1/materials/:id — 删除
router.delete('/materials/:id', async (req: Request, res: Response) => {
  try {
    // 检查引用
    const refCount = await prisma.videoMaterial.count({
      where: { materialId: req.params.id },
    })
    if (refCount > 0) {
      res.status(400).json({ error: 'Material is referenced by videos', ref_count: refCount })
      return
    }
    await prisma.material.delete({ where: { id: req.params.id, userId: DEMO_USER_ID } })
    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /materials/:id]', error)
    res.status(500).json({ error: 'Failed to delete material' })
  }
})

// GET /api/v1/materials/:id/references — 引用检查
router.get('/materials/:id/references', async (req: Request, res: Response) => {
  try {
    const refs = await prisma.videoMaterial.findMany({
      where: { materialId: req.params.id },
      include: { videoProduct: { select: { id: true, title: true } } },
    })
    res.json({
      count: refs.length,
      videos: refs.map(r => ({ id: r.videoProductId, title: r.videoProduct.title })),
    })
  } catch (error) {
    console.error('[GET /materials/:id/references]', error)
    res.status(500).json({ error: 'Failed to check references' })
  }
})

// GET /api/v1/materials/:id/download — 下载（桩）
router.get('/materials/:id/download', async (req: Request, res: Response) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id, userId: DEMO_USER_ID },
    })
    if (!material) {
      res.status(404).json({ error: 'Material not found' })
      return
    }
    markStub(res, '文件流下载未实现')
    res.json({ url: material.fileUrl, name: material.name })
  } catch (error) {
    console.error('[GET /materials/:id/download]', error)
    res.status(500).json({ error: 'Failed to download material' })
  }
})

export default router
