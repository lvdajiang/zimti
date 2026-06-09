/**
 * 违禁词管理 API
 *
 * GET    /prohibited-words          列表
 * POST   /prohibited-words          添加
 * POST   /prohibited-words/import   批量导入
 * PUT    /prohibited-words/:id      更新
 * DELETE /prohibited-words/:id      删除
 */

import { Router } from 'express'
import { prisma } from '../../db.js'
import { optionalAuth } from '../../services/auth/authService.js'
import type { Request, Response } from 'express'

const router: Router = Router()
router.use(optionalAuth)

// ── 列表 ──────────────────────────────────────────────
router.get('/prohibited-words', async (_req: Request, res: Response) => {
  const { category, platform, keyword } = _req.query as Record<string, string | undefined>

  const where: any = { isActive: true }
  if (category) where.category = category
  if (platform) where.platform = { in: [platform, 'all'] }
  if (keyword) where.word = { contains: keyword, mode: 'insensitive' }

  const list = await prisma.prohibitedWord.findMany({
    where,
    orderBy: { category: 'asc' },
    take: 200,
  })
  res.json(list)
})

// ── 添加 ──────────────────────────────────────────────
router.post('/prohibited-words', async (req: Request, res: Response) => {
  const { word, category, platform, replacement } = req.body
  if (!word || !category || !platform) {
    res.status(400).json({ error: 'word, category, platform 为必填' })
    return
  }

  const created = await prisma.prohibitedWord.create({
    data: { word, category, platform, replacement: replacement ?? null },
  })
  res.status(201).json(created)
})

// ── 批量导入 ──────────────────────────────────────────
router.post('/prohibited-words/import', async (req: Request, res: Response) => {
  const { words } = req.body as {
    words: Array<{ word: string; category: string; platform: string; replacement?: string }>
  }

  if (!Array.isArray(words) || words.length === 0) {
    res.status(400).json({ error: 'words 数组不能为空' })
    return
  }

  let created = 0
  let skipped = 0

  for (const w of words) {
    try {
      await prisma.prohibitedWord.create({
        data: {
          word: w.word,
          category: w.category ?? 'high_risk',
          platform: w.platform ?? 'all',
          replacement: w.replacement ?? null,
        },
      })
      created++
    } catch (error: any) {
      if (error.code === 'P2002') {
        skipped++ // 唯一约束冲突，跳过
      } else {
        throw error
      }
    }
  }

  res.json({ created, skipped, total: words.length })
})

// ── 更新 ──────────────────────────────────────────────
router.put('/prohibited-words/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { word, category, platform, replacement } = req.body

  const updated = await prisma.prohibitedWord.update({
    where: { id },
    data: {
      ...(word !== undefined && { word }),
      ...(category !== undefined && { category }),
      ...(platform !== undefined && { platform }),
      ...(replacement !== undefined && { replacement }),
    },
  })
  res.json(updated)
})

// ── 删除 ──────────────────────────────────────────────
router.delete('/prohibited-words/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  await prisma.prohibitedWord.delete({ where: { id } })
  res.status(204).send()
})

export default router
