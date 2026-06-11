import { Router } from 'express'
import { prisma } from '../../db.js'
import { getUserId, DEMO_USER_ID, str } from '../../constants.js'
import type { Request, Response } from 'express'
import { getCollector, getSupportedPlatforms } from '../../services/collectors/registry.js'
import { collectRecords, collectAllEnabled } from '../../services/collectors/collectService.js'
import { ensureDefaultSchedule } from '../../services/dataCollectScheduler.js'

const router: Router = Router()

// GET /api/v1/auto-collect/supported-platforms — 列出支持自动采集的平台
router.get('/auto-collect/supported-platforms', (_req: Request, res: Response) => {
  res.json({ platforms: getSupportedPlatforms() })
})

// PUT /api/v1/publish-records/:id/auto-collect — 设置平台视频ID + 开关采集
router.put('/publish-records/:id/auto-collect', async (req: Request, res: Response) => {
  try {
    const recordId = str(req.params.id)
    const { platform_video_id, auto_collect } = req.body as {
      platform_video_id?: string
      auto_collect?: boolean
    }

    const record = await prisma.publishRecord.findUnique({ where: { id: recordId } })
    if (!record) {
      res.status(404).json({ error: 'Publish record not found' })
      return
    }

    const collector = getCollector(record.platform)
    if (!collector) {
      res.status(400).json({
        error: `平台 "${record.platform}" 暂不支持自动采集。支持: ${getSupportedPlatforms().join(', ')}`,
      })
      return
    }

    // 校验平台视频ID格式
    if (platform_video_id !== undefined && platform_video_id !== null && platform_video_id !== '') {
      if (!collector.isValidVideoId(platform_video_id)) {
        res.status(400).json({
          error: `无效的平台视频ID格式 (${record.platform})，期望格式如: BV1GJ411x7G8`,
        })
        return
      }
    }

    const updateData: Record<string, unknown> = {}
    if (platform_video_id !== undefined) updateData.platformVideoId = platform_video_id
    if (auto_collect !== undefined) updateData.autoCollect = auto_collect
    if (auto_collect) updateData.lastCollectedAt = null // 首次启用重置

    const updated = await prisma.publishRecord.update({
      where: { id: recordId },
      data: updateData,
    })

    // 如果启用了自动采集，确保存在默认采集计划
    if (auto_collect) {
      const userId = getUserId(req as any) || DEMO_USER_ID
      await ensureDefaultSchedule(userId, record.platform)
    }

    res.json({
      id: updated.id,
      platform: updated.platform,
      platform_video_id: updated.platformVideoId,
      auto_collect: updated.autoCollect,
      last_collected_at: updated.lastCollectedAt?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('[PUT /publish-records/:id/auto-collect]', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// POST /api/v1/auto-collect/snapshots — 手动触发指定记录采集
router.post('/auto-collect/snapshots', async (req: Request, res: Response) => {
  try {
    const { publish_record_ids } = req.body as { publish_record_ids?: string[] }
    if (!Array.isArray(publish_record_ids) || publish_record_ids.length === 0) {
      res.status(400).json({ error: 'publish_record_ids 数组不能为空' })
      return
    }

    const records = await prisma.publishRecord.findMany({
      where: { id: { in: publish_record_ids }, platformVideoId: { not: null } },
      select: { id: true, platform: true, platformVideoId: true },
    })

    if (records.length === 0) {
      res.json({ total: 0, succeeded: 0, failed: 0, errors: [], message: '没有找到有效的发布记录（需要先设置 platform_video_id）' })
      return
    }

    const result = await collectRecords(records)
    res.json(result)
  } catch (err) {
    console.error('[POST /auto-collect/snapshots]', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// POST /api/v1/auto-collect/collect-all — 手动触发全量采集
router.post('/auto-collect/collect-all', async (_req: Request, res: Response) => {
  try {
    const result = await collectAllEnabled()
    res.json(result)
  } catch (err) {
    console.error('[POST /auto-collect/collect-all]', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// GET /api/v1/auto-collect/schedules — 查看采集计划
router.get('/auto-collect/schedules', async (_req: Request, res: Response) => {
  try {
    const schedules = await prisma.dataCollectSchedule.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      items: schedules.map(s => ({
        id: s.id,
        platform: s.platform,
        cron_expr: s.cronExpr,
        is_active: s.isActive,
        last_run_at: s.lastRunAt?.toISOString() ?? null,
        next_run_at: s.nextRunAt?.toISOString() ?? null,
      })),
    })
  } catch (err) {
    console.error('[GET /auto-collect/schedules]', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

// PUT /api/v1/auto-collect/schedules/:id — 更新采集计划
router.put('/auto-collect/schedules/:id', async (req: Request, res: Response) => {
  try {
    const { cron_expr, is_active } = req.body as { cron_expr?: string; is_active?: boolean }
    const schedule = await prisma.dataCollectSchedule.findUnique({ where: { id: str(req.params.id) } })
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' })
      return
    }

    const { upsertSchedule } = await import('../../services/dataCollectScheduler.js')
    await upsertSchedule({
      id: schedule.id,
      userId: schedule.userId,
      platform: schedule.platform,
      cronExpr: cron_expr ?? schedule.cronExpr,
      isActive: is_active ?? schedule.isActive,
    })

    res.json({ id: schedule.id, status: 'updated' })
  } catch (err) {
    console.error('[PUT /auto-collect/schedules/:id]', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
})

export default router
