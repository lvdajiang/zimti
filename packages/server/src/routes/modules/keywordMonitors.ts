import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { toInt } from '../../constants.js'

const router: Router = Router()

// GET /api/v1/keyword-monitors — 关键词监控列表
router.get('/keyword-monitors', async (req: Request, res: Response) => {
  try {
    const page = toInt(String(req.query.page), 1)
    const pageSize = Math.min(toInt(String(req.query.page_size), 20), 100)
    const [items, total] = await Promise.all([
      prisma.keywordMonitor.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.keywordMonitor.count(),
    ])
    res.json({
      items: items.map(k => ({
        id: k.id,
        keyword: k.keyword,
        is_active: k.isActive,
        created_at: k.createdAt.toISOString(),
      })),
      total,
    })
  } catch (error) {
    console.error('[GET /keyword-monitors]', error)
    res.status(500).json({ error: 'Failed to load keyword monitors' })
  }
})

// GET /api/v1/keyword-monitors/trends — 趋势数据
router.get('/keyword-monitors/trends', async (req: Request, res: Response) => {
  try {
    const keywordId = req.query.keyword_id ? toInt(String(req.query.keyword_id)) : null
    const days = Math.min(toInt(String(req.query.days), 7), 90)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const where = keywordId
      ? { keywordId, date: { gte: startDate } }
      : { date: { gte: startDate } }

    const trends = await prisma.keywordTrend.findMany({
      where,
      orderBy: { date: 'asc' },
      include: { keywordMonitor: { select: { keyword: true } } },
    })

    const points = trends.map(t => ({
      date: t.date.toISOString().slice(0, 10),
      keyword_id: t.keywordId,
      keyword: t.keywordMonitor.keyword,
      hot_value: t.hotValue,
      platform_rank: t.platformRank,
    }))

    res.json({ points })
  } catch (error) {
    console.error('[GET /keyword-monitors/trends]', error)
    res.status(500).json({ error: 'Failed to load keyword trends' })
  }
})

// POST /api/v1/keyword-monitors — 添加监控
router.post('/keyword-monitors', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.body
    if (!keyword) {
      res.status(400).json({ error: 'keyword is required' })
      return
    }
    const monitor = await prisma.keywordMonitor.create({
      data: { keyword },
    })
    res.json({ id: monitor.id, keyword: monitor.keyword, is_active: monitor.isActive })
  } catch (error) {
    console.error('[POST /keyword-monitors]', error)
    res.status(500).json({ error: 'Failed to create keyword monitor' })
  }
})

// DELETE /api/v1/keyword-monitors/:id — 删除监控
router.delete('/keyword-monitors/:id', async (req: Request, res: Response) => {
  try {
    await prisma.keywordMonitor.delete({ where: { id: toInt(req.params.id) } })
    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /keyword-monitors/:id]', error)
    res.status(500).json({ error: 'Failed to delete keyword monitor' })
  }
})

export default router
