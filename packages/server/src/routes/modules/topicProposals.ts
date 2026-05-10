import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { toInt } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

function mapProposal(p: {
  id: number; taskId: string; title: string; contentSkeleton: unknown;
  voiceRatio: { toNumber: () => number }; status: string; hotspotIds: number[];
  videoIds: number[]; personaId: number | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: p.id,
    task_id: p.taskId,
    title: p.title,
    content_skeleton: p.contentSkeleton,
    voice_ratio: Number(p.voiceRatio),
    status: p.status,
    hotspot_ids: p.hotspotIds,
    video_ids: p.videoIds,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  }
}

// POST /api/v1/topic-proposals — 创建选题（支持直接创建和生成）
router.post('/topic-proposals', async (req: Request, res: Response) => {
  try {
    const { task_id, title, hook, main_points, visual_direction, voice_ratio, hotspot_ids, video_ids } = req.body
    if (!task_id || !title) {
      res.status(400).json({ error: 'task_id and title are required' })
      return
    }
    const proposal = await prisma.topicProposal.create({
      data: {
        taskId: task_id,
        title,
        contentSkeleton: {
          hook: hook ?? '',
          main_points: main_points ?? [],
          visual_direction: visual_direction ?? '',
          structure_type: 'knowledge',
        },
        voiceRatio: voice_ratio ?? 0.6,
        hotspotIds: hotspot_ids ?? [],
        videoIds: video_ids ?? [],
        status: 'generated',
      },
    })
    res.json(mapProposal(proposal))
  } catch (error) {
    console.error('[POST /topic-proposals]', error)
    res.status(500).json({ error: 'Failed to create topic proposal' })
  }
})

// POST /api/v1/topic-proposals/generate — AI 生成选题（桩）
router.post('/topic-proposals/generate', async (req: Request, res: Response) => {
  try {
    const { task_id } = req.body
    if (!task_id) {
      res.status(400).json({ error: 'task_id is required' })
      return
    }
    // TODO: 接入 AI 选题生成服务
    const taskId = crypto.randomUUID()
    markStub(res, 'AI 选题生成未接入')
    res.json({ task_id: taskId, status: 'pending' })
  } catch (error) {
    console.error('[POST /topic-proposals/generate]', error)
    res.status(500).json({ error: 'Failed to generate topics' })
  }
})

// GET /api/v1/topic-proposals/generate/:taskId/status — 生成状态（桩）
router.get('/topic-proposals/generate/:taskId/status', async (_req: Request, res: Response) => {
  markStub(res, '选题生成状态查询为桩')
  res.json({ status: 'pending', progress: 0 })
})

// POST /api/v1/topic-proposals/:topicId/select — 选择选题
router.post('/topic-proposals/:topicId/select', async (req: Request, res: Response) => {
  try {
    const proposal = await prisma.topicProposal.update({
      where: { id: toInt(req.params.topicId) },
      data: { status: 'selected' },
    })
    res.json(mapProposal(proposal))
  } catch (error) {
    console.error('[POST /topic-proposals/:topicId/select]', error)
    res.status(500).json({ error: 'Failed to select topic' })
  }
})

// POST /api/v1/topic-proposals/merge — 合并选题（桩）
router.post('/topic-proposals/merge', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length < 2) {
      res.status(400).json({ error: 'At least 2 topic IDs required' })
      return
    }
    // TODO: AI 合并逻辑
    res.json({ success: true, merged_count: ids.length })
  } catch (error) {
    console.error('[POST /topic-proposals/merge]', error)
    res.status(500).json({ error: 'Failed to merge topics' })
  }
})

// POST /api/v1/topic-proposals/add-videos — 添加参考视频
router.post('/topic-proposals/add-videos', async (req: Request, res: Response) => {
  try {
    const { topic_id, video_ids } = req.body
    if (!topic_id || !Array.isArray(video_ids)) {
      res.status(400).json({ error: 'topic_id and video_ids array required' })
      return
    }
    const proposal = await prisma.topicProposal.findUnique({ where: { id: toInt(topic_id) } })
    if (!proposal) {
      res.status(404).json({ error: 'Topic not found' })
      return
    }
    const updated = await prisma.topicProposal.update({
      where: { id: toInt(topic_id) },
      data: { videoIds: Array.from(new Set(proposal.videoIds.concat(video_ids.map(toInt)))) },
    })
    res.json(mapProposal(updated))
  } catch (error) {
    console.error('[POST /topic-proposals/add-videos]', error)
    res.status(500).json({ error: 'Failed to add videos' })
  }
})

export default router
