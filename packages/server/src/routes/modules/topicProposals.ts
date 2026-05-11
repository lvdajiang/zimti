import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { toInt } from '../../constants.js'
import { runTask, getTask } from '../../services/ai/index.js'
import { generateTopics, mergeTopics } from '../../services/ai/generators/topicGenerate.js'

const router: Router = Router()

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

// GET /api/v1/topic-proposals — 选题列表（支持搜索、排序）
router.get('/topic-proposals', async (req: Request, res: Response) => {
  try {
    const { keyword, sort_by, status, page, page_size } = req.query
    const pageNum = toInt(String(page ?? '')) || 1
    const pageSize = Math.min(toInt(String(page_size ?? '')) || 20, 100)

    const where: Record<string, unknown> = {}
    if (keyword) {
      where.title = { contains: String(keyword) }
    }
    if (status) {
      where.status = String(status)
    }

    const orderBy: Record<string, string> = {}
    const sortBy = String(sort_by || 'created_at_desc')
    if (sortBy === 'created_at_asc') {
      orderBy.createdAt = 'asc'
    } else if (sortBy === 'title_asc') {
      orderBy.title = 'asc'
    } else if (sortBy === 'title_desc') {
      orderBy.title = 'desc'
    } else {
      orderBy.createdAt = 'desc'
    }

    const [items, total] = await Promise.all([
      prisma.topicProposal.findMany({
        where,
        orderBy,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.topicProposal.count({ where }),
    ])

    res.json({
      items: items.map(mapProposal),
      total,
      page: pageNum,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('[GET /topic-proposals]', error)
    res.status(500).json({ error: 'Failed to fetch topic proposals' })
  }
})

// PUT /api/v1/topic-proposals/:id — 编辑选题
router.put('/topic-proposals/:id', async (req: Request, res: Response) => {
  try {
    const id = toInt(String(req.params.id))
    const { title, description, keywords, angle, video_count, status } = req.body

    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (keywords !== undefined) data.keywords = keywords
    if (angle !== undefined) data.angle = angle
    if (video_count !== undefined) data.videoCount = toInt(String(video_count))
    if (status !== undefined) data.status = status

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    const proposal = await prisma.topicProposal.update({
      where: { id },
      data,
    })
    res.json(mapProposal(proposal))
  } catch (error) {
    console.error('[PUT /topic-proposals/:id]', error)
    res.status(500).json({ error: 'Failed to update topic proposal' })
  }
})

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

// POST /api/v1/topic-proposals/generate — AI 生成选题
router.post('/topic-proposals/generate', async (req: Request, res: Response) => {
  try {
    const { task_id, count } = req.body
    if (!task_id) {
      res.status(400).json({ error: 'task_id is required' })
      return
    }
    const task = await runTask(
      { type: 'topic_generate', input: { task_id, count: count ?? 5 } },
      () => generateTopics({ task_id, count }),
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST /topic-proposals/generate]', error)
    res.status(500).json({ error: 'Failed to generate topics' })
  }
})

// GET /api/v1/topic-proposals/generate/:taskId/status — 生成状态
router.get('/topic-proposals/generate/:taskId/status', async (req: Request, res: Response) => {
  try {
    const task = await getTask(req.params.taskId as string)
    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json({ task_id: task.id, status: task.status, progress: task.progress, output: task.output })
  } catch (error) {
    console.error('[GET generate/status]', error)
    res.status(500).json({ error: 'Failed to get generation status' })
  }
})

// POST /api/v1/topic-proposals/:topicId/select — 选择选题
router.post('/topic-proposals/:topicId/select', async (req: Request, res: Response) => {
  try {
    const proposal = await prisma.topicProposal.update({
      where: { id: toInt(String(req.params.topicId)) },
      data: { status: 'selected' },
    })
    res.json(mapProposal(proposal))
  } catch (error) {
    console.error('[POST /topic-proposals/:topicId/select]', error)
    res.status(500).json({ error: 'Failed to select topic' })
  }
})

// POST /api/v1/topic-proposals/merge — 合并选题
router.post('/topic-proposals/merge', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length < 2) {
      res.status(400).json({ error: 'At least 2 topic IDs required' })
      return
    }
    const result = await mergeTopics(ids.map(Number))
    res.json({ success: true, merged: result })
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
    const proposal = await prisma.topicProposal.findUnique({ where: { id: toInt(String(topic_id)) } })
    if (!proposal) {
      res.status(404).json({ error: 'Topic not found' })
      return
    }
    const updated = await prisma.topicProposal.update({
      where: { id: toInt(String(topic_id)) },
      data: { videoIds: Array.from(new Set(proposal.videoIds.concat(video_ids.map((v: unknown) => toInt(String(v)))))) },
    })
    res.json(mapProposal(updated))
  } catch (error) {
    console.error('[POST /topic-proposals/add-videos]', error)
    res.status(500).json({ error: 'Failed to add videos' })
  }
})

export default router
