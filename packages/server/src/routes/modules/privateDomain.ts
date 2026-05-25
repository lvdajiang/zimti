import { Router } from 'express'
import { prisma } from '../../db.js'
import { DEMO_USER_ID, str } from '../../constants.js'
import { getAIProvider } from '../../services/ai/provider.js'
import { BrandMemoryService } from '../../services/aiHub/brandMemory.js'
import type { Request, Response } from 'express'
import type { GroupType } from '@zimti/shared'

const VALID_GROUP_TYPES: GroupType[] = ['intent', 'traveling', 'loyalty']

const router: Router = Router()

// GET /api/v1/private-domain/moments/daily — 获取今日朋友圈
router.get('/private-domain/moments/daily', async (_req: Request, res: Response) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await prisma.momentsContent.findMany({
    where: { userId: DEMO_USER_ID, createdAt: { gte: today } },
    orderBy: { createdAt: 'asc' },
  })

  if (existing.length > 0) {
    res.json({ items: existing })
    return
  }

  // 生成今日朋友圈（3专业+2生活+1转化）
  const ai = getAIProvider()
  if (!ai) { res.json({ items: [] }); return }

  const brandMemory = new BrandMemoryService(DEMO_USER_ID)
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

    const items = []
    for (const item of parsed.items) {
      const created = await prisma.momentsContent.create({
        data: {
          userId: DEMO_USER_ID,
          contentType: item.content_type ?? 'professional',
          content: item.content ?? '',
          imageSuggestion: item.image_suggestion ?? null,
        },
      })
      items.push(created)
    }
    res.json({ items })
  } catch {
    res.json({ items: [] })
  }
})

// POST /api/v1/private-domain/moments/:id/sent — 标记已发送
router.post('/private-domain/moments/:id/sent', async (req: Request, res: Response) => {
  const item = await prisma.momentsContent.update({
    where: { id: str(req.params.id), userId: DEMO_USER_ID },
    data: { sentAt: new Date() },
  })
  res.json({ id: item.id, sent_at: item.sentAt?.toISOString() })
})

// POST /api/v1/private-domain/moments/:id/engagement — 录入互动数据
router.post('/private-domain/moments/:id/engagement', async (req: Request, res: Response) => {
  const { likes, comments, screenshot } = req.body
  const item = await prisma.momentsContent.update({
    where: { id: str(req.params.id), userId: DEMO_USER_ID },
    data: { engagementData: { likes: likes ?? 0, comments: comments ?? 0, screenshot: screenshot ?? null } },
  })
  res.json({ id: item.id })
})

// GET /api/v1/private-domain/group-content — 获取群运营内容
router.get('/private-domain/group-content', async (req: Request, res: Response) => {
  const groupType = str(req.query.group_type) as GroupType | ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: DEMO_USER_ID }
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
        userId: DEMO_USER_ID,
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
