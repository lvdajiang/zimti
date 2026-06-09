import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str, toInt } from '../../constants.js'
import {
  registerCollectSchedule,
  unregisterCollectSchedule,
  getCollectSchedule,
  getActiveCollectScheduleIds,
} from '../../services/collectScheduler.js'

const router: Router = Router()

// GET /api/v1/collect-tasks — 列表
router.get('/collect-tasks', async (req: Request, res: Response) => {
  try {
    const statusFilter = str(req.query.status)
    const typeFilter = str(req.query.task_type)
    const p = toInt(req.query.page, 1)
    const ps = Math.min(toInt(req.query.page_size, 20), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown>[] = [{ userId: DEMO_USER_ID }]
    if (statusFilter && statusFilter !== 'all') where.push({ status: statusFilter })
    if (typeFilter && typeFilter !== 'all') where.push({ taskType: typeFilter })

    const [items, total] = await Promise.all([
      prisma.collectTask.findMany({
        where: { AND: where },
        orderBy: { createdAt: 'desc' },
        skip,
        take: ps,
        include: { targetAccount: { select: { accountName: true, platform: true } } },
      }),
      prisma.collectTask.count({ where: { AND: where } }),
    ])

    res.json({
      items: items.map(t => ({
        id: t.id,
        target_account_id: t.targetAccountId,
        account_name: t.targetAccount.accountName,
        platform: t.targetAccount.platform,
        task_type: t.taskType,
        status: t.status,
        max_count: t.maxCount,
        collected_count: t.collectedCount,
        date_range_start: t.dateRangeStart?.toISOString() ?? null,
        date_range_end: t.dateRangeEnd?.toISOString() ?? null,
        created_at: t.createdAt.toISOString(),
        updated_at: t.updatedAt.toISOString(),
      })),
      total,
    })
  } catch (error) {
    console.error('[GET /collect-tasks]', error)
    res.status(500).json({ error: 'Failed to load collect tasks' })
  }
})

// GET /api/v1/collect-tasks/stats — 统计
router.get('/collect-tasks/stats', async (_req: Request, res: Response) => {
  try {
    const [total, pending, running, completed, failed] = await Promise.all([
      prisma.collectTask.count({ where: { userId: DEMO_USER_ID } }),
      prisma.collectTask.count({ where: { userId: DEMO_USER_ID, status: 'pending' } }),
      prisma.collectTask.count({ where: { userId: DEMO_USER_ID, status: 'running' } }),
      prisma.collectTask.count({ where: { userId: DEMO_USER_ID, status: 'completed' } }),
      prisma.collectTask.count({ where: { userId: DEMO_USER_ID, status: 'failed' } }),
    ])
    res.json({ total, pending, running, completed, failed })
  } catch (error) {
    console.error('[GET /collect-tasks/stats]', error)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})

// POST /api/v1/collect-tasks — 创建
router.post('/collect-tasks', async (req: Request, res: Response) => {
  try {
    const { target_account_id, task_type, max_count, date_range_start, date_range_end } = req.body
    if (!target_account_id || !task_type) {
      res.status(400).json({ error: 'target_account_id and task_type are required' })
      return
    }
    const task = await prisma.collectTask.create({
      data: {
        userId: DEMO_USER_ID,
        targetAccountId: target_account_id,
        taskType: task_type,
        maxCount: max_count ?? 50,
        ...(date_range_start && { dateRangeStart: new Date(date_range_start) }),
        ...(date_range_end && { dateRangeEnd: new Date(date_range_end) }),
      },
    })
    res.json({ id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST /collect-tasks]', error)
    res.status(500).json({ error: 'Failed to create collect task' })
  }
})

// PUT /api/v1/collect-tasks/:id — 更新
router.put('/collect-tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await prisma.collectTask.update({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
      data: { status: req.body.status },
    })
    res.json({ id: task.id, status: task.status })
  } catch (error) {
    console.error('[PUT /collect-tasks/:id]', error)
    res.status(500).json({ error: 'Failed to update task' })
  }
})

// DELETE /api/v1/collect-tasks/:id — 删除
router.delete('/collect-tasks/:id', async (req: Request, res: Response) => {
  try {
    await prisma.collectTask.delete({ where: { id: str(req.params.id), userId: DEMO_USER_ID } })
    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /collect-tasks/:id]', error)
    res.status(500).json({ error: 'Failed to delete task' })
  }
})

// DELETE /api/v1/collect-tasks/batch — 批量删除
router.delete('/collect-tasks/batch', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' })
      return
    }
    await prisma.collectTask.deleteMany({ where: { id: { in: ids }, userId: DEMO_USER_ID } })
    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /collect-tasks/batch]', error)
    res.status(500).json({ error: 'Failed to batch delete' })
  }
})

