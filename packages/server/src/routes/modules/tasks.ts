import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str, toInt } from '../../constants.js'

const router: Router = Router()

// GET /api/v1/tasks — 任务列表
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const task_ids = str(req.query.task_ids)
    const status = str(req.query.status)
    const p = toInt(req.query.page, 1)
    const ps = Math.min(toInt(req.query.page_size, 20), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown>[] = [{ userId: DEMO_USER_ID }]
    if (status && status !== 'all') where.push({ status })
    if (task_ids) {
      const ids = task_ids.split(',').filter(Boolean)
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
    const taskId = str(req.params.taskId)
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

// PUT /api/v1/tasks/:taskId/conversion-goal — 设置转化目标
router.put('/tasks/:taskId/conversion-goal', async (req: Request, res: Response) => {
  try {
    const { goal } = req.body
    if (!goal) {
      res.status(400).json({ error: 'goal is required' })
      return
    }
    const task = await prisma.task.findFirst({ where: { id: str(req.params.taskId), userId: DEMO_USER_ID } })
    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    const updated = await prisma.task.update({
      where: { id: str(req.params.taskId) },
      data: { description: goal },
    })
    res.json({ success: true, goal: updated.description })
  } catch (error) {
    console.error('[PUT conversion-goal]', error)
    res.status(500).json({ error: 'Failed to set conversion goal' })
  }
})

// POST /api/v1/tasks/:taskId/import-instructions — 导入说明
router.post('/tasks/:taskId/import-instructions', async (req: Request, res: Response) => {
  try {
    const { instructions } = req.body
    if (!instructions) {
      res.status(400).json({ error: 'instructions is required' })
      return
    }
    const task = await prisma.task.findFirst({ where: { id: str(req.params.taskId), userId: DEMO_USER_ID } })
    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    const updated = await prisma.task.update({
      where: { id: str(req.params.taskId) },
      data: { description: [task.description, instructions].filter(Boolean).join('\n\n') },
    })
    res.json({ success: true, description: updated.description })
  } catch (error) {
    console.error('[POST import-instructions]', error)
    res.status(500).json({ error: 'Failed to import instructions' })
  }
})

// POST /api/v1/tasks/:taskId/import-experience — 导入经验
router.post('/tasks/:taskId/import-experience', async (req: Request, res: Response) => {
  try {
    const { biggest_surprise, biggest_mistake, next_hypothesis, week_number, tags } = req.body
    if (!biggest_surprise || !biggest_mistake || !next_hypothesis) {
      res.status(400).json({ error: 'biggest_surprise, biggest_mistake, next_hypothesis are required' })
      return
    }
    const task = await prisma.task.findFirst({ where: { id: str(req.params.taskId), userId: DEMO_USER_ID } })
    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    const log = await prisma.experienceLog.create({
      data: {
        userId: DEMO_USER_ID,
        taskId: str(req.params.taskId),
        weekNumber: toInt(week_number, 1),
        biggestSurprise: biggest_surprise,
        biggestMistake: biggest_mistake,
        nextHypothesis: next_hypothesis,
        tags: Array.isArray(tags) ? tags : [],
      },
    })
    res.json({ success: true, id: log.id })
  } catch (error) {
    console.error('[POST import-experience]', error)
    res.status(500).json({ error: 'Failed to import experience' })
  }
})

export default router
