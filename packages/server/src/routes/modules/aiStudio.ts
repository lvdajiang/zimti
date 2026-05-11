import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str } from '../../constants.js'
import { runTask } from '../../services/ai/index.js'
import type { AITaskType } from '../../services/ai/index.js'
import { JimengClient } from '../../services/ai/jimengClient.js'
import type { JimengTaskInput } from '../../services/ai/jimengClient.js'

const router: Router = Router()

const VALID_PROJECT_STATUS = ['draft', 'active', 'archived'] as const
const VALID_ASSET_TYPE = ['image', 'video'] as const
const VALID_ASSET_STATUS = ['pending', 'generating', 'completed', 'failed', 'expired'] as const
const VALID_TASK_TYPE: readonly string[] = ['jimeng_t2i', 'jimeng_i2v', 'jimeng_t2v', 'jimeng_edit', 'jimeng_digital_human']

const REQ_KEY_MAP: Record<string, string> = {
  seedream_3_0: 'seedream_3_0_t2i_250605',
  seedream_4_0: 'seedream_4_0_t2i_250514',
  seedream_5_0: 'seedream_5_0_t2i_250514',
  seed_edit: 'seed_edit_3_0_250514',
  video_3_0_i2v: 'high_aes_i2v_25s_250514',
  video_3_0_t2v: 'high_aes_t2v_25s_250514',
  video_i2v_first_last: 'high_aes_i2v_first_last_25s_250514',
  seaweed_i2v: 'seaweed_i2v_25s_250514',
  seaweed_t2v: 'seaweed_t2v_25s_250514',
  seedance_i2v: 'seedance_i2v_25s_250514',
  seedance_t2v: 'seedance_t2v_25s_250514',
  omnihuman_1_0: 'omnihuman_1_0_250514',
  omnihuman_1_5: 'omnihuman_1_5_250514',
}

// ============================================================
// 项目 CRUD
// ============================================================

router.get('/projects', async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.aiStudioProject.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { assets: true } } },
    })
    res.json(projects.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status,
      asset_count: p._count.assets,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
    })))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