// POST /api/v1/collect-tasks/:id/execute — 执行
router.post('/collect-tasks/:id/execute', async (req: Request, res: Response) => {
  try {
    const task = await prisma.collectTask.update({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
      data: { status: 'running' },
    })
    res.json({ id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST /collect-tasks/:id/execute]', error)
    res.status(500).json({ error: 'Failed to execute task' })
  }
})

// POST /api/v1/collect-tasks/:id/pause — 暂停
router.post('/collect-tasks/:id/pause', async (req: Request, res: Response) => {
  try {
    const task = await prisma.collectTask.update({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
      data: { status: 'paused' },
    })
    res.json({ id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST /collect-tasks/:id/pause]', error)
    res.status(500).json({ error: 'Failed to pause task' })
  }
})

// POST /api/v1/collect-tasks/:id/retry — 重试
router.post('/collect-tasks/:id/retry', async (req: Request, res: Response) => {
  try {
    const task = await prisma.collectTask.update({
      where: { id: str(req.params.id), userId: DEMO_USER_ID, status: 'failed' },
      data: { status: 'pending' },
    })
    if (!task) {
      res.status(400).json({ error: 'Task not found or not in failed state' })
      return
    }
    res.json({ id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST /collect-tasks/:id/retry]', error)
    res.status(500).json({ error: 'Failed to retry task' })
  }
})

// POST /collect-tasks/:id/rerun — 重新采集
router.post('/collect-tasks/:id/rerun', async (req: Request, res: Response) => {
  try {
    const task = await prisma.collectTask.update({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
      data: { status: 'pending', collectedCount: 0 },
    })
    res.json({ id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST /collect-tasks/:id/rerun]', error)
    res.status(500).json({ error: 'Failed to rerun task' })
  }
})

// GET /api/v1/collect-tasks/:id/logs — 日志
router.get('/collect-tasks/:id/logs', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.collectTaskLog.findMany({
      where: { taskId: str(req.params.id) },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ items: logs.map(l => ({
      level: l.level,
      message: l.message,
      created_at: l.createdAt.toISOString(),
    })) })
  } catch (error) {
    console.error('[GET /collect-tasks/:id/logs]', error)
    res.status(500).json({ error: 'Failed to load logs' })
  }
})

// GET /api/v1/collect-tasks/schedule — 查询调度状态
router.get('/collect-tasks/schedule', async (req: Request, res: Response) => {
  try {
    const taskId = str(req.query.task_id)
    if (taskId) {
      const schedule = getCollectSchedule(taskId)
      res.json({ task_id: taskId, schedule })
      return
    }
    // 返回所有活跃调度
    res.json({ active_schedules: getActiveCollectScheduleIds() })
  } catch (error) {
    console.error('[GET /collect-tasks/schedule]', error)
    res.status(500).json({ error: 'Failed to get schedule' })
  }
})

// PUT /api/v1/collect-tasks/schedule — 定时调度配置
router.put('/collect-tasks/schedule', async (req: Request, res: Response) => {
  try {
    const { task_id, cron_expr, is_active } = req.body as {
      task_id?: string
      cron_expr?: string
      is_active?: boolean
    }

    if (!task_id) {
      res.status(400).json({ error: 'task_id is required' })
      return
    }

    // 确认任务存在
    const task = await prisma.collectTask.findFirst({
      where: { id: task_id, userId: DEMO_USER_ID },
    })
    if (!task) {
      res.status(404).json({ error: 'Collect task not found' })
      return
    }

    if (is_active === false) {
      // 停止调度
      unregisterCollectSchedule(task_id)
      await prisma.collectTaskLog.create({
        data: { taskId: task_id, level: 'info', message: '定时调度已停止' },
      })
      res.json({ success: true, task_id, is_active: false })
      return
    }

    // 注册/更新调度
    if (!cron_expr) {
      res.status(400).json({ error: 'cron_expr is required when activating schedule' })
      return
    }

    const ok = registerCollectSchedule(task_id, cron_expr)
    if (!ok) {
      res.status(400).json({ error: 'Invalid cron expression' })
      return
    }

    await prisma.collectTaskLog.create({
      data: { taskId: task_id, level: 'info', message: `定时调度已配置: ${cron_expr}` },
    })

    res.json({ success: true, task_id, cron_expr, is_active: true })
  } catch (error) {
    console.error('[PUT /collect-tasks/schedule]', error)
    res.status(500).json({ error: 'Failed to save schedule' })
  }
})

export default router
