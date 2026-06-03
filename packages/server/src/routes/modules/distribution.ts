/**
 * 全渠道分发路由 — distribution.ts
 *
 * 内容适配、分发管理、发布日历、数据分析
 */

import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { getUserId, str, toInt } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { runTask, getTask } from '../../services/ai/index.js'
import { adaptContentForPlatform, batchAdaptContent } from '../../services/ai/generators/contentAdapt.js'
import { getBrandContextForPrompt } from '../../services/ai/brandContext.js'
import { PLATFORM_CONFIGS, getAllPlatformConfigs } from '../../services/distribution/platformConfigs.js'
import type { Platform } from '@zimti/shared'

const router: Router = Router()
router.use(optionalAuth)

// ============================================================
// 分发记录 CRUD
// ============================================================

// GET /api/v1/distribution/records
router.get('/distribution/records', async (req: Request, res: Response) => {
  const platform = str(req.query.platform)
  const status = str(req.query.status)
  const sourceType = str(req.query.source_type)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 20), 100)
  const skip = (p - 1) * ps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (platform && platform !== 'all') where.platform = platform
  if (status && status !== 'all') where.status = status
  if (sourceType) where.sourceType = sourceType

  const [items, total] = await Promise.all([
    prisma.distributionRecord.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: ps,
    }),
    prisma.distributionRecord.count({ where }),
  ])

  res.json({
    items: items.map(mapDistributionRecord),
    total,
  })
})

// POST /api/v1/distribution/records
router.post('/distribution/records', async (req: Request, res: Response) => {
  const { source_content_id, source_type, platform, adapted_title, adapted_content, adapted_tags } = req.body
  if (!source_content_id || !source_type || !platform) {
    res.status(400).json({ error: 'source_content_id, source_type, platform are required' })
    return
  }

  const record = await prisma.distributionRecord.create({
    data: {
      userId: getUserId(req as any),
      sourceContentId: String(source_content_id),
      sourceType: String(source_type),
      platform: String(platform),
      adaptedTitle: adapted_title ? String(adapted_title) : null,
      adaptedContent: adapted_content ? String(adapted_content) : null,
      adaptedTags: Array.isArray(adapted_tags) ? adapted_tags.map(String) : [],
      characterCount: adapted_content ? String(adapted_content).length : 0,
      status: 'draft',
    },
  })
  res.status(201).json(mapDistributionRecord(record))
})

// PUT /api/v1/distribution/records/:id
router.put('/distribution/records/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const { adapted_title, adapted_content, adapted_tags, status } = req.body

  const existing = await prisma.distributionRecord.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const record = await prisma.distributionRecord.update({
    where: { id },
    data: {
      ...(adapted_title !== undefined && { adaptedTitle: String(adapted_title) }),
      ...(adapted_content !== undefined && {
        adaptedContent: String(adapted_content),
        characterCount: String(adapted_content).length,
      }),
      ...(adapted_tags !== undefined && { adaptedTags: Array.isArray(adapted_tags) ? adapted_tags.map(String) : [] }),
      ...(status !== undefined && { status: String(status) }),
    },
  })
  res.json(mapDistributionRecord(record))
})

// DELETE /api/v1/distribution/records/:id
router.delete('/distribution/records/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const existing = await prisma.distributionRecord.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  await prisma.distributionRecord.delete({ where: { id } })
  res.json({ ok: true })
})

// ============================================================
// AI 内容适配
// ============================================================

// POST /api/v1/distribution/adapt — AI 适配单平台
router.post('/distribution/adapt', async (req: Request, res: Response) => {
  const { source_title, source_content, source_tags, target_platform, brand_context: bodyBrandContext } = req.body
  if (!source_title || !target_platform) {
    res.status(400).json({ error: 'source_title and target_platform are required' })
    return
  }

  try {
    const userId = getUserId(req as any)
    const autoBrandContext = await getBrandContextForPrompt(userId)
    const brandContext = bodyBrandContext ? String(bodyBrandContext) : autoBrandContext
    const task = await runTask(
      {
        type: 'content_adapt',
        input: { source_title, source_content, source_tags, target_platform, brand_context: brandContext },
      },
      () => adaptContentForPlatform({
        source_title: String(source_title),
        source_content: String(source_content ?? ''),
        source_tags: Array.isArray(source_tags) ? source_tags : [],
        target_platform: String(target_platform) as Platform,
        brand_context: brandContext || undefined,
      }),
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST distribution/adapt]', error)
    res.status(500).json({ error: 'Failed to adapt content' })
  }
})