router.post('/projects', async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body as { title?: string; description?: string }
    if (!title) { res.status(400).json({ error: 'title is required' }); return }

    const project = await prisma.aiStudioProject.create({
      data: { userId: DEMO_USER_ID, title, description: description ?? null, status: 'active' },
    })
    res.status(201).json({
      id: project.id, title: project.title, description: project.description,
      status: project.status, created_at: project.createdAt.toISOString(), updated_at: project.updatedAt.toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const project = await prisma.aiStudioProject.findFirst({
      where: { id, userId: DEMO_USER_ID },
      include: { _count: { select: { assets: true } } },
    })
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }
    res.json({
      id: project.id, title: project.title, description: project.description,
      status: project.status, asset_count: project._count.assets,
      created_at: project.createdAt.toISOString(), updated_at: project.updatedAt.toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

router.put('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const { title, description, status } = req.body as { title?: string; description?: string; status?: string }
    if (status && !VALID_PROJECT_STATUS.includes(status as typeof VALID_PROJECT_STATUS[number])) {
      res.status(400).json({ error: 'Invalid status' }); return
    }
    const project = await prisma.aiStudioProject.update({
      where: { id },
      data: { title, description, status },
    })
    res.json({
      id: project.id, title: project.title, description: project.description,
      status: project.status, updated_at: project.updatedAt.toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

router.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    await prisma.aiStudioProject.delete({ where: { id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// ============================================================
// 素材查询
// ============================================================

router.get('/projects/:projectId/assets', async (req: Request, res: Response) => {
  try {
    const projectId = str(req.params.projectId)
    const type = str(req.query.type)
    const status = str(req.query.status)

    const where: Record<string, unknown> = { projectId }
    if (type && VALID_ASSET_TYPE.includes(type as typeof VALID_ASSET_TYPE[number])) where.type = type
    if (status && VALID_ASSET_STATUS.includes(status as typeof VALID_ASSET_STATUS[number])) where.status = status

    const assets = await prisma.aiStudioAsset.findMany({
      where, orderBy: { createdAt: 'desc' },
    })

    res.json(assets.map(a => ({
      id: a.id, project_id: a.projectId, type: a.type, task_type: a.taskType, status: a.status,
      input_params: a.inputParams, file_url: a.fileUrl, thumbnail_url: a.thumbnailUrl,
      width: a.width, height: a.height, duration: a.duration,
      file_size: a.fileSize ? Number(a.fileSize) : null,
      error: a.error, jimeng_task_id: a.jimengTaskId,
      created_at: a.createdAt.toISOString(), updated_at: a.updatedAt.toISOString(),
    })))
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// ============================================================
// 生成端点
// ============================================================

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      project_id: string; task_type: string; prompt?: string; image_url?: string
      first_frame_url?: string; last_frame_url?: string; audio_url?: string
      model?: string; width?: number; height?: number; duration?: number; edit_instruction?: string
    }

    if (!body.project_id || !body.task_type) {
      res.status(400).json({ error: 'project_id and task_type are required' }); return
    }
    if (!VALID_TASK_TYPE.includes(body.task_type)) {
      res.status(400).json({ error: `Invalid task_type: ${body.task_type}` }); return
    }

    const assetType = (['jimeng_t2i', 'jimeng_edit'].includes(body.task_type)) ? 'image' : 'video'

    const asset = await prisma.aiStudioAsset.create({
      data: {
        projectId: body.project_id, type: assetType, taskType: body.task_type, status: 'generating',
        inputParams: {
          prompt: body.prompt, image_url: body.image_url, first_frame_url: body.first_frame_url,
          last_frame_url: body.last_frame_url, audio_url: body.audio_url, model: body.model,
          width: body.width, height: body.height, duration: body.duration, edit_instruction: body.edit_instruction,
        },
      },
    })

    const assetId = asset.id
    await runTask(
      { type: body.task_type as AITaskType, input: { asset_id: assetId }, refId: assetId, refType: 'ai_studio_asset' },
      async () => {
        const client = JimengClient.createFromEnv()
        if (!client) throw new Error('即梦 API 未配置。请设置 JIMENG_ACCESS_KEY/JIMENG_SECRET_KEY 或 JIMENG_API_KEY')

        const modelKey = body.model ?? body.task_type
        let reqKey = REQ_KEY_MAP[modelKey]
        if (!reqKey) {
          const defaults: Record<string, string> = {
            jimeng_t2i: 'seedream_4_0', jimeng_i2v: 'seaweed_i2v', jimeng_t2v: 'seaweed_t2v',
            jimeng_edit: 'seed_edit', jimeng_digital_human: 'omnihuman_1_0',
          }
          reqKey = REQ_KEY_MAP[defaults[body.task_type]] ?? ''
        }

        const jimengParams: JimengTaskInput = { req_key: reqKey as JimengTaskInput['req_key'] }
        if (body.prompt) jimengParams.prompt = body.prompt
        if (body.image_url) jimengParams.image_url = body.image_url
        if (body.first_frame_url) jimengParams.first_frame_url = body.first_frame_url
        if (body.last_frame_url) jimengParams.last_frame_url = body.last_frame_url
        if (body.audio_url) jimengParams.audio_url = body.audio_url
        if (body.width) jimengParams.width = body.width
        if (body.height) jimengParams.height = body.height
        if (body.duration) jimengParams.duration = body.duration
        if (body.edit_instruction) jimengParams.edit_instruction = body.edit_instruction

        const jimengTaskId = await client.submitTask(jimengParams)
        await prisma.aiStudioAsset.update({ where: { id: assetId }, data: { jimengTaskId } })

        for (let i = 0; i < 60; i++) {
          await new Promise(resolve => setTimeout(resolve, 5000))
          const result = await client.pollResult(jimengTaskId)

          if (result.status === 'success' && result.output) {
            const updateData: Record<string, unknown> = { status: 'completed' }
            if (result.output.image_urls?.[0]) {
              updateData.fileUrl = result.output.image_urls[0]
              updateData.thumbnailUrl = result.output.image_urls[0]
            }
            if (result.output.video_url) updateData.fileUrl = result.output.video_url
            if (body.width) updateData.width = body.width
            if (body.height) updateData.height = body.height
            if (body.duration) updateData.duration = body.duration
            await prisma.aiStudioAsset.update({ where: { id: assetId }, data: updateData })
            return { status: 'completed', file_url: updateData.fileUrl }
          }

          if (result.status === 'failed') {
            await prisma.aiStudioAsset.update({
              where: { id: assetId }, data: { status: 'failed', error: result.error ?? 'Unknown error' },
            })
            throw new Error(result.error ?? 'Jimeng task failed')
          }
        }

        throw new Error('Jimeng task timeout (5 minutes)')
      },
    )

    res.status(202).json({ asset_id: assetId, status: 'generating' })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// GET /api/v1/ai-studio/tasks/:id/status
router.get('/tasks/:id/status', async (req: Request, res: Response) => {
  try {
    const assetId = str(req.params.id)
    const asset = await prisma.aiStudioAsset.findUnique({ where: { id: assetId } })
    if (!asset) { res.status(404).json({ error: 'Asset not found' }); return }
    res.json({
      asset_id: asset.id, status: asset.status, file_url: asset.fileUrl,
      thumbnail_url: asset.thumbnailUrl, error: asset.error,
      jimeng_task_id: asset.jimengTaskId, updated_at: asset.updatedAt.toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// GET /api/v1/ai-studio/assets/:id
router.get('/assets/:id', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const asset = await prisma.aiStudioAsset.findUnique({ where: { id } })
    if (!asset) { res.status(404).json({ error: 'Asset not found' }); return }
    res.json({
      id: asset.id, project_id: asset.projectId, type: asset.type, task_type: asset.taskType,
      status: asset.status, input_params: asset.inputParams, file_url: asset.fileUrl,
      thumbnail_url: asset.thumbnailUrl, width: asset.width, height: asset.height, duration: asset.duration,
      file_size: asset.fileSize ? Number(asset.fileSize) : null, error: asset.error,
      jimeng_task_id: asset.jimengTaskId, created_at: asset.createdAt.toISOString(),
      updated_at: asset.updatedAt.toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// DELETE /api/v1/ai-studio/assets/:id
router.delete('/assets/:id', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    await prisma.aiStudioAsset.delete({ where: { id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// ============================================================
// 推送到素材库
// ============================================================

router.post('/assets/:id/push-to-materials', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const asset = await prisma.aiStudioAsset.findUnique({ where: { id } })
    if (!asset || !asset.fileUrl) { res.status(404).json({ error: 'Asset not found or no file' }); return }

    const metadata: Record<string, string | number> = {}
    if (asset.width) metadata.width = asset.width
    if (asset.height) metadata.height = asset.height
    if (asset.duration) metadata.duration = asset.duration

    const material = await prisma.material.create({
      data: {
        userId: DEMO_USER_ID,
        name: `AI生成-${asset.taskType}-${asset.id.slice(0, 8)}`,
        type: asset.type,
        source: 'ai_generated',
        copyrightStatus: 'ai_generated',
        fileUrl: asset.fileUrl,
        thumbnailUrl: asset.thumbnailUrl ?? null,
        fileSize: asset.fileSize ?? 0n,
        metadata,
      },
    })

    res.json({ material_id: material.id })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

router.post('/assets/:id/push-to-segment', async (req: Request, res: Response) => {
  try {
    const assetId = str(req.params.id)
    const { segment_id } = req.body as { segment_id?: number }
    if (!segment_id) { res.status(400).json({ error: 'segment_id is required' }); return }

    const asset = await prisma.aiStudioAsset.findUnique({ where: { id: assetId } })
    if (!asset || !asset.fileUrl) { res.status(404).json({ error: 'Asset not found or no file' }); return }

    const segment = await prisma.storyboardSegment.findUnique({ where: { id: segment_id } })
    if (!segment) { res.status(404).json({ error: 'Segment not found' }); return }

    const materialIds = [...(segment.materialIds as string[]), asset.fileUrl]
    await prisma.storyboardSegment.update({
      where: { id: segment_id },
      data: { materialIds },
    })

    res.json({ success: true, segment_id, material_added: asset.fileUrl })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

export default router
