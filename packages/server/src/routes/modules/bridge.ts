/**
 * 桥接路由 — Zimti与智派的数据桥接API
 *
 * 端点：
 * - POST /api/v1/bridge/quotation   — 创建报价
 * - GET  /api/v1/bridge/resources   — 查询智派资源（代理）
 * - GET  /api/v1/bridge/products    — 查询智派产品（代理）
 * - GET  /api/v1/bridge/prices      — 查询季节价格（代理）
 * - POST /api/v1/bridge/webhook/zhipai — 接收智派webhook推送
 */

import { Router } from 'express'
import { getUserId, str, toInt } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { createQuotationFromCustomer } from '../../bridge/quotation.js'
import { searchResources, getSeasonPrices, searchTemplateResources } from '../../bridge/productProxy.js'
import { zhiPaiClient } from '../../bridge/client.js'
import { touristToCustomer } from '../../bridge/mappings.js'
import { logger } from '../../logger.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import type { Request, Response } from 'express'
import { createHmac } from 'crypto'

const router: Router = Router()
router.use(optionalAuth)

// ============ 报价 ============

// POST /api/v1/bridge/quotation — 为CRM客户创建智派报价
router.post('/bridge/quotation', async (req: Request, res: Response) => {
  try {
    const { customer_id, destination, days, people_count, grade, tour_date } = req.body

    if (!customer_id) { res.status(400).json({ error: 'customer_id 必填' }); return }
    if (!destination) { res.status(400).json({ error: 'destination 必填' }); return }
    if (!days || days < 1) { res.status(400).json({ error: 'days 必须大于0' }); return }
    if (!people_count || people_count < 1) { res.status(400).json({ error: 'people_count 必须大于0' }); return }

    if (!zhiPaiClient.isEnabled()) {
      res.status(503).json({ error: '智派桥接未启用' })
      return
    }

    const result = await createQuotationFromCustomer({
      customer_id,
      destination,
      days: Number(days),
      people_count: Number(people_count),
      grade: grade || '4钻',
      tour_date: tour_date || '',
    })

    // 报价创建成功后，自动推CRM阶段到"犹豫对比"
    try {
      const service = await import('../../services/crm/customerService.js')
      const crm = new service.CustomerService(getUserId(req as any))
      await crm.updateStage(customer_id, 'hesitating', `已生成报价 ${result.quotation_id}`)
    } catch {
      // 阶段推送失败不影响报价结果
    }

    res.status(201).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : '报价创建失败'
    logger.error(`桥接报价失败: ${message}`)
    res.status(500).json({ error: message })
  }
})

// ============ 资源代理 ============

// GET /api/v1/bridge/resources — 查询智派资源
router.get('/bridge/resources', async (req: Request, res: Response) => {
  try {
    if (!zhiPaiClient.isEnabled()) {
      res.status(503).json({ error: '智派桥接未启用' })
      return
    }
    const result = await searchResources(
      str(req.query.keyword) || undefined,
      str(req.query.type) || undefined,
      str(req.query.grade) || undefined,
      toInt(req.query.limit, 50),
    )
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : '资源查询失败'
    res.status(500).json({ error: message })
  }
})

// GET /api/v1/bridge/products — 搜索模板资源（用于报价匹配）
router.get('/bridge/products', async (req: Request, res: Response) => {
  try {
    if (!zhiPaiClient.isEnabled()) {
      res.status(503).json({ error: '智派桥接未启用' })
      return
    }
    const keyword = str(req.query.keyword)
    if (!keyword) { res.status(400).json({ error: 'keyword 必填' }); return }

    const items = await searchTemplateResources(
      keyword,
      str(req.query.type) || undefined,
      str(req.query.grade) || undefined,
    )
    res.json({ items })
  } catch (err) {
    const message = err instanceof Error ? err.message : '产品查询失败'
    res.status(500).json({ error: message })
  }
})

// GET /api/v1/bridge/prices — 查询资源季节价格
router.get('/bridge/prices', async (req: Request, res: Response) => {
  try {
    if (!zhiPaiClient.isEnabled()) {
      res.status(503).json({ error: '智派桥接未启用' })
      return
    }
    const resourceId = str(req.query.resource_id)
    if (!resourceId) { res.status(400).json({ error: 'resource_id 必填' }); return }

    const items = await getSeasonPrices(resourceId)
    res.json({ items })
  } catch (err) {
    const message = err instanceof Error ? err.message : '价格查询失败'
    res.status(500).json({ error: message })
  }
})

// ============ 消息推送（Zimti → 智派小程序） ============