// GET /api/v1/distribution/adapt/:taskId/status
router.get('/distribution/adapt/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output })
})

// POST /api/v1/distribution/batch-adapt — 一键适配多平台
router.post('/distribution/batch-adapt', async (req: Request, res: Response) => {
  const { source_title, source_content, source_tags, platforms, brand_context: bodyBrandContext } = req.body
  if (!source_title || !Array.isArray(platforms) || platforms.length === 0) {
    res.status(400).json({ error: 'source_title and platforms[] are required' })
    return
  }

  try {
    const userId = getUserId(req as any)
    const autoBrandContext = await getBrandContextForPrompt(userId)
    const brandContext = bodyBrandContext ? String(bodyBrandContext) : autoBrandContext
    const task = await runTask(
      {
        type: 'content_batch_adapt',
        input: { source_title, source_content, source_tags, platforms, brand_context: brandContext },
      },
      async () => {
        const results = await batchAdaptContent({
          source_title: String(source_title),
          source_content: String(source_content ?? ''),
          source_tags: Array.isArray(source_tags) ? source_tags : [],
          platforms: platforms as Platform[],
          brand_context: brandContext || undefined,
        })
        return results
      },
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST distribution/batch-adapt]', error)
    res.status(500).json({ error: 'Failed to batch adapt content' })
  }
})

// GET /api/v1/distribution/batch-adapt/:taskId/status
router.get('/distribution/batch-adapt/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output })
})

// ============================================================
// 分发模板
// ============================================================

// GET /api/v1/distribution/templates
router.get('/distribution/templates', async (req: Request, res: Response) => {
  const platform = str(req.query.platform)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (platform && platform !== 'all') where.platform = platform

  const items = await prisma.distributionTemplate.findMany({
    where,
    orderBy: { platform: 'asc' },
  })
  res.json({ items: items.map(mapTemplate), total: items.length })
})

// POST /api/v1/distribution/templates
router.post('/distribution/templates', async (req: Request, res: Response) => {
  const { platform, name, content_template, max_length, tag_limit, hashtag_format, optimal_times } = req.body
  if (!platform || !name) {
    res.status(400).json({ error: 'platform and name are required' })
    return
  }

  const config = PLATFORM_CONFIGS[platform as Platform]
  const template = await prisma.distributionTemplate.create({
    data: {
      userId: getUserId(req as any),
      platform: String(platform),
      name: String(name),
      contentTemplate: String(content_template ?? ''),
      maxLength: max_length ? Number(max_length) : (config?.maxLength ?? 1000),
      tagLimit: tag_limit ? Number(tag_limit) : (config?.tagLimit ?? 5),
      hashtagFormat: String(hashtag_format ?? config?.tagPrefix ?? '#'),
      optimalTimes: Array.isArray(optimal_times) ? optimal_times : (config?.optimalTimes ?? []),
    },
  })
  res.status(201).json(mapTemplate(template))
})

// PUT /api/v1/distribution/templates/:id
router.put('/distribution/templates/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const { name, content_template, max_length, tag_limit, hashtag_format, optimal_times } = req.body

  const existing = await prisma.distributionTemplate.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const template = await prisma.distributionTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name) }),
      ...(content_template !== undefined && { contentTemplate: String(content_template) }),
      ...(max_length !== undefined && { maxLength: Number(max_length) }),
      ...(tag_limit !== undefined && { tagLimit: Number(tag_limit) }),
      ...(hashtag_format !== undefined && { hashtagFormat: String(hashtag_format) }),
      ...(optimal_times !== undefined && { optimalTimes: Array.isArray(optimal_times) ? optimal_times : [] }),
    },
  })
  res.json(mapTemplate(template))
})

// DELETE /api/v1/distribution/templates/:id
router.delete('/distribution/templates/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const existing = await prisma.distributionTemplate.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  await prisma.distributionTemplate.delete({ where: { id } })
  res.json({ ok: true })
})

