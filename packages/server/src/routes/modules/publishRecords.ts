import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str, toInt } from '../../constants.js'
import { runTask, getTask, getAIProvider } from '../../services/ai/index.js'
import { generateCopy } from '../../services/ai/generators/copyGenerate.js'

const router: Router = Router()

function mapRecord(r: {
  id: string; videoProductId: string; platform: string; conversionType: string;
  title: string | null; description: string | null; tags: string[];
  commentGuide: string[]; replyTemplates: string[]; seoScore: number | null;
  publishUrl: string | null; status: string; aigcConfirmed: boolean;
  publishedAt: Date | null; createdAt: Date;
}) {
  return {
    id: r.id,
    video_product_id: r.videoProductId,
    platform: r.platform,
    conversion_type: r.conversionType,
    title: r.title,
    description: r.description,
    tags: r.tags,
    comment_guide: r.commentGuide,
    reply_templates: r.replyTemplates,
    seo_score: r.seoScore,
    publish_url: r.publishUrl,
    status: r.status,
    aigc_confirmed: r.aigcConfirmed,
    published_at: r.publishedAt?.toISOString() ?? null,
    created_at: r.createdAt.toISOString(),
  }
}

// GET /api/v1/publish-records — 列表
router.get('/publish-records', async (req: Request, res: Response) => {
  try {
    const status = str(req.query.status)
    const platform = str(req.query.platform)
    const p = toInt(req.query.page, 1)
    const ps = Math.min(toInt(req.query.page_size, 20), 100)
    const skip = (p - 1) * ps
    const where: Record<string, unknown>[] = [{ videoProduct: { task: { userId: DEMO_USER_ID } } }]
    if (status && status !== 'all') where.push({ status })
    if (platform && platform !== 'all') where.push({ platform })

    const [items, total] = await Promise.all([
      prisma.publishRecord.findMany({
        where: { AND: where },
        orderBy: { createdAt: 'desc' },
        skip, take: ps,
        include: { videoProduct: { select: { title: true } } },
      }),
      prisma.publishRecord.count({ where: { AND: where } }),
    ])

    res.json({
      items: items.map(r => ({ ...mapRecord(r), video_title: r.videoProduct.title })),
      total,
    })
  } catch (error) {
    console.error('[GET /publish-records]', error)
    res.status(500).json({ error: 'Failed to load publish records' })
  }
})

// POST /api/v1/publish-records/:id/generate-copy — AI 生成文案
router.post('/publish-records/:id/generate-copy', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const { platform } = req.body
    const record = await prisma.publishRecord.findUnique({ where: { id } })
    if (!record) {
      res.status(404).json({ error: 'Record not found' })
      return
    }
    const task = await runTask(
      { type: 'copy_generate', input: { record_id: id, platform }, refId: id, refType: 'publish_record' },
      () => generateCopy({ record_id: id, platform }),
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST generate-copy]', error)
    res.status(500).json({ error: 'Failed to generate copy' })
  }
})

// GET /api/v1/publish-records/:id/generate-copy/:taskId/status — 文案生成状态
router.get('/publish-records/:id/generate-copy/:taskId/status', async (req: Request, res: Response) => {
  try {
    const result = await getTask(req.params.taskId as string)
    if (!result) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    res.json({ task_id: result.id, status: result.status, progress: result.progress, output: result.output })
  } catch (error) {
    console.error('[GET generate-copy/status]', error)
    res.status(500).json({ error: 'Failed to get copy generation status' })
  }
})

// PUT /api/v1/publish-records/:id/content — 保存内容
router.put('/publish-records/:id/content', async (req: Request, res: Response) => {
  try {
    const { title, description, tags, comment_guide, reply_templates } = req.body
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (tags !== undefined) updateData.tags = tags
    if (comment_guide !== undefined) updateData.commentGuide = comment_guide
    if (reply_templates !== undefined) updateData.replyTemplates = reply_templates

    const record = await prisma.publishRecord.update({
      where: { id: str(req.params.id) },
      data: updateData,
    })
    res.json(mapRecord(record))
  } catch (error) {
    console.error('[PUT content]', error)
    res.status(500).json({ error: 'Failed to save content' })
  }
})

