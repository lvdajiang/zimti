import { Router } from 'express'
import { prisma } from '../../db.js'
import { getUserId, str } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { getAIProvider } from '../../services/ai/provider.js'
import { BrandMemoryService } from '../../services/aiHub/brandMemory.js'
import type { Request, Response } from 'express'
import type { GroupType } from '@zimti/shared'

const VALID_GROUP_TYPES: GroupType[] = ['intent', 'traveling', 'loyalty']

const router: Router = Router()
router.use(optionalAuth)

// GET /api/v1/private-domain/moments/daily — 获取今日朋友圈
router.get('/private-domain/moments/daily', async (req: Request, res: Response) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.momentsContent.findMany({
    where: { userId: getUserId(req as any), createdAt: { gte: today } },
    orderBy: { createdAt: 'asc' },
  })

  if (existing.length > 0) {
    res.json({ items: existing })
    return
  }

  // 生成今日朋友圈（3专业+2生活+1转化）
  const ai = getAIProvider()
  if (!ai) { res.json({ items: [] }); return }

  const brandMemory = new BrandMemoryService(getUserId(req as any))
  const context = await brandMemory.getContext()

  const prompt = `为自媒体账号生成今日 6 条朋友圈内容（3-2-1 节奏）。
${context || '（品牌画像尚未建立）'}

返回 JSON：
{
  "items": [
    {"content_type": "professional", "content": "专业干货内容", "image_suggestion": "配图建议"},
    {"content_type": "professional", "content": "...", "image_suggestion": "..."},
    {"content_type": "professional", "content": "...", "image_suggestion": "..."},
    {"content_type": "life", "content": "生活/人味内容", "image_suggestion": "..."},
    {"content_type": "life", "content": "...", "image_suggestion": "..."},
    {"content_type": "conversion", "content": "软性转化内容", "image_suggestion": "..."}
  ]
}`

  try {
    const result = await ai.generate(prompt, '你是朋友圈内容专家。返回纯 JSON。')
    const parsed = JSON.parse(result)

    if (!Array.isArray(parsed.items)) { res.json({ items: [] }); return }

    const userId = getUserId(req as any)
    await prisma.momentsContent.createMany({
      data: (parsed.items as Array<{ content_type?: string; content?: string; image_suggestion?: string }>).map((item) => ({
        userId,
        contentType: item.content_type ?? 'professional',
        content: item.content ?? '',
        imageSuggestion: item.image_suggestion ?? null,
      })),
    })
    const created = await prisma.momentsContent.findMany({
      where: { userId, createdAt: { gte: today } },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ items: created })
  } catch {
    res.json({ items: [] })
  }
})

// POST /api/v1/private-domain/moments/:id/sent — 标记已发送
router.post('/private-domain/moments/:id/sent', async (req: Request, res: Response) => {
  const item = await prisma.momentsContent.update({
    where: { id: str(req.params.id), userId: getUserId(req as any) },
    data: { sentAt: new Date(), status: 'sent' },
  })
  res.json({ id: item.id, sent_at: item.sentAt?.toISOString() })
})

// GET /api/v1/private-domain/moments/calendar — 按月获取排期
router.get('/private-domain/moments/calendar', async (req: Request, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear()
  const month = Number(req.query.month) || new Date().getMonth() + 1
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  const items = await prisma.momentsContent.findMany({
    where: {
      userId: getUserId(req as any),
      OR: [
        { createdAt: { gte: start, lt: end } },
        { scheduledAt: { gte: start, lt: end } },
        { sentAt: { gte: start, lt: end } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ items })
})

// PUT /api/v1/private-domain/moments/:id/schedule — 更新排期
router.put('/private-domain/moments/:id/schedule', async (req: Request, res: Response) => {
  const { scheduled_at, status } = req.body
  const data: Record<string, unknown> = {}
  if (scheduled_at !== undefined) data.scheduledAt = scheduled_at ? new Date(scheduled_at) : null
  if (status !== undefined) data.status = status

  const item = await prisma.momentsContent.update({
    where: { id: str(req.params.id), userId: getUserId(req as any) },
    data,
  })
  res.json({ id: item.id })
})

// POST /api/v1/private-domain/moments/:id/engagement — 录入互动数据
router.post('/private-domain/moments/:id/engagement', async (req: Request, res: Response) => {
  const { likes, comments, screenshot } = req.body
  const item = await prisma.momentsContent.update({
    where: { id: str(req.params.id), userId: getUserId(req as any) },
    data: { engagementData: { likes: likes ?? 0, comments: comments ?? 0, screenshot: screenshot ?? null } },
  })
  res.json({ id: item.id })
})

// GET /api/v1/private-domain/group-content — 获取群运营内容
router.get('/private-domain/group-content', async (req: Request, res: Response) => {
  const groupType = str(req.query.group_type) as GroupType | ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (groupType && VALID_GROUP_TYPES.includes(groupType)) where.groupType = groupType

  const items = await prisma.groupContent.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 20,
  })
  res.json({ items })
})

// POST /api/v1/private-domain/group-content — 生成群内容
router.post('/private-domain/group-content', async (req: Request, res: Response) => {
  const { group_type } = req.body
  if (!group_type || !VALID_GROUP_TYPES.includes(group_type)) {
    res.status(400).json({ error: `group_type must be one of: ${VALID_GROUP_TYPES.join(', ')}` })
    return
  }

  const ai = getAIProvider()
  if (!ai) { res.status(503).json({ error: 'AI 服务不可用' }); return }

  const typeLabels: Record<string, string> = { intent: '意向客户', traveling: '已出行客户', loyalty: '老客复购' }
  const prompt = `为微信"${typeLabels[group_type] ?? group_type}"群生成一条今日运营内容。
内容要自然、有温度，适合微信群发送。包含标题和正文。
返回 JSON：{ "title": "标题", "content": "正文内容" }`

  try {
    const result = await ai.generate(prompt, '你是微信社群运营专家。返回纯 JSON。')
    const parsed = JSON.parse(result)
    const item = await prisma.groupContent.create({
      data: {
        userId: getUserId(req as any),
        groupType: group_type,
        title: parsed.title ?? null,
        content: parsed.content ?? '',
      },
    })
    res.status(201).json({ id: item.id })
  } catch {
    res.status(502).json({ error: '生成失败' })
  }
})

export default router