// POST /api/v1/bridge/push-message — 将 AI 话术推送到智派小程序用户消息中心
router.post('/bridge/push-message', async (req: Request, res: Response) => {
  try {
    const { customer_id, title, content, msg_type } = req.body
    if (!customer_id || !title || !content) {
      res.status(400).json({ error: 'customer_id, title, content 必填' })
      return
    }
    if (!zhiPaiClient.isEnabled()) {
      res.status(503).json({ error: '智派桥接未启用' })
      return
    }

    // 通过 sourceRefId 找到智派用户 ID
    const customer = await prisma.customer.findUnique({ where: { id: customer_id } })
    if (!customer) {
      res.status(404).json({ error: '客户不存在' })
      return
    }

    // sourceRefId 格式: "zhipai:userId" 或 "zhipai:touristId"
    const zhiPaiUserId = customer.sourceRefId?.replace('zhipai:', '')
    if (!zhiPaiUserId || isNaN(Number(zhiPaiUserId))) {
      res.status(400).json({ error: '客户未关联智派用户（sourceRefId 缺失或格式不对）' })
      return
    }

    const result = await zhiPaiClient.post<{ success: boolean; message_id: number }>(
      '/fleet/messages/push',
      {
        user_id: parseInt(zhiPaiUserId, 10),
        title,
        content,
        msg_type: msg_type || 'sales',
        icon: '💬',
      },
    )

    logger.info(`桥接消息推送：客户${customer_id} → 智派用户${zhiPaiUserId}`)
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : '消息推送失败'
    logger.error(`桥接消息推送失败: ${message}`)
    res.status(500).json({ error: message })
  }
})

// ============ 知识库（供智派 AI 文档生成器调用） ============