// GET/POST /api/v1/publish-records/:id/seo-check — SEO 检查（规则引擎）
async function seoCheckHandler(_req: Request, res: Response): Promise<void> {
  try {
    const id = str(_req.params.id)
    const record = await prisma.publishRecord.findUnique({ where: { id } })
    if (!record) {
      res.status(404).json({ error: 'Record not found' })
      return
    }
    const issues: { field: string; message: string; severity: string }[] = []
    let score = 100

    if (!record.title || record.title.length === 0) {
      issues.push({ field: 'title', message: '标题为空，必须填写', severity: 'error' })
      score -= 30
    } else if (record.title.length < 5) {
      issues.push({ field: 'title', message: `标题过短(${record.title.length}字)，建议10-25字`, severity: 'warning' })
      score -= 10
    } else if (record.title.length > 30) {
      issues.push({ field: 'title', message: `标题过长(${record.title.length}字)，建议10-25字`, severity: 'warning' })
      score -= 5
    }

    if (!record.description || record.description.length === 0) {
      issues.push({ field: 'description', message: '描述为空，建议填写50-200字描述', severity: 'warning' })
      score -= 15
    } else if (record.description.length < 50) {
      issues.push({ field: 'description', message: `描述过短(${record.description.length}字)，建议50-200字`, severity: 'info' })
      score -= 5
    }

    if (!record.tags || record.tags.length === 0) {
      issues.push({ field: 'tags', message: '未设置标签，建议添加3-5个标签', severity: 'warning' })
      score -= 15
    } else if (record.tags.length < 3) {
      issues.push({ field: 'tags', message: `标签数量偏少(${record.tags.length}个)，建议3-5个`, severity: 'info' })
      score -= 5
    }

    if (!record.commentGuide || record.commentGuide.length === 0) {
      issues.push({ field: 'comment_guide', message: '未设置评论区引导，有助于提升互动率', severity: 'info' })
      score -= 5
    }

    if (!record.aigcConfirmed) {
      issues.push({ field: 'aigc', message: 'AIGC 内容声明未确认，发布前请确认', severity: 'warning' })
      score -= 10
    }

    score = Math.max(0, Math.min(100, score))
    await prisma.publishRecord.update({ where: { id }, data: { seoScore: score } })
    res.json({ score, issues })
  } catch (error) {
    console.error('[SEO check]', error)
    res.status(500).json({ error: 'Failed to run SEO check' })
  }
}
router.get('/publish-records/:id/seo-check', seoCheckHandler)
router.post('/publish-records/:id/seo-check', seoCheckHandler)

// POST /api/v1/publish-records/:id/auto-save — 自动保存
router.post('/publish-records/:id/auto-save', async (req: Request, res: Response) => {
  try {
    await prisma.publishRecord.update({
      where: { id: str(req.params.id) },
      data: { title: req.body.title, description: req.body.description, tags: req.body.tags ?? [] },
    })
    res.json({ success: true })
  } catch (error) {
    console.error('[POST auto-save]', error)
    res.status(500).json({ error: 'Failed to auto-save' })
  }
})

// POST /api/v1/publish-records/:id/tags — 添加标签
router.post('/publish-records/:id/tags', async (req: Request, res: Response) => {
  try {
    const { tag } = req.body
    if (!tag) {
      res.status(400).json({ error: 'tag is required' })
      return
    }
    const record = await prisma.publishRecord.findUnique({ where: { id: str(req.params.id) } })
    if (!record) {
      res.status(404).json({ error: 'Record not found' })
      return
    }
    const updated = await prisma.publishRecord.update({
      where: { id: str(req.params.id) },
      data: { tags: [...new Set([...record.tags, tag])] },
    })
    res.json(mapRecord(updated))
  } catch (error) {
    console.error('[POST tags]', error)
    res.status(500).json({ error: 'Failed to add tag' })
  }
})

