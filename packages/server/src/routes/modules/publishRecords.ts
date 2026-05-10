import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

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
    const { status, platform, page = '1', page_size = '20' } = req.query
    const ps = Math.min(Number(page_size), 100)
    const skip = (Number(page) - 1) * ps
    const where: Record<string, unknown>[] = [{ videoProduct: { task: { userId: DEMO_USER_ID } } }]
    if (status && status !== 'all') where.push({ status: String(status) })
    if (platform && platform !== 'all') where.push({ platform: String(platform) })

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

// POST /api/v1/publish-records/:id/generate-copy — AI 生成文案（桩）
router.post('/publish-records/:id/generate-copy', async (req: Request, res: Response) => {
  try {
    const { platform } = req.body
    // TODO: 接入 AI 文案生成服务
    res.json({ success: true, message: 'Copy generation queued (stub)' })
  } catch (error) {
    console.error('[POST generate-copy]', error)
    res.status(500).json({ error: 'Failed to generate copy' })
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
      where: { id: req.params.id },
      data: updateData,
    })
    res.json(mapRecord(record))
  } catch (error) {
    console.error('[PUT content]', error)
    res.status(500).json({ error: 'Failed to save content' })
  }
})

// GET /api/v1/publish-records/:id/seo-check — SEO 检查（桩）
router.get('/publish-records/:id/seo-check', async (_req: Request, res: Response) => {
  markStub(res, 'SEO 检查返回硬编码数据')
  res.json({
    score: 72,
    issues: [
      { field: 'title', message: '标题缺少关键词', severity: 'warning' },
      { field: 'tags', message: '标签数量不足', severity: 'info' },
    ],
  })
})

// POST /api/v1/publish-records/:id/auto-save — 自动保存
router.post('/publish-records/:id/auto-save', async (req: Request, res: Response) => {
  try {
    await prisma.publishRecord.update({
      where: { id: req.params.id },
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
    const record = await prisma.publishRecord.findUnique({ where: { id: req.params.id } })
    if (!record) {
      res.status(404).json({ error: 'Record not found' })
      return
    }
    const updated = await prisma.publishRecord.update({
      where: { id: req.params.id },
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
    const record = await prisma.publishRecord.findUnique({ where: { id: req.params.recordId } })
    if (!record) {
      res.status(404).json({ error: 'Record not found' })
      return
    }
    const updated = await prisma.publishRecord.update({
      where: { id: req.params.recordId },
      data: { tags: record.tags.filter(t => t !== req.params.tag) },
    })
    res.json(mapRecord(updated))
  } catch (error) {
    console.error('[DELETE tags]', error)
    res.status(500).json({ error: 'Failed to remove tag' })
  }
})

// POST /api/v1/publish-records/:id/generate-geo — 生成地理位置信息（桩）
router.post('/publish-records/:id/generate-geo', async (_req: Request, res: Response) => {
  markStub(res, 'Geo 生成未实现')
  res.json({ message: 'Geo generation — stub' })
})

// POST /api/v1/publish-records/:id/publish — 发布（桩）
router.post('/publish-records/:id/publish', async (req: Request, res: Response) => {
  try {
    const record = await prisma.publishRecord.update({
      where: { id: req.params.id },
      data: { status: 'published', publishedAt: new Date() },
    })
    res.json(mapRecord(record))
  } catch (error) {
    console.error('[POST publish]', error)
    res.status(500).json({ error: 'Failed to publish' })
  }
})

// POST /api/v1/publish-records/:id/aigc-confirm — AIGC 确认
router.post('/publish-records/:id/aigc-confirm', async (req: Request, res: Response) => {
  try {
    const record = await prisma.publishRecord.update({
      where: { id: req.params.id },
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
      where: { id: req.params.id },
      data: { conversionType: conversion_type },
    })
    res.json(mapRecord(record))
  } catch (error) {
    console.error('[PUT conversion-type]', error)
    res.status(500).json({ error: 'Failed to update conversion type' })
  }
})

export default router
