import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str } from '../../constants.js'
import { startRender } from '../../services/render/renderService.js'
import { runTask } from '../../services/ai/taskManager.js'
import { generateCopy } from '../../services/ai/generators/copyGenerate.js'

const router: Router = Router()

// GET /api/v1/video-products/:id/publish-workspace — 发布工作区
router.get('/video-products/:id/publish-workspace', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const [video, publishRecords] = await Promise.all([
      prisma.videoProduct.findFirst({
        where: { id, task: { userId: DEMO_USER_ID } },
      }),
      prisma.publishRecord.findMany({
        where: { videoProductId: id },
      }),
    ])
    if (!video) {
      res.status(404).json({ error: 'Video product not found' })
      return
    }
    res.json({
      id: video.id,
      title: video.title,
      status: video.status,
      platform: video.platform,
      video_url: video.videoUrl,
      duration: video.duration ? Number(video.duration) : null,
      publish_records: publishRecords.map(r => ({
        id: r.id, platform: r.platform, status: r.status, title: r.title,
        published_at: r.publishedAt?.toISOString() ?? null,
      })),
    })
  } catch (error) {
    console.error('[GET publish-workspace]', error)
    res.status(500).json({ error: 'Failed to load publish workspace' })
  }
})

// POST /api/v1/video-products/:id/generate-copy/batch — 批量生成文案
router.post('/video-products/:id/generate-copy/batch', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const video = await prisma.videoProduct.findFirst({
      where: { id, task: { userId: DEMO_USER_ID } },
    })
    if (!video) {
      res.status(404).json({ error: 'Video product not found' })
      return
    }

    const records = await prisma.publishRecord.findMany({
      where: { videoProductId: id },
    })

    const taskIds: string[] = []
    await Promise.allSettled(
      records.map(async (record) => {
        const task = await runTask(
          { type: 'copy_batch_generate', input: { record_id: record.id, platform: record.platform } },
          () => generateCopy({ record_id: record.id, platform: record.platform }),
        )
        taskIds.push(task.id)
      }),
    )

    res.json({ success: true, task_ids: taskIds, count: taskIds.length })
  } catch (error) {
    console.error('[POST generate-copy/batch]', error)
    res.status(500).json({ error: 'Failed to generate batch copy' })
  }
})

// GET /api/v1/video-products/:id/preview — 预览视频
router.get('/video-products/:id/preview', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    // 支持 UUID（VideoProduct.id）和整数（Script.id）两种查询方式
    const isUuid = id.length === 36 && id.includes('-')
    const where = isUuid
      ? { id, task: { userId: DEMO_USER_ID } }
      : { scriptId: parseInt(id, 10), task: { userId: DEMO_USER_ID } }
    const video = await prisma.videoProduct.findFirst({ where })
    if (!video) {
      res.status(404).json({ error: 'Video not found' })
      return
    }
    const [storyboardSegments, videoMaterials] = await Promise.all([
      video.scriptId
        ? prisma.storyboardSegment.findMany({ where: { scriptId: video.scriptId }, orderBy: { segmentIndex: 'asc' } })
        : [],
      prisma.videoMaterial.findMany({ where: { videoProductId: video.id }, include: { material: true } }),
    ])
    res.json({
      video_product: {
        id: video.id,
        status: video.status,
        platform: video.platform,
        resolution: video.resolution,
        video_url: video.videoUrl,
        duration: video.duration ? Number(video.duration) : null,
      },
      title: video.title,
      segments: storyboardSegments.map(s => ({
        id: s.id, segment_type: s.segmentType, oral_text: s.oralText,
        visual_description: s.visualDescription, duration: Number(s.duration),
      })),
      materials: videoMaterials.map(vm => ({
        id: vm.material.id, name: vm.material.name, type: vm.material.type,
        thumbnail_url: vm.material.thumbnailUrl,
      })),
    })
  } catch (error) {
    console.error('[GET preview]', error)
    res.status(500).json({ error: 'Failed to load preview' })
  }
})

