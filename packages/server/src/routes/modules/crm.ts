import { Router } from 'express'
import { prisma } from '../../db.js'
import { getUserId, str, toInt } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { CustomerService } from '../../services/crm/customerService.js'
import type { Request, Response } from 'express'
import type { IntentLevel, CustomerStage } from '@zimti/shared'

const router: Router = Router()
router.use(optionalAuth)

// GET /api/v1/crm/customers — 客户列表
router.get('/crm/customers', async (req: Request, res: Response) => {
  const service = new CustomerService(getUserId(req as any))
  const result = await service.list({
    stage: str(req.query.stage) as CustomerStage || undefined,
    intentLevel: str(req.query.intent_level) as IntentLevel || undefined,
    keyword: str(req.query.keyword) || undefined,
    page: toInt(req.query.page, 1),
    pageSize: toInt(req.query.page_size, 20),
  })
  res.json(result)
})

// POST /api/v1/crm/customers — 创建客户
router.post('/crm/customers', async (req: Request, res: Response) => {
  const { name, aliases, phone, wechat, source_type, source_ref_id, intent_level, stage, travel_intent, notes, tags } = req.body
  if (!name) { res.status(400).json({ error: 'name is required' }); return }

  const service = new CustomerService(getUserId(req as any))
  const customer = await service.create({
    name, aliases, phone, wechat,
    sourceType: source_type, sourceRefId: source_ref_id,
    intentLevel: intent_level, stage, travelIntent: travel_intent, notes, tags,
  })
  res.status(201).json({ id: customer.id })
})

// PUT /api/v1/crm/customers/:id — 更新客户
router.put('/crm/customers/:id', async (req: Request, res: Response) => {
  const { name, aliases, phone, wechat, intent_level, travel_intent, notes } = req.body
  const service = new CustomerService(getUserId(req as any))
  const customer = await service.update(str(req.params.id), {
    name, aliases, phone, wechat,
    intentLevel: intent_level, travelIntent: travel_intent, notes,
  })
  res.json({ id: customer.id })
})

// DELETE /api/v1/crm/customers/:id — 删除客户
router.delete('/crm/customers/:id', async (req: Request, res: Response) => {
  const service = new CustomerService(getUserId(req as any))
  await service.delete(str(req.params.id))
  res.json({ success: true })
})

// PUT /api/v1/crm/customers/:id/stage — 更新客户阶段
router.put('/crm/customers/:id/stage', async (req: Request, res: Response) => {
  const { stage, note } = req.body
  if (!stage) { res.status(400).json({ error: 'stage is required' }); return }
  const service = new CustomerService(getUserId(req as any))
  const customer = await service.updateStage(str(req.params.id), stage, note)
  res.json({ id: customer.id, stage: customer.stage })
})

// POST /api/v1/crm/customers/:id/tags — 添加标签
router.post('/crm/customers/:id/tags', async (req: Request, res: Response) => {
  const { tags } = req.body
  if (!Array.isArray(tags)) { res.status(400).json({ error: 'tags must be array' }); return }
  const service = new CustomerService(getUserId(req as any))
  await service.addTags(str(req.params.id), tags)
  res.json({ success: true })
})

// DELETE /api/v1/crm/customers/:id/tags — 删除标签
router.delete('/crm/customers/:id/tags', async (req: Request, res: Response) => {
  const { tag } = req.body
  if (!tag) { res.status(400).json({ error: 'tag is required' }); return }
  const service = new CustomerService(getUserId(req as any))
  await service.removeTag(str(req.params.id), String(tag))
  res.json({ success: true })
})

// POST /api/v1/crm/customers/voice-input — 语音录入
router.post('/crm/customers/voice-input', async (req: Request, res: Response) => {
  const { text } = req.body
  if (!text) { res.status(400).json({ error: 'text is required' }); return }
  const service = new CustomerService(getUserId(req as any))
  const parsed = await service.parseVoiceInput(String(text))
  res.json(parsed)
})

// GET /api/v1/crm/silent-customers — 沉默客户列表
router.get('/crm/silent-customers', async (req: Request, res: Response) => {
  const service = new CustomerService(getUserId(req as any))
  const customers = await service.getSilentCustomers()
  res.json({ items: customers })
})

// GET /api/v1/crm/funnel-stats — 漏斗统计
router.get('/crm/funnel-stats', async (req: Request, res: Response) => {
  const service = new CustomerService(getUserId(req as any))
  const stats = await service.getFunnelStats()
  res.json(stats)
})

// --- 话术模板 ---

// GET /api/v1/crm/chat-templates — 话术列表
router.get('/crm/chat-templates', async (req: Request, res: Response) => {
  const stage = str(req.query.stage)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (stage) where.stage = stage

  const items = await prisma.chatTemplate.findMany({ where, orderBy: { effectivenessScore: 'desc' } })
  res.json({ items })
})

// POST /api/v1/crm/chat-templates/generate — AI 生成话术
router.post('/crm/chat-templates/generate', async (req: Request, res: Response) => {
  const { stage, customer_context } = req.body
  if (!stage) { res.status(400).json({ error: 'stage is required' }); return }

  const { getAIProvider } = await import('../../services/ai/provider.js')
  const ai = getAIProvider()
  if (!ai) { res.status(503).json({ error: 'AI 服务不可用' }); return }

  const prompt = `为客户阶段"${stage}"生成 2-3 条私聊回复话术。
${customer_context ? `客户背景：${customer_context}` : ''}

返回 JSON：{ "templates": [{ "content": "话术内容", "category": "greeting|probing|closing|objection|general" }] }`

  try {
    const result = await ai.generate(prompt, '你是私域转化专家。返回纯 JSON。')
    const parsed = JSON.parse(result)
    res.json(parsed)
  } catch { res.status(502).json({ error: 'AI 生成失败' }) }
})

// POST /api/v1/crm/chat-templates — 创建话术
router.post('/crm/chat-templates', async (req: Request, res: Response) => {
  const { stage, category, content } = req.body
  if (!stage || !content) { res.status(400).json({ error: 'stage and content are required' }); return }

  const item = await prisma.chatTemplate.create({
    data: { userId: getUserId(req as any), stage, category: category ?? 'general', content },
  })
  res.status(201).json({ id: item.id })
})

// --- 跟进提醒 ---

// GET /api/v1/crm/follow-up-reminders — 提醒列表
router.get('/crm/follow-up-reminders', async (req: Request, res: Response) => {
  const items = await prisma.followUpReminder.findMany({
    where: { userId: getUserId(req as any), status: 'pending' },
    orderBy: { remindAt: 'asc' },
    include: { customer: { select: { name: true } } },
  })
  res.json({ items })
})

// POST /api/v1/crm/follow-up-reminders — 创建提醒
router.post('/crm/follow-up-reminders', async (req: Request, res: Response) => {
  const { customer_id, remind_at, message } = req.body
  if (!customer_id || !remind_at) { res.status(400).json({ error: 'customer_id and remind_at are required' }); return }

  const item = await prisma.followUpReminder.create({
    data: { userId: getUserId(req as any), customerId: customer_id, remindAt: new Date(remind_at), message },
  })
  res.status(201).json({ id: item.id })
})

export default router
