import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str, toInt } from '../../constants.js'
import { runTask, getTask } from '../../services/ai/taskManager.js'
import { JimengClient } from '../../services/ai/jimengClient.js'
import type { JimengReqKey } from '../../services/ai/jimengClient.js'

const router: Router = Router()

const VALID_TYPES = ['image', 'video', 'music', 'sfx', 'map_animation'] as const
const VALID_SOURCES = ['pexels', 'ai_generated', 'self_shot', 'purchased', 'external_import'] as const
const VALID_COPYRIGHT = ['free_commercial', 'purchased', 'ai_generated', 'pending'] as const
const GENERATE_TYPES = ['image', 'video'] as const

const TYPE_LABELS: Record<string, string> = {
  image: '图片', video: '视频', music: '音乐', sfx: '音效', map_animation: '地图动画',
}
const SOURCE_LABELS: Record<string, string> = {
  pexels: 'Pexels', ai_generated: 'AI生成', self_shot: '自拍', purchased: '购买', external_import: '外部导入',
}
const COPYRIGHT_LABELS: Record<string, string> = {
  free_commercial: '免费商用', purchased: '已购买', ai_generated: 'AI生成', pending: '待确认',
}

const REQ_KEY_MAP: Record<string, JimengReqKey> = {
  image: 'seedream_4_0_t2i_250514',
  video: 'seaweed_t2v_25s_250514',
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
    const type = str(req.query.type)
    const source = str(req.query.source)
    const keyword = str(req.query.keyword)
    const sortBy = str(req.query.sort_by, 'created_at')
    const p = toInt(req.query.page, 1)
    const ps = Math.min(toInt(req.query.page_size, 20), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown>[] = [{ userId: DEMO_USER_ID }]
    if (type && type !== 'all') where.push({ type })
    if (source && source !== 'all') where.push({ source })
    if (keyword) where.push({
      OR: [
        { name: { contains: keyword, mode: 'insensitive' } },
        { tags: { has: keyword } },
      ],
    })

    const orderBy: Record<string, string> = {}
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

// POST /api/v1/materials — 上传
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

// POST /api/v1/materials/generate — AI 生成
router.post('/materials/generate', async (req: Request, res: Response) => {
  try {
    const { type, description } = req.body
    if (!type || !description) {
      res.status(400).json({ error: 'type and description are required' })
      return
    }
    if (!GENERATE_TYPES.includes(type as typeof GENERATE_TYPES[number])) {
      res.status(400).json({ error: `仅支持 ${GENERATE_TYPES.join('/')} 类型生成` })
      return
    }

    const { JimengClient: JimengClientCheck } = await import('../../services/ai/jimengClient.js')
    const client = JimengClientCheck.createFromEnv()
    if (!client) {
      res.status(503).json({ error: '即梦 AI 服务未配置，请设置 JIMENG 环境变量' })
      return
    }

    const reqKey = REQ_KEY_MAP[type]
    if (!reqKey) {
      res.status(400).json({ error: `不支持的生成类型: ${type}` })
      return
    }

    const task = await runTask(
      { type: 'material_generate', input: { type, description } },
      async () => {
        const jimengClient = JimengClient.createFromEnv()
        if (!jimengClient) throw new Error('即梦 AI 服务未配置')

        const jimengTaskId = await jimengClient.submitTask({
          req_key: reqKey,
          prompt: description,
        })

        for (let i = 0; i < 60; i++) {
          await new Promise(resolve => setTimeout(resolve, 5000))
          const result = await jimengClient.pollResult(jimengTaskId)

          if (result.status === 'success' && result.output) {
            const outputUrl = result.output.image_urls?.[0] ?? result.output.video_url
            if (!outputUrl) throw new Error('即梦返回结果中无文件 URL')
            return { file_url: outputUrl, type }
          }

          if (result.status === 'failed') {
            throw new Error(result.error ?? 'Jimeng task failed')
          }
        }

        throw new Error('即梦生成超时（5分钟）')
      },
    )

    res.json({ task_id: task.id, status: 'pending' })
  } catch (error) {
    console.error('[POST /materials/generate]', error)
    res.status(500).json({ error: 'Failed to start generation' })
  }
})

// GET /api/v1/materials/generate/:taskId/status — AI 生成状态
router.get('/materials/generate/:taskId/status', async (req: Request, res: Response) => {
  try {
    const task = await getTask(str(req.params.taskId))
    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json({ status: task.status, progress: task.progress, output: task.output })
  } catch (error) {
    console.error('[GET /materials/generate/:taskId/status]', error)
    res.status(500).json({ error: 'Failed to get generation status' })
  }
})

// POST /api/v1/materials/generate/:taskId/confirm — AI 生成确认
router.post('/materials/generate/:taskId/confirm', async (req: Request, res: Response) => {
  try {
    const taskId = str(req.params.id)
    const task = await getTask(taskId)
    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    if (task.status !== 'success') {
      res.status(400).json({ error: `任务尚未完成，当前状态: ${task.status}` })
      return
    }

    const output = task.output as Record<string, unknown> | null
    if (!output?.file_url) {
      res.status(500).json({ error: '任务结果中无文件 URL' })
      return
    }

    const input = task.input as Record<string, unknown> | null
    const material = await prisma.material.create({
      data: {
        userId: DEMO_USER_ID,
        name: (input?.description as string) ?? `AI 生成 ${Date.now()}`,
        type: (output.type as string) ?? 'image',
        source: 'ai_generated',
        copyrightStatus: 'ai_generated',
        fileUrl: output.file_url as string,
        fileSize: BigInt(0),
        tags: [],
        metadata: { ai_task_id: taskId },
      },
    })

    res.json({ material_id: material.id })
  } catch (error) {
    console.error('[POST /materials/generate/:taskId/confirm]', error)
    res.status(500).json({ error: 'Failed to confirm generation' })
  }
})

// GET /api/v1/materials/pexels-search — Pexels 搜索
router.get('/materials/pexels-search', async (req: Request, res: Response) => {
  try {
    const keyword = str(req.query.keyword)
    const type = str(req.query.type, 'image')
    const page = toInt(req.query.page, 1)
    const perPage = toInt(req.query.per_page, 20)
    if (!keyword) {
      res.status(400).json({ error: 'keyword is required' })
      return
    }
    const apiKey = process.env.PEXELS_API_KEY
    if (!apiKey) { res.status(503).json({ error: 'PEXELS_API_KEY 未配置', items: [], total: 0 }); return }

    const params = new URLSearchParams({ query: keyword, page: String(page), per_page: String(Math.min(perPage, 80)) })
    if (type === 'video') params.set('video', 'true')

    const resp = await fetch(`https://api.pexels.com/v1/search?${params}`, { headers: { Authorization: apiKey } })
    if (!resp.ok) { res.status(502).json({ error: 'Pexels API error' }); return }
    const data = await resp.json() as { total_results: number; photos?: any[]; videos?: any[] }
    const results = data.photos ?? data.videos ?? []

    const items = results.map((item: any) => {
      if (type === 'video') {
        const v = item.video_files?.sort((a: any, b: any) => a.width - b.width)[0] ?? {}
        return {
          id: String(item.id), type: 'video',
          preview_url: item.image,
          file_url: v.link ?? '',
          thumbnail_url: item.image,
          width: item.width, height: item.height,
          duration: Math.round(item.duration ?? 0),
          photographer: item.user?.name ?? '',
          source_url: item.url,
        }
      }
      return {
        id: String(item.id), type: 'image',
        preview_url: item.src?.large ?? item.src?.medium,
        file_url: item.src?.original2x ?? item.src?.large ?? item.src?.medium,
        thumbnail_url: item.src?.small ?? item.src?.tiny,
        width: item.width, height: item.height,
        photographer: item.photographer ?? '',
        source_url: item.url,
        alt: item.alt ?? '',
      }
    })
    res.json({ items, total: data.total_results, keyword, type, page, per_page: results.length })
  } catch (error) {
    console.error('[GET /materials/pexels-search]', error)
    res.status(500).json({ error: 'Failed to search Pexels' })
  }
})

// POST /api/v1/materials/pexels-import — Pexels 导入
router.post('/materials/pexels-import', async (req: Request, res: Response) => {
  try {
    const { pexels_id, type, source_url } = req.body
    if (!pexels_id || !source_url) {
      res.status(400).json({ error: 'pexels_id and source_url are required' })
      return
    }
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
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
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
    const id = str(req.params.id)
    const refCount = await prisma.videoMaterial.count({
      where: { materialId: id },
    })
    if (refCount > 0) {
      res.status(400).json({ error: 'Material is referenced by videos', ref_count: refCount })
      return
    }
    await prisma.material.delete({ where: { id, userId: DEMO_USER_ID } })
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
      where: { materialId: str(req.params.id) },
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

// GET /api/v1/materials/:id/download — 下载
router.get('/materials/:id/download', async (req: Request, res: Response) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
    })
    if (!material) {
      res.status(404).json({ error: 'Material not found' })
      return
    }
    if (!material.fileUrl) {
      res.status(400).json({ error: 'Material has no file URL' })
      return
    }
    if (material.fileUrl.startsWith('http://') || material.fileUrl.startsWith('https://')) {
      res.redirect(material.fileUrl)
      return
    }
    res.setHeader('Content-Disposition', `attachment; filename="${material.name}"`)
    res.sendFile(material.fileUrl, { root: '/' })
  } catch (error) {
    console.error('[GET /materials/:id/download]', error)
    res.status(500).json({ error: 'Failed to download material' })
  }
})

export default router
