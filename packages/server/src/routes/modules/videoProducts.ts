import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

// GET /api/v1/video-products/:id/publish-workspace — 发布工作区
router.get('/video-products/:id/publish-workspace', async (req: Request, res: Response) => {
  try {
    const video = await prisma.videoProduct.findFirst({
      where: { id: req.params.id, task: { userId: DEMO_USER_ID } },
      include: { publishRecords: true },
    })
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
      publish_records: video.publishRecords.map(r => ({
        id: r.id, platform: r.platform, status: r.status, title: r.title,
        published_at: r.publishedAt?.toISOString() ?? null,
      })),
    })
  } catch (error) {
    console.error('[GET publish-workspace]', error)
    res.status(500).json({ error: 'Failed to load publish workspace' })
  }
})

// POST /api/v1/video-products/:id/generate-copy/batch — 批量生成文案（桩）
router.post('/video-products/:id/generate-copy/batch', async (req: Request, res: Response) => {
  try {
    const { platforms } = req.body
    // TODO: 接入 AI 文案批量生成
    markStub(res, 'AI 文案批量生成未接入')
    res.json({ success: true, platforms: platforms ?? [], message: 'Batch copy generation queued (stub)' })
  } catch (error) {
    console.error('[POST generate-copy/batch]', error)
    res.status(500).json({ error: 'Failed to generate batch copy' })
  }
})

// GET /api/v1/video-products/:id/preview — 预览视频（桩）
router.get('/video-products/:id/preview', async (req: Request, res: Response) => {
  try {
    const video = await prisma.videoProduct.findFirst({
      where: { id: req.params.id, task: { userId: DEMO_USER_ID } },
      include: {
        script: { include: { storyboardSegments: { orderBy: { segmentIndex: 'asc' } } } },
        videoMaterials: { include: { material: true } },
      },
    })
    if (!video) {
      res.status(404).json({ error: 'Video not found' })
      return
    }
    res.json({
      id: video.id,
      title: video.title,
      video_url: video.videoUrl,
      duration: video.duration ? Number(video.duration) : null,
      resolution: video.resolution,
      segments: video.script.storyboardSegments.map(s => ({
        id: s.id, segment_type: s.segmentType, oral_text: s.oralText,
        visual_description: s.visualDescription, duration: Number(s.duration),
      })),
      materials: video.videoMaterials.map(vm => ({
        id: vm.material.id, name: vm.material.name, type: vm.material.type,
        thumbnail_url: vm.material.thumbnailUrl,
      })),
    })
  } catch (error) {
    console.error('[GET preview]', error)
    res.status(500).json({ error: 'Failed to load preview' })
  }
})

// POST /api/v1/video-products/render — 渲染视频（桩）
router.post('/video-products/render', async (req: Request, res: Response) => {
  try {
    // TODO: 接入 Remotion 渲染服务
    markStub(res, 'Remotion 渲染服务未接入')
    const taskId = crypto.randomUUID()
    res.json({ task_id: taskId, status: 'pending' })
  } catch (error) {
    console.error('[POST render]', error)
    res.status(500).json({ error: 'Failed to start render' })
  }
})

// GET /api/v1/video-products/:id/render-status — 渲染状态（桩）
router.get('/video-products/:id/render-status', async (_req: Request, res: Response) => {
  markStub(res, '渲染状态查询为桩')
  res.json({ status: 'pending', progress: 0 })
})

// POST /api/v1/video-products/:id/render-cancel — 取消渲染（桩）
router.post('/video-products/:id/render-cancel', async (_req: Request, res: Response) => {
  markStub(res, '渲染取消为桩')
  res.json({ success: true, message: 'Render cancel — stub' })
})

// POST /api/v1/video-products/:id/derive — 派生视频（桩）
router.post('/video-products/:id/derive', async (req: Request, res: Response) => {
  try {
    const { platform } = req.body
    // TODO: 接入 Remotion 派生渲染
    markStub(res, 'Remotion 派生渲染未接入')
    res.json({ success: true, message: 'Derive queued (stub)' })
  } catch (error) {
    console.error('[POST derive]', error)
    res.status(500).json({ error: 'Failed to derive video' })
  }
})

export default router
