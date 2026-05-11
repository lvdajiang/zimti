import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { toInt } from '../../constants.js'
import { runTask, getTask } from '../../services/ai/index.js'
import { generateStoryboard } from '../../services/ai/generators/storyboardGenerate.js'
import { checkScript } from '../../services/ai/generators/aiCheck.js'

const router: Router = Router()

const VALID_VIDEO_TYPES = ['knowledge', 'story', 'list', 'contrast']
const VALID_SEGMENT_TYPES = ['oral', 'visual', 'transition']
const VALID_STATUSES = ['draft', 'confirmed']

function mapScript(s: {
  id: number; topicId: number; taskId: string; fullText: string;
  videoType: string | null; oralRatio: { toNumber: () => number }; status: string;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: s.id,
    topic_id: s.topicId,
    task_id: s.taskId,
    full_text: s.fullText,
    video_type: s.videoType,
    oral_ratio: Number(s.oralRatio),
    status: s.status,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  }
}

function mapSegment(seg: {
  id: number; scriptId: number; segmentIndex: number; segmentType: string;
  oralText: string | null; visualDescription: string; duration: { toNumber: () => number };
  materialIds: string[]; oralAudioUrl: string | null; transitionType: string | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: seg.id,
    script_id: seg.scriptId,
    segment_index: seg.segmentIndex,
    segment_type: seg.segmentType,
    oral_text: seg.oralText,
    visual_description: seg.visualDescription,
    duration: Number(seg.duration),
    material_ids: seg.materialIds,
    oral_audio_url: seg.oralAudioUrl,
    transition_type: seg.transitionType,
    created_at: seg.createdAt.toISOString(),
    updated_at: seg.updatedAt.toISOString(),
  }
}

function applySuggestionToText(text: string, suggestion: { position?: number; suggestion?: string }): string {
  const pos = suggestion.position ?? text.length
  const insertion = suggestion.suggestion ?? ''
  if (pos >= text.length) return text + '\n' + insertion
  return text.slice(0, pos) + insertion + text.slice(pos)
}

// GET /api/v1/scripts/:id — 加载脚本
router.get('/scripts/:id', async (req: Request, res: Response) => {
  try {
    const script = await prisma.script.findUnique({
      where: { id: toInt(req.params.id) },
      include: {
        storyboardSegments: { orderBy: { segmentIndex: 'asc' } },
      },
    })
    if (!script) {
      res.status(404).json({ error: 'Script not found' })
      return
    }
    res.json({
      ...mapScript(script),
      segments: script.storyboardSegments.map(mapSegment),
    })
  } catch (error) {
    console.error('[GET /scripts/:id]', error)
    res.status(500).json({ error: 'Failed to load script' })
  }
})

// POST /api/v1/scripts — 创建脚本
router.post('/scripts', async (req: Request, res: Response) => {
  try {
    const { task_id, topic_id, full_text, video_type, oral_ratio } = req.body
    if (!task_id || !topic_id) {
      res.status(400).json({ error: 'task_id and topic_id are required' })
      return
    }
    const script = await prisma.script.create({
      data: {
        taskId: task_id,
        topicId: topic_id,
        fullText: full_text ?? '',
        videoType: (video_type && VALID_VIDEO_TYPES.includes(video_type)) ? video_type : null,
        oralRatio: oral_ratio ?? 0.6,
      },
    })
    res.json(mapScript(script))
  } catch (error) {
    console.error('[POST /scripts]', error)
    res.status(500).json({ error: 'Failed to create script' })
  }
})

// PUT /api/v1/scripts/:id — 保存脚本基本信息
router.put('/scripts/:id', async (req: Request, res: Response) => {
  try {
    const { full_text, video_type, oral_ratio } = req.body
    const script = await prisma.script.update({
      where: { id: toInt(req.params.id) },
      data: {
        ...(full_text !== undefined && { fullText: full_text }),
        ...(video_type !== undefined && { videoType: video_type }),
        ...(oral_ratio !== undefined && { oralRatio: oral_ratio }),
      },
    })
    res.json(mapScript(script))
  } catch (error) {
    console.error('[PUT /scripts/:id]', error)
    res.status(500).json({ error: 'Failed to save script' })
  }
})