// DELETE /api/v1/publish-records/:recordId/tags/:tag — 删除标签
router.delete('/publish-records/:recordId/tags/:tag', async (req: Request, res: Response) => {
  try {
    const record = await prisma.publishRecord.findUnique({ where: { id: str(req.params.recordId) } })
    if (!record) {
      res.status(404).json({ error: 'Record not found' })
      return
    }
    const updated = await prisma.publishRecord.update({
      where: { id: str(req.params.recordId) },
      data: { tags: record.tags.filter(t => t !== str(req.params.tag)) },
    })
    res.json(mapRecord(updated))
  } catch (error) {
    console.error('[DELETE tags]', error)
    res.status(500).json({ error: 'Failed to remove tag' })
  }
})

// POST /api/v1/publish-records/:id/generate-geo — 生成地理位置信息
router.post('/publish-records/:id/generate-geo', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const record = await prisma.publishRecord.findUnique({ where: { id } })
    if (!record) {
      res.status(404).json({ error: 'Record not found' })
      return
    }

    const task = await runTask(
      { type: 'geo_generate', input: { record_id: id }, refId: id, refType: 'publish_record' },
      async () => {
        const provider = getAIProvider()
        const prompt = `从以下短视频内容中提取地理信息。
标题：${record.title ?? '无'}
描述：${record.description ?? '无'}
标签：${(record.tags ?? []).join('、')}

返回 JSON 对象：{ location_name, latitude, longitude, city, province, country }
如果无法确定位置，所有字段返回 null。`

        const result = await provider.generate(prompt)
        let geoInfo: Record<string, unknown>
        try {
          geoInfo = JSON.parse(result) as Record<string, unknown>
        } catch {
          geoInfo = { location_name: null, latitude: null, longitude: null, city: null, province: null, country: null }
        }

        await prisma.publishRecord.update({
          where: { id },
          data: { geoInfo: geoInfo as any }, // eslint-disable-line @typescript-eslint/no-explicit-any
        })

        return geoInfo
      },
    )

    res.json({ task_id: task.id, status: 'pending' })
  } catch (error) {
    console.error('[POST /publish-records/:id/generate-geo]', error)
    res.status(500).json({ error: 'Failed to generate geo info' })
  }
})

// POST /api/v1/publish-records/:id/publish — 发布（更新数据库状态，平台对接待接入）
router.post('/publish-records/:id/publish', async (req: Request, res: Response) => {
  try {
    const id = str(req.params.id)
    const record = await prisma.publishRecord.findUnique({ where: { id } })
    if (!record) {
      res.status(404).json({ error: 'Record not found' })
      return
    }
    if (record.status === 'published') {
      res.status(400).json({ error: 'Already published' })
      return
    }
    const updated = await prisma.publishRecord.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date() },
    })
    res.json(mapRecord(updated))
  } catch (error) {
    console.error('[POST publish]', error)
    res.status(500).json({ error: 'Failed to publish' })
  }
})

// POST /api/v1/publish-records/:id/aigc-confirm — AIGC 确认
router.post('/publish-records/:id/aigc-confirm', async (req: Request, res: Response) => {
  try {
    const record = await prisma.publishRecord.update({
      where: { id: str(req.params.id) },
      data: { aigcConfirmed: true },
    })
    res.json(mapRecord(record))
  } catch (error) {
    console.error('[POST aigc-confirm]', error)
    res.status(500).json({ error: 'Failed to confirm AIGC' })
  }
})

// PUT /api/v1/publish-records/:id/conversion-type — 更新转化类型
router.put('/publish-records/:id/conversion-type', async (req: Request, res: Response) => {
  try {
    const { conversion_type } = req.body
    const record = await prisma.publishRecord.update({
      where: { id: str(req.params.id) },
      data: { conversionType: conversion_type },
    })
    res.json(mapRecord(record))
  } catch (error) {
    console.error('[PUT conversion-type]', error)
    res.status(500).json({ error: 'Failed to update conversion type' })
  }
})

export default router
