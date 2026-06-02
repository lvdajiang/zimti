import { Router } from 'express'
import { prisma } from '../../db.js'
import { getUserId, str, toInt } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { CustomerService } from '../../services/crm/customerService.js'
import type { Request, Response } from 'express'
import type { IntentLevel, CustomerStage, ContactHealth } from '@zimti/shared'

const router: Router = Router()
router.use(optionalAuth)

// GET /api/v1/crm/customers — 客户列表
router.get('/crm/customers', async (req: Request, res: Response) => {
  const service = new CustomerService(getUserId(req as any))
  const tagCategoriesStr = str(req.query.tag_categories)
  const result = await service.list({
    stage: str(req.query.stage) as CustomerStage || undefined,
    intentLevel: str(req.query.intent_level) as IntentLevel || undefined,
    keyword: str(req.query.keyword) || undefined,
    tagCategories: tagCategoriesStr ? tagCategoriesStr.split(',') : undefined,
    sourceType: str(req.query.source_type) || undefined,
    isDeleted: req.query.is_deleted === 'true' ? true : req.query.is_deleted === 'false' ? false : undefined,
    health: str(req.query.health) as ContactHealth || undefined,
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

// --- 联系人健康度 ---

// GET /api/v1/crm/contact-health — 获取联系人健康度列表
router.get('/crm/contact-health', async (req: Request, res: Response) => {
  try {
    const service = new CustomerService(getUserId(req as any))
    let items = await service.getContactHealth()

    // 支持按健康度筛选
    const healthFilter = str(req.query.health) as ContactHealth
    if (healthFilter) {
      items = items.filter((item) => item.health === healthFilter)
    }

    res.json({ items })
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取健康度失败'
    res.status(500).json({ error: message })
  }
})

// --- 批量唤醒话术 ---

// POST /api/v1/crm/batch-wake-scripts — 批量生成唤醒话术
router.post('/crm/batch-wake-scripts', async (req: Request, res: Response) => {
  try {
    const { customer_ids } = req.body
    if (!Array.isArray(customer_ids) || customer_ids.length === 0) {
      res.status(400).json({ error: 'customer_ids 不能为空数组' })
      return
    }
    if (customer_ids.length > 20) {
      res.status(400).json({ error: '单次最多 20 个客户' })
      return
    }

    const service = new CustomerService(getUserId(req as any))
    const scripts = await service.batchGenerateWakeScripts(customer_ids)
    res.json({ items: scripts })
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成唤醒话术失败'
    res.status(500).json({ error: message })
  }
})

// --- 批量导入线索 ---

// POST /api/v1/crm/import-leads — 批量导入线索
router.post('/crm/import-leads', async (req: Request, res: Response) => {
  try {
    const { leads } = req.body
    if (!Array.isArray(leads) || leads.length === 0) {
      res.status(400).json({ error: 'leads 不能为空数组' })
      return
    }
    // 校验每条数据必须有 name
    for (let i = 0; i < leads.length; i++) {
      if (!leads[i].name) {
        res.status(400).json({ error: `第 ${i + 1} 条数据缺少 name` })
        return
      }
    }

    const service = new CustomerService(getUserId(req as any))
    const result = await service.importLeads(leads)
    res.status(201).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入线索失败'
    res.status(500).json({ error: message })
  }
})

// --- 漏斗分析 ---

// GET /api/v1/crm/funnel-analysis — 漏斗分析（转化率+停留时间）
router.get('/crm/funnel-analysis', async (req: Request, res: Response) => {
  try {
    const service = new CustomerService(getUserId(req as any))
    const result = await service.getFunnelAnalysis({
      startDate: str(req.query.start_date) || undefined,
      endDate: str(req.query.end_date) || undefined,
      sourceType: str(req.query.source_type) || undefined,
      tags: req.query.tags ? String(req.query.tags).split(',') : undefined,
    })
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '漏斗分析失败'
    res.status(500).json({ error: message })
  }
})

export default router