// GET /api/v1/scripts/:id/segments — 加载分镜片段
router.get('/scripts/:id/segments', async (req: Request, res: Response) => {
  try {
    const segments = await prisma.storyboardSegment.findMany({
      where: { scriptId: toInt(req.params.id) },
      orderBy: { segmentIndex: 'asc' },
    })
    res.json({ items: segments.map(mapSegment) })
  } catch (error) {
    console.error('[GET /scripts/:id/segments]', error)
    res.status(500).json({ error: 'Failed to load segments' })
  }
})

// POST /api/v1/scripts/:id/generate-storyboard — AI 生成分镜
router.post('/scripts/:id/generate-storyboard', async (req: Request, res: Response) => {
  try {
    const scriptId = toInt(req.params.id)
    const { video_type } = req.body
    const task = await runTask(
      { type: 'storyboard_generate', input: { script_id: scriptId, video_type }, refId: String(scriptId), refType: 'script' },
      () => generateStoryboard({ script_id: scriptId, video_type }),
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST /scripts/:id/generate-storyboard]', error)
    res.status(500).json({ error: 'Failed to generate storyboard' })
  }
})

// GET /api/v1/scripts/:scriptId/generate-storyboard/:taskId/status — 分镜生成状态
router.get('/scripts/:scriptId/generate-storyboard/:taskId/status', async (req: Request, res: Response) => {
  try {
    const result = await getTask(req.params.taskId as string)
    if (!result) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json({ task_id: result.id, status: result.status, progress: result.progress, output: result.output })
  } catch (error) {
    console.error('[GET storyboard/status]', error)
    res.status(500).json({ error: 'Failed to get storyboard status' })
  }
})

// PUT /api/v1/scripts/:id/segments/reorder — 片段排序（必须在 :segmentId 路由之前）
router.put('/scripts/:id/segments/reorder', async (req: Request, res: Response) => {
  try {
    const { segment_ids } = req.body
    if (!Array.isArray(segment_ids)) {
      res.status(400).json({ error: 'segment_ids array is required' })
      return
    }
    const scriptId = toInt(req.params.id)
    // 验证所有片段属于该脚本
    const segments = await prisma.storyboardSegment.findMany({
      where: { id: { in: segment_ids.map(Number) } },
    })
    if (segments.length !== segment_ids.length || segments.some(s => s.scriptId !== scriptId)) {
      res.status(400).json({ error: 'Invalid segment IDs' })
      return
    }
    for (let i = 0; i < segment_ids.length; i++) {
      await prisma.storyboardSegment.update({
        where: { id: Number(segment_ids[i]) },
        data: { segmentIndex: i },
      })
    }
    res.json({ success: true })
  } catch (error) {
    console.error('[PUT /scripts/:id/segments/reorder]', error)
    res.status(500).json({ error: 'Failed to reorder segments' })
  }
})

// PUT /api/v1/scripts/:scriptId/segments/:segmentId — 保存单个片段
router.put('/scripts/:scriptId/segments/:segmentId', async (req: Request, res: Response) => {
  try {
    const { oral_text, visual_description, duration, material_ids, transition_type } = req.body
    const segmentId = toInt(req.params.segmentId)
    const scriptId = toInt(req.params.scriptId)
    const existing = await prisma.storyboardSegment.findFirst({ where: { id: segmentId, scriptId } })
    if (!existing) {
      res.status(404).json({ error: 'Segment not found' })
      return
    }
    const segment = await prisma.storyboardSegment.update({
      where: { id: segmentId },
      data: {
        ...(oral_text !== undefined && { oralText: oral_text }),
        ...(visual_description !== undefined && { visualDescription: visual_description }),
        ...(duration !== undefined && { duration: duration }),
        ...(material_ids !== undefined && { materialIds: material_ids }),
        ...(transition_type !== undefined && { transitionType: transition_type }),
      },
    })
    res.json(mapSegment(segment))
  } catch (error) {
    console.error('[PUT /scripts/:scriptId/segments/:segmentId]', error)
    res.status(500).json({ error: 'Failed to save segment' })
  }
})

