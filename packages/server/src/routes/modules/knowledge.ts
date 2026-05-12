import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str, toInt } from '../../constants.js'

const router: Router = Router()

// GET /api/v1/knowledge — 列表
router.get('/knowledge', async (req: Request, res: Response) => {
  const category = str(req.query.category)
  const keyword = str(req.query.keyword)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 20), 100)
  const skip = (p - 1) * ps

  const where: Record<string, unknown> = { userId: DEMO_USER_ID }
  if (category && category !== 'all') where.category = category
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: 'insensitive' } },
      { content: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: ps,
    }),
    prisma.knowledgeItem.count({ where }),
  ])

  res.json({
    items: items.map((k) => ({
      id: k.id,
      title: k.title,
      content: k.content,
      source: k.source,
      category: k.category,
      tags: k.tags,
      created_at: k.createdAt.toISOString(),
      updated_at: k.updatedAt.toISOString(),
    })),
    total,
  })
})

// POST /api/v1/knowledge — 创建
router.post('/knowledge', async (req: Request, res: Response) => {
  const { title, content, source, category, tags } = req.body
  if (!title || !content) {
    res.status(400).json({ error: 'title and content are required' })
    return
  }
  const item = await prisma.knowledgeItem.create({
    data: {
      userId: DEMO_USER_ID,
      title: String(title).slice(0, 200),
      content: String(content),
      source: String(source ?? 'manual'),
      category: String(category ?? 'other'),
      tags: Array.isArray(tags) ? tags.map(String) : [],
    },
  })
  res.status(201).json({ id: item.id })
})

// PUT /api/v1/knowledge/:id — 更新
router.put('/knowledge/:id', async (req: Request, res: Response) => {
  const { title, content, source, category, tags } = req.body
  const item = await prisma.knowledgeItem.update({
    where: { id: str(req.params.id), userId: DEMO_USER_ID },
    data: {
      ...(title !== undefined && { title: String(title).slice(0, 200) }),
      ...(content !== undefined && { content: String(content) }),
      ...(source !== undefined && { source: String(source) }),
      ...(category !== undefined && { category: String(category) }),
      ...(tags !== undefined && { tags: Array.isArray(tags) ? tags.map(String) : [] }),
    },
  })
  res.json({ id: item.id })
})

// DELETE /api/v1/knowledge/:id — 删除
router.delete('/knowledge/:id', async (req: Request, res: Response) => {
  await prisma.knowledgeItem.delete({ where: { id: str(req.params.id), userId: DEMO_USER_ID } })
  res.json({ success: true })
})

export default router