// POST /api/v1/video-products/render — 渲染视频
router.post('/video-products/render', async (req: Request, res: Response) => {
  try {
    const { video_product_id } = req.body

    if (!video_product_id) {
      res.status(400).json({ error: 'video_product_id is required' })
      return
    }

    // 验证视频产品存在
    const video = await prisma.videoProduct.findFirst({
      where: { id: video_product_id, task: { userId: DEMO_USER_ID } },
    })
    if (!video) {
      res.status(404).json({ error: 'Video product not found' })
      return
    }

    // 创建 RenderTask 记录
    const renderTask = await prisma.renderTask.create({
      data: {
        videoProductId: video_product_id,
        status: 'rendering',
        progress: 0,
      },
    })

    // 更新视频产品状态
    await prisma.videoProduct.update({
      where: { id: video_product_id },
      data: { status: 'rendering' },
    })

    // 启动渲染
    const jobId = await startRender(video_product_id)

    res.json({
      task_id: renderTask.id,
      render_job_id: jobId,
      status: 'rendering',
      progress: 0,
    })
  } catch (error) {
    console.error('[POST render]', error)
    res.status(500).json({ error: 'Failed to start render' })
  }
})

// GET /api/v1/video-products/:id/render-status — 渲染状态
router.get('/video-products/:id/render-status', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const renderTask = await prisma.renderTask.findFirst({
      where: { videoProductId: id },
      orderBy: { createdAt: 'desc' },
    })

    if (!renderTask) {
      res.json({ status: 'idle', progress: 0 })
      return
    }

    res.json({
      status: renderTask.status,
      progress: Number(renderTask.progress),
      error_message: renderTask.errorMessage,
      started_at: renderTask.startedAt?.toISOString() ?? null,
      completed_at: renderTask.completedAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error('[GET render-status]', error)
    res.status(500).json({ error: 'Failed to get render status' })
  }
})

// POST /api/v1/video-products/:id/render-cancel — 取消渲染
router.post('/video-products/:id/render-cancel', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    await prisma.renderTask.updateMany({
      where: { videoProductId: id, status: 'rendering' },
      data: { status: 'failed', errorMessage: 'Cancelled by user' },
    })
    await prisma.videoProduct.update({
      where: { id },
      data: { status: 'draft' },
    })
    res.json({ success: true })
  } catch (error) {
    console.error('[POST render-cancel]', error)
    res.status(500).json({ error: 'Failed to cancel render' })
  }
})

// POST /api/v1/video-products/:id/derive — 派生视频
router.post('/video-products/:id/derive', async (req: Request, res: Response) => {
  try {
    const { platform } = req.body

    if (!platform) {
      res.status(400).json({ error: 'platform is required' })
      return
    }

    // 查找原视频
    const source = await prisma.videoProduct.findFirst({
      where: { id: str(req.params.id), task: { userId: DEMO_USER_ID } },
    })
    if (!source) {
      res.status(404).json({ error: 'Source video not found' })
      return
    }

    // 派生新视频产品（复用同一脚本，不同平台配置）
    const derived = await prisma.videoProduct.create({
      data: {
        taskId: source.taskId,
        scriptId: source.scriptId,
        title: `${source.title} - ${platform}`,
        status: 'draft',
        platform,
        resolution: platform === 'image_text' ? '1080p' : source.resolution,
      },
    })

    // 复制素材关联
    const existingMaterials = await prisma.videoMaterial.findMany({
      where: { videoProductId: source.id },
    })
    if (existingMaterials.length > 0) {
      await prisma.videoMaterial.createMany({
        data: existingMaterials.map(vm => ({
          videoProductId: derived.id,
          materialId: vm.materialId,
          usageType: vm.usageType,
        })),
      })
    }

    res.json({
      success: true,
      derived_id: derived.id,
      title: derived.title,
    })
  } catch (error) {
    console.error('[POST derive]', error)
    res.status(500).json({ error: 'Failed to derive video' })
  }
})

export default router