// POST /api/v1/scripts/:id/segments — 添加片段
router.post('/scripts/:id/segments', async (req: Request, res: Response) => {
  try {
    const { segment_type, oral_text, visual_description, duration, material_ids } = req.body
    if (!segment_type || !VALID_SEGMENT_TYPES.includes(segment_type)) {
      res.status(400).json({ error: 'Valid segment_type is required' })
      return
    }
    const scriptId = toInt(req.params.id)
    const maxIndex = await prisma.storyboardSegment.findFirst({
      where: { scriptId },
      orderBy: { segmentIndex: 'desc' },
      select: { segmentIndex: true },
    })
    const nextIndex = (maxIndex?.segmentIndex ?? -1) + 1
    const segment = await prisma.storyboardSegment.create({
      data: {
        scriptId,
        segmentIndex: nextIndex,
        segmentType: segment_type,
        oralText: oral_text ?? null,
        visualDescription: visual_description ?? '',
        duration: duration ?? 3.0,
        materialIds: material_ids ?? [],
      },
    })
    res.json(mapSegment(segment))
  } catch (error) {
    console.error('[POST /scripts/:id/segments]', error)
    res.status(500).json({ error: 'Failed to add segment' })
  }
})

// DELETE /api/v1/scripts/:scriptId/segments/:segmentId — 删除片段
router.delete('/scripts/:scriptId/segments/:segmentId', async (req: Request, res: Response) => {
  try {
    const scriptId = toInt(req.params.scriptId)
    const segmentId = toInt(req.params.segmentId)
    const segment = await prisma.storyboardSegment.findFirst({
      where: { id: segmentId, scriptId },
    })
    if (!segment) {
      res.status(404).json({ error: 'Segment not found' })
      return
    }
    await prisma.storyboardSegment.delete({ where: { id: segmentId } })
    // 重新排序
    const remaining = await prisma.storyboardSegment.findMany({
      where: { scriptId },
      orderBy: { segmentIndex: 'asc' },
    })
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].segmentIndex !== i) {
        await prisma.storyboardSegment.update({ where: { id: remaining[i].id }, data: { segmentIndex: i } })
      }
    }
    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /scripts/:scriptId/segments/:segmentId]', error)
    res.status(500).json({ error: 'Failed to delete segment' })
  }
})

// POST /api/v1/scripts/:id/ai-check — AI 风味检查
router.post('/scripts/:id/ai-check', async (req: Request, res: Response) => {
  try {
    const scriptId = toInt(req.params.id)
    const task = await runTask(
      { type: 'ai_check', input: { script_id: scriptId }, refId: String(scriptId), refType: 'script' },
      () => checkScript({ script_id: scriptId }),
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST /scripts/:id/ai-check]', error)
    res.status(500).json({ error: 'Failed to run AI check' })
  }
})

// GET /api/v1/scripts/:id/ai-check/:taskId/status — AI 检查状态
router.get('/scripts/:id/ai-check/:taskId/status', async (req: Request, res: Response) => {
  try {
    const result = await getTask(req.params.taskId as string)
    if (!result) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json({ task_id: result.id, status: result.status, progress: result.progress, output: result.output })
  } catch (error) {
    console.error('[GET ai-check/status]', error)
    res.status(500).json({ error: 'Failed to get AI check status' })
  }
})

// POST /api/v1/scripts/:id/apply-suggestion — 应用建议
router.post('/scripts/:id/apply-suggestion', async (req: Request, res: Response) => {
  try {
    const { task_id, suggestion } = req.body
    if (!task_id || !suggestion) {
      res.status(400).json({ error: 'task_id and suggestion are required' })
      return
    }
    const scriptId = toInt(req.params.id)
    const script = await prisma.script.findUnique({ where: { id: scriptId } })
    if (!script) {
      res.status(404).json({ error: 'Script not found' })
      return
    }
    const applied = applySuggestionToText(script.fullText, suggestion)
    const updated = await prisma.script.update({
      where: { id: scriptId },
      data: { fullText: applied },
    })
    res.json({ success: true, full_text: updated.fullText })
  } catch (error) {
    console.error('[POST /scripts/:id/apply-suggestion]', error)
    res.status(500).json({ error: 'Failed to apply suggestion' })
  }
})

