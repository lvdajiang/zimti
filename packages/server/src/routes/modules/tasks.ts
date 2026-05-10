import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

// GET /api/v1/tasks — 任务列表
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { task_ids, status, page = '1', page_size = '20' } = req.query
    const p = Number(page)
    const ps = Math.min(Number(page_size), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown>[] = [{ userId: DEMO_USER_ID }]
    if (status && status !== 'all') where.push({ status: String(status) })
    if (task_ids) {
      const ids = String(task_ids).split(',').filter(Boolean)
      if (ids.length > 0) where.push({ id: { in: ids } })
    }

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where: { AND: where },
        orderBy: { createdAt: 'desc' },
        skip,
        take: ps,
        include: {
          _count: { select: { topicProposals: true, scripts: true } },
        },
      }),
      prisma.task.count({ where: { AND: where } }),
    ])

    res.json({
      items: items.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description ?? '',
        status: t.status,
        current_step: t.currentStep,
        topic_count: t._count.topicProposals,
        script_count: t._count.scripts,
        created_at: t.createdAt.toISOString(),
        updated_at: t.updatedAt.toISOString(),
      })),
      total,
      page: p,
      page_size: ps,
      total_pages: Math.ceil(total / ps),
    })
  } catch (error) {
    console.error('[GET /tasks]', error)
    res.status(500).json({ error: 'Failed to load tasks' })
  }
})

// POST /api/v1/tasks — 创建任务
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { title, description, platform, topic_proposal_id } = req.body
    if (!title) {
      res.status(400).json({ error: 'title is required' })
      return
    }
    const task = await prisma.task.create({
      data: {
        userId: DEMO_USER_ID,
        title,
        description: description ?? null,
        ...(topic_proposal_id ? { topicProposals: { connect: { id: Number(topic_proposal_id) } } } : {}),
      },
    })
    res.json({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      current_step: task.currentStep,
      platform: platform ?? null,
      created_at: task.createdAt.toISOString(),
      updated_at: task.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('[POST /tasks]', error)
    res.status(500).json({ error: 'Failed to create task' })
  }
})

// PUT /api/v1/tasks/:taskId — 更新任务
router.put('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params
    const { title, description, status, current_step } = req.body
    const task = await prisma.task.update({
      where: { id: taskId, userId: DEMO_USER_ID },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(current_step !== undefined ? { currentStep: current_step } : {}),
      },
    })
    res.json({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      current_step: task.currentStep,
      created_at: task.createdAt.toISOString(),
      updated_at: task.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('[PUT /tasks/:taskId]', error)
    res.status(500).json({ error: 'Failed to update task' })
  }
})

// PUT /api/v1/tasks/:taskId/conversion-goal — 设置转化目标（桩）
router.put('/tasks/:taskId/conversion-goal', (_req: Request, res: Response) => {
  markStub(res, '转化目标未实现')
  res.json({ message: 'tasks/conversion-goal — TODO' })
})

// POST /api/v1/tasks/:taskId/import-instructions — 导入说明（桩）
router.post('/tasks/:taskId/import-instructions', (_req: Request, res: Response) => {
  markStub(res, '导入说明未实现')
  res.json({ message: 'tasks/import-instructions — TODO' })
})

// POST /api/v1/tasks/:taskId/import-experience — 导入经验（桩）
router.post('/tasks/:taskId/import-experience', (_req: Request, res: Response) => {
  markStub(res, '导入经验未实现')
  res.json({ message: 'tasks/import-experience — TODO' })
})

export default router