// ============================================================
// 日历 + 排期 + 发布 + 分析
// ============================================================

// GET /api/v1/distribution/calendar
router.get('/distribution/calendar', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const from = str(req.query.from)
  const to = str(req.query.to)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    userId,
    status: { in: ['scheduled', 'published'] },
  }
  if (from || to) {
    where.scheduledAt = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    }
  }

  const items = await prisma.distributionRecord.findMany({
    where,
    orderBy: { scheduledAt: 'asc' },
  })
  res.json({ items: items.map(mapDistributionRecord) })
})

// POST /api/v1/distribution/records/:id/schedule
router.post('/distribution/records/:id/schedule', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const { scheduled_at } = req.body
  if (!scheduled_at) {
    res.status(400).json({ error: 'scheduled_at is required' })
    return
  }

  const existing = await prisma.distributionRecord.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const record = await prisma.distributionRecord.update({
    where: { id },
    data: {
      scheduledAt: new Date(scheduled_at),
      status: existing.status === 'adapted' ? 'scheduled' : existing.status,
    },
  })
  res.json(mapDistributionRecord(record))
})

// POST /api/v1/distribution/records/:id/publish
router.post('/distribution/records/:id/publish', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const { publish_url } = req.body

  const existing = await prisma.distributionRecord.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const record = await prisma.distributionRecord.update({
    where: { id },
    data: {
      status: 'published',
      publishedAt: new Date(),
      ...(publish_url && { publishUrl: String(publish_url) }),
    },
  })
  res.json(mapDistributionRecord(record))
})

// GET /api/v1/distribution/analytics
router.get('/distribution/analytics', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)

  const [totalByPlatform, statusCounts, recentPublished] = await Promise.all([
    prisma.distributionRecord.groupBy({
      by: ['platform'],
      where: { userId },
      _count: true,
    }),
    prisma.distributionRecord.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    }),
    prisma.distributionRecord.findMany({
      where: { userId, status: 'published' },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    }),
  ])

  res.json({
    by_platform: totalByPlatform.map(r => ({ platform: r.platform, count: r._count })),
    by_status: statusCounts.map(r => ({ status: r.status, count: r._count })),
    recent_published: recentPublished.map(mapDistributionRecord),
  })
})

// GET /api/v1/distribution/platform-configs
router.get('/distribution/platform-configs', (_req: Request, res: Response) => {
  res.json({ configs: getAllPlatformConfigs() })
})

// ============================================================
// Helpers
// ============================================================

interface DistributionRecordRow {
  id: string; userId: string; sourceContentId: string; sourceType: string;
  platform: string; adaptedTitle: string | null; adaptedContent: string | null;
  adaptedTags: string[]; characterCount: number; platformRules: unknown;
  status: string; scheduledAt: Date | null; publishedAt: Date | null;
  publishUrl: string | null; platformMetrics: unknown;
  createdAt: Date; updatedAt: Date;
}

function mapDistributionRecord(r: DistributionRecordRow) {
  return {
    id: r.id,
    user_id: r.userId,
    source_content_id: r.sourceContentId,
    source_type: r.sourceType,
    platform: r.platform,
    adapted_title: r.adaptedTitle,
    adapted_content: r.adaptedContent,
    adapted_tags: r.adaptedTags,
    character_count: r.characterCount,
    status: r.status,
    scheduled_at: r.scheduledAt?.toISOString() ?? null,
    published_at: r.publishedAt?.toISOString() ?? null,
    publish_url: r.publishUrl,
    platform_metrics: r.platformMetrics as Record<string, number> | null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }
}

interface TemplateRow {
  id: string; userId: string; platform: string; name: string;
  contentTemplate: string; maxLength: number; tagLimit: number;
  hashtagFormat: string; optimalTimes: string[];
  createdAt: Date; updatedAt: Date;
}

function mapTemplate(r: TemplateRow) {
  return {
    id: r.id,
    user_id: r.userId,
    platform: r.platform,
    name: r.name,
    content_template: r.contentTemplate,
    max_length: r.maxLength,
    tag_limit: r.tagLimit,
    hashtag_format: r.hashtagFormat,
    optimal_times: r.optimalTimes,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }
}

export default router