// POST /api/v1/scripts/:id/generate-voiceover — 生成配音
router.post('/scripts/:id/generate-voiceover', async (req: Request, res: Response) => {
  try {
    const scriptId = toInt(req.params.id)
    const { text, voice } = req.body as { text?: string; voice?: string }
    if (!text) { res.status(400).json({ error: 'text is required' }); return }

    const { synthesizeSpeech } = await import('../../services/tts/index.js')
    const result = await synthesizeSpeech({ text, voice })

    // 保存到 segments 的 oral_audio_url（简化：存最后一个口播段的音频）
    const oralSegments = await prisma.storyboardSegment.findMany({
      where: { scriptId, segmentType: 'oral' },
      orderBy: { segmentIndex: 'asc' },
    })
    if (oralSegments.length > 0) {
      const lastId = oralSegments[oralSegments.length - 1].id
      await prisma.storyboardSegment.update({
        where: { id: lastId },
        data: { oralAudioUrl: result.filePath },
      })
    }

    res.json({ task_id: scriptId, status: 'completed', audio_url: result.filePath, duration: result.duration })
  } catch (error) {
    console.error('[POST /scripts/:id/generate-voiceover]', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate voiceover' })
  }
})

// GET /api/v1/scripts/:scriptId/generate-voiceover/:taskId/status — 配音状态
router.get('/scripts/:scriptId/generate-voiceover/:taskId/status', async (_req: Request, res: Response) => {
  res.json({ status: 'completed', progress: 100 })
})

// GET /api/v1/scripts/:id/preview-audio — TTS 预览
router.get('/scripts/:id/preview-audio', async (req: Request, res: Response) => {
  try {
    const { text, voice } = req.query as { text?: string; voice?: string }
    if (!text) { res.status(400).json({ error: 'text query param is required' }); return }

    const { previewTTS } = await import('../../services/tts/index.js')
    const filePath = await previewTTS(String(text), voice ? String(voice) : undefined)

    res.setHeader('Content-Type', 'audio/mpeg')
    res.sendFile(filePath)
  } catch (error) {
    console.error('[GET /scripts/:id/preview-audio]', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to preview audio' })
  }
})

// GET /api/v1/scripts/:id/materials — 脚本关联素材
router.get('/scripts/:id/materials', async (req: Request, res: Response) => {
  try {
    const segments = await prisma.storyboardSegment.findMany({
      where: { scriptId: toInt(req.params.id) },
      select: { materialIds: true },
    })
    const allIds = [...new Set(segments.flatMap(s => s.materialIds))]
    const materials = allIds.length > 0
      ? await prisma.material.findMany({ where: { id: { in: allIds } } })
      : []
    res.json({ items: materials.map(m => ({
      id: m.id, name: m.name, type: m.type, thumbnail_url: m.thumbnailUrl, file_url: m.fileUrl,
    })) })
  } catch (error) {
    console.error('[GET /scripts/:id/materials]', error)
    res.status(500).json({ error: 'Failed to load materials' })
  }
})

// PUT /api/v1/scripts/:id/status — 确认脚本
router.put('/scripts/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `Invalid status: ${status}` })
      return
    }
    const script = await prisma.script.update({
      where: { id: toInt(req.params.id) },
      data: { status },
    })
    res.json(mapScript(script))
  } catch (error) {
    console.error('[PUT /scripts/:id/status]', error)
    res.status(500).json({ error: 'Failed to update script status' })
  }
})

// GET /api/v1/scripts/:scriptId/storyboard — 获取分镜（完整，含素材详情）
router.get('/scripts/:scriptId/storyboard', async (req: Request, res: Response) => {
  try {
    const segments = await prisma.storyboardSegment.findMany({
      where: { scriptId: toInt(req.params.scriptId) },
      orderBy: { segmentIndex: 'asc' },
    })
    res.json({ items: segments.map(mapSegment) })
  } catch (error) {
    console.error('[GET /scripts/:scriptId/storyboard]', error)
    res.status(500).json({ error: 'Failed to load storyboard' })
  }
})

// PUT /api/v1/scripts/:scriptId/segments/:segmentId/transition — 更新转场
router.put('/scripts/:scriptId/segments/:segmentId/transition', async (req: Request, res: Response) => {
  try {
    const { transition_type } = req.body
    const segmentId = toInt(req.params.segmentId)
    const scriptId = toInt(req.params.scriptId)
    const existing = await prisma.storyboardSegment.findFirst({ where: { id: segmentId, scriptId } })
    if (!existing) {
      res.status(404).json({ error: 'Segment not found' })
      return
    }
    const segment = await prisma.storyboardSegment.update({
      where: { id: segmentId },
      data: { transitionType: transition_type ?? null },
    })
    res.json(mapSegment(segment))
  } catch (error) {
    console.error('[PUT transition]', error)
    res.status(500).json({ error: 'Failed to update transition' })
  }
})