// GET /api/v1/bridge/knowledge — 返回品牌知识库内容（供智派注入 AI 文档生成）
router.get('/bridge/knowledge', async (req: Request, res: Response) => {
  try {
    const category = str(req.query.category)
    const limit = Math.min(toInt(req.query.limit, 20), 50)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { isActive: true }
    if (category) where.category = category

    const items = await prisma.brandKnowledge.findMany({
      where,
      orderBy: { sortOrder: 'desc' },
      take: limit,
      select: { title: true, content: true, category: true, tags: true },
    })

    // 按 category 分组，格式化为可注入 AI prompt 的文本
    const BRAND_KNOWLEDGE_CATEGORY_LABELS: Record<string, string> = {
      brand_intro: '产品介绍', route: '路线特色', service: '服务承诺',
      case: '案例故事', faq: '常见问答', industry: '行业知识',
    }
    const grouped: Record<string, typeof items> = {}
    for (const item of items) {
      const cat = item.category as string
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    }

    const lines: string[] = []
    for (const [cat, catItems] of Object.entries(grouped)) {
      lines.push(`## ${BRAND_KNOWLEDGE_CATEGORY_LABELS[cat] ?? cat}`)
      for (const item of catItems) {
        lines.push(`### ${item.title}`)
        lines.push(item.content)
      }
    }

    res.json({ knowledge: lines.join('\n'), count: items.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : '知识查询失败'
    logger.error(`桥接知识查询失败: ${message}`)
    res.status(500).json({ error: message })
  }
})

// ============ Webhook接收 ============

// POST /api/v1/bridge/webhook/zhipai — 接收智派状态变更推送
router.post('/bridge/webhook/zhipai', async (req: Request, res: Response) => {
  try {
    // 1. 验证签名
    const secret = process.env.ZHIPAI_WEBHOOK_SECRET
    if (secret) {
      const signature = req.headers['x-zhipai-signature'] as string
      if (!signature) {
        res.status(401).json({ error: '缺少签名' })
        return
      }
      const body = JSON.stringify(req.body)
      const expected = createHmac('sha256', secret).update(body).digest('hex')
      if (signature !== expected) {
        res.status(401).json({ error: '签名验证失败' })
        return
      }
    }

    // 2. 处理事件
    const { event, ref_id, data } = req.body as {
      event: string
      ref_id: string
      data: Record<string, unknown>
    }

    logger.info(`桥接Webhook：收到事件 ${event}，ref_id=${ref_id}`)

    // 根据事件类型更新CRM客户阶段
    switch (event) {
      case 'quotation_confirmed': {
        // 报价成交 → 推到"成交下单"
        const customerName = String(data.customer_name ?? '')
        const customerPhone = String(data.customer_phone ?? '')
        if (customerName || customerPhone) {
          const customer = await findCustomerByNameOrPhone(customerName, customerPhone)
          if (customer) {
            const service = await import('../../services/crm/customerService.js')
            const crm = new service.CustomerService(customer.userId)
            await crm.updateStage(customer.id, 'ordered', `报价${ref_id}已成交`)
            logger.info(`桥接Webhook：客户${customer.id}阶段推到"成交下单"`)
          }
        }
        break
      }
      case 'order_created': {
        // 订单创建 → 记录订单号到客户备注
        const customerName = String(data.main_guest_name ?? '')
        const customerPhone = String(data.main_guest_phone ?? '')
        if (customerName || customerPhone) {
          const customer = await findCustomerByNameOrPhone(customerName, customerPhone)
          if (customer) {
            await prisma.customer.update({
              where: { id: customer.id },
              data: {
                notes: [customer.notes, `订单号: ${ref_id}`].filter(Boolean).join('\n'),
              },
            })
            logger.info(`桥接Webhook：客户${customer.id}记录订单号${ref_id}`)
          }
        }
        break
      }
      case 'tour_started': {
        // 出行开始 → 推到"出行中"
        const customerName = String(data.main_guest_name ?? '')
        const customerPhone = String(data.main_guest_phone ?? '')
        if (customerName || customerPhone) {
          const customer = await findCustomerByNameOrPhone(customerName, customerPhone)
          if (customer) {
            const service = await import('../../services/crm/customerService.js')
            const crm = new service.CustomerService(customer.userId)
            await crm.updateStage(customer.id, 'traveling', '行程已开始')
            logger.info(`桥接Webhook：客户${customer.id}阶段推到"出行中"`)
          }
        }
        break
      }
      case 'tour_completed': {
        // 行程完成 → 推到"出行后"
        const customerName = String(data.main_guest_name ?? '')
        const customerPhone = String(data.main_guest_phone ?? '')
        if (customerName || customerPhone) {
          const customer = await findCustomerByNameOrPhone(customerName, customerPhone)
          if (customer) {
            const service = await import('../../services/crm/customerService.js')
            const crm = new service.CustomerService(customer.userId)
            await crm.updateStage(customer.id, 'completed', '行程已完成')
            logger.info(`桥接Webhook：客户${customer.id}阶段推到"出行后"`)
          }
        }
        break
      }
      case 'tourist_registered': {
        // 小程序游客注册 → 创建 CRM 客户卡片
        const touristName = String(data.name ?? '小程序用户')
        const touristPhone = String(data.phone ?? '')
        const touristSource = String(data.source ?? 'miniprogram')

        // 幂等：按 sourceRefId 查重
        const existing = await findCustomerBySourceRef(`zhipai:${ref_id}`)
        if (!existing) {
          try {
            const mapped = touristToCustomer({
              name: touristName,
              phone: touristPhone,
              wx_openid: data.wx_openid ? String(data.wx_openid) : undefined,
              source: touristSource,
              partner_agency_id: data.partner_agency_id ? String(data.partner_agency_id) : undefined,
            })
            const service = await import('../../services/crm/customerService.js')
            const crm = new service.CustomerService(DEMO_USER_ID)
            await crm.create({
              name: mapped.name,
              phone: mapped.phone || undefined,
              wechat: mapped.wechat || undefined,
              sourceType: mapped.sourceType as 'miniprogram',
              sourceRefId: `zhipai:${ref_id}`,
              intentLevel: 'low',
              stage: 'new_friend',
              notes: mapped.notes || undefined,
            })
            logger.info(`桥接Webhook：小程序游客${ref_id}已创建CRM客户卡`)
          } catch (err) {
            logger.error(`桥接Webhook：创建客户失败 ${err instanceof Error ? err.message : err}`)
          }
        } else {
          logger.info(`桥接Webhook：游客${ref_id}已存在CRM客户${existing.id}，跳过`)
        }
        break
      }
      case 'tourist_inquiry': {
        // 小程序询价 → 更新客户标签和意向
        const inqName = String(data.name ?? '')
        const inqPhone = String(data.phone ?? '')
        const inqTopic = String(data.inquiry_topic ?? '')

        if (inqName || inqPhone) {
          const customer = await findCustomerByNameOrPhone(inqName, inqPhone)
          if (customer) {
            const updates: Record<string, unknown> = {}
            // 提升意向
            if (customer.intentLevel === 'low') {
              updates.intentLevel = 'medium'
            }
            // 更新备注
            if (inqTopic) {
              updates.notes = [customer.notes, `询价: ${inqTopic}`].filter(Boolean).join('\n')
            }
            if (Object.keys(updates).length > 0) {
              await prisma.customer.update({
                where: { id: customer.id },
                data: updates,
              })
              logger.info(`桥接Webhook：客户${customer.id}收到小程序询价更新`)
            }
          }
        }
        break
      }
      default:
        logger.info(`桥接Webhook：未处理的事件类型 ${event}`)
    }

    res.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'webhook处理失败'
    logger.error(`桥接Webhook错误: ${message}`)
    res.status(500).json({ error: message })
  }
})

/** 通过姓名或手机号查找Zimti客户 */
async function findCustomerByNameOrPhone(name: string, phone: string) {
  if (!name && !phone) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any>[] = []
  if (name) where.push({ name: { contains: name, mode: 'insensitive' } })
  if (phone) where.push({ phone: { contains: phone } })

  const customers = await prisma.customer.findMany({
    where: { OR: where, isDeleted: false },
    take: 1,
  })
  return customers[0] || null
}

/** 通过 sourceRefId 查找 Zimti 客户（幂等查重） */
async function findCustomerBySourceRef(sourceRefId: string) {
  const customers = await prisma.customer.findMany({
    where: { sourceRefId, isDeleted: false },
    take: 1,
  })
  return customers[0] || null
}

export default router