// PUT /api/v1/scripts/:scriptId/segments/:segmentId/materials — 替换素材
router.put('/scripts/:scriptId/segments/:segmentId/materials', async (req: Request, res: Response) => {
  try {
    const { material_ids } = req.body
    const segmentId = toInt(req.params.segmentId)
    const scriptId = toInt(req.params.scriptId)
    const existing = await prisma.storyboardSegment.findFirst({ where: { id: segmentId, scriptId } })
    if (!existing) {
      res.status(404).json({ error: 'Segment not found' })
      return
    }
    const segment = await prisma.storyboardSegment.update({
      where: { id: segmentId },
      data: { materialIds: material_ids ?? [] },
    })
    res.json(mapSegment(segment))
  } catch (error) {
    console.error('[PUT materials]', error)
    res.status(500).json({ error: 'Failed to replace materials' })
  }
})

// GET /api/v1/scripts/:scriptId/render-config — 渲染配置
router.get('/scripts/:scriptId/render-config', async (req: Request, res: Response) => {
  try {
    const scriptId = toInt(req.params.scriptId)
    const videoProduct = await prisma.videoProduct.findFirst({ where: { scriptId } })
    const defaultConfig = {
      width: 1080, height: 1920, fps: 30,
      format: 'mp4', quality: 'high',
      platforms: ['douyin', 'xiaohongshu', 'weixin'],
    }
    if (videoProduct?.renderConfig && typeof videoProduct.renderConfig === 'object') {
      res.json({ ...defaultConfig, ...(videoProduct.renderConfig as Record<string, unknown>) })
    } else {
      res.json(defaultConfig)
    }
  } catch (error) {
    console.error('[GET render-config]', error)
    res.status(500).json({ error: 'Failed to get render config' })
  }
})

// POST /api/v1/scripts/:scriptId/save-progress — 保存进度（桩）
router.post('/scripts/:scriptId/save-progress', async (req: Request, res: Response) => {
  try {
    const { segments } = req.body
    if (Array.isArray(segments)) {
      for (const seg of segments) {
        if (seg.id) {
          await prisma.storyboardSegment.update({
            where: { id: seg.id },
            data: {
              ...(seg.oral_text !== undefined && { oralText: seg.oral_text }),
              ...(seg.visual_description !== undefined && { visualDescription: seg.visual_description }),
              ...(seg.duration !== undefined && { duration: seg.duration }),
              ...(seg.material_ids !== undefined && { materialIds: seg.material_ids }),
              ...(seg.transition_type !== undefined && { transitionType: seg.transition_type }),
            },
          })
        }
      }
    }
    res.json({ success: true })
  } catch (error) {
    console.error('[POST save-progress]', error)
    res.status(500).json({ error: 'Failed to save progress' })
  }
})

// GET /api/v1/scripts/:scriptId/composition — 获取合成数据
router.get('/scripts/:scriptId/composition', async (req: Request, res: Response) => {
  try {
    const scriptId = toInt(req.params.scriptId)
    const script = await prisma.script.findUnique({ where: { id: scriptId } })
    if (!script) {
      res.status(404).json({ error: 'Script not found' })
      return
    }
    const segments = await prisma.storyboardSegment.findMany({
      where: { scriptId },
      orderBy: { segmentIndex: 'asc' },
    })
    const totalDuration = segments.reduce((sum, s) => sum + Number(s.duration), 0)
    res.json({
      script_id: scriptId,
      total_duration: totalDuration,
      segment_count: segments.length,
      segments: segments.map(s => ({
        index: s.segmentIndex,
        type: s.segmentType,
        oral_text: s.oralText,
        visual_description: s.visualDescription,
        duration: Number(s.duration),
        material_ids: s.materialIds,
        transition_type: s.transitionType,
      })),
    })
  } catch (error) {
    console.error('[GET composition]', error)
    res.status(500).json({ error: 'Failed to get composition' })
  }
})

export default router
