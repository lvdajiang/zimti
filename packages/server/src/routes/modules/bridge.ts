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
import { zhiPaiCircuitBreaker } from '../../bridge/circuitBreaker.js'
import { touristToCustomer } from '../../bridge/mappings.js'
import { recordWebhookEvent, markEventProcessed, markEventFailed } from '../../bridge/eventLog.js'
import { getDeadLetterItems, retryDeadLetter } from '../../bridge/retryQueue.js'
import { reconcile } from '../../bridge/reconciliation.js'
import { logger } from '../../logger.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import type { Request, Response, NextFunction } from 'express'
import { createHmac } from 'crypto'

const router: Router = Router()
router.use(optionalAuth)

/**
 * 捕获原始 body 的中间件 — webhook 签名验证需要原始 body bytes
 * 必须在 express.json() 之前挂载（但本 router 已在 json() 之后），
 * 所以用 req.body 重序列化时保持确定性 key 顺序。
 */
function verifyWebhookSignature(req: Request, secret: string): boolean {
  const signature = req.headers['x-zhipai-signature'] as string
  if (!signature) return false
  // 使用确定性 JSON 序列化（sorted keys + 无空格）
  const body = JSON.stringify(req.body, Object.keys(req.body).sort())
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return signature === expected
}

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
    } catch (err) {
      logger.warn(`桥接报价: CRM阶段推送失败 ${err instanceof Error ? err.message : err}`)
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
  let logId = ''  // 提前声明，确保 catch 块安全访问
  try {
    // 1. 验证签名
    const secret = process.env.ZHIPAI_WEBHOOK_SECRET
    if (secret && !verifyWebhookSignature(req, secret)) {
      res.status(401).json({ error: '签名验证失败' })
      return
    }

    // 2. 处理事件
    const { event, ref_id, data, event_id } = req.body as {
      event: string
      ref_id: string
      data: Record<string, unknown>
      event_id?: string
      timestamp?: string
    }

    logger.info(`桥接Webhook：收到事件 ${event}，ref_id=${ref_id}${event_id ? `，event_id=${event_id}` : ''}`)

    // 2.1 事件去重
    const { shouldProcess, logId } = await recordWebhookEvent({
      eventId: event_id,
      eventType: event,
      refId: ref_id,
      payload: req.body,
      signature: req.headers['x-zhipai-signature'] as string | undefined,
    })

    if (!shouldProcess) {
      res.json({ ok: true, deduplicated: true })
      return
    }

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
    await markEventProcessed(logId).catch((e) => logger.warn(`标记事件已处理失败: ${e instanceof Error ? e.message : e}`))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'webhook处理失败'
    logger.error(`桥接Webhook错误: ${message}`)
    if (logId) {
      await markEventFailed(logId, message).catch((e) => logger.warn(`标记事件失败: ${e instanceof Error ? e.message : e}`))
    }
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

// ============ 对账 ============

// POST /api/v1/bridge/reconcile — 手动触发对账
router.post('/bridge/reconcile', async (_req: Request, res: Response) => {
  try {
    const report = await reconcile()
    res.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : '对账失败'
    logger.error(`桥接对账失败: ${message}`)
    res.status(500).json({ error: message })
  }
})

// ============ 健康检查 ============

// GET /api/v1/bridge/health — 桥接健康状态
router.get('/bridge/health', async (_req: Request, res: Response) => {
  try {
    const circuitInfo = zhiPaiCircuitBreaker.getInfo()
    const enabled = zhiPaiClient.isEnabled()

    // 查询最近一次同步时间
    const lastSync = await prisma.bridgeSyncLog.findFirst({
      where: { status: 'success' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    const status = !enabled ? 'disabled'
      : circuitInfo.state === 'OPEN' ? 'down'
      : circuitInfo.state === 'HALF_OPEN' ? 'degraded'
      : 'healthy'

    // 实际检测数据库连接
    let dbConnected = false
    try {
      await prisma.$queryRaw`SELECT 1`
      dbConnected = true
    } catch {
      dbConnected = false
    }

    res.json({
      status,
      enabled,
      circuit_breaker: circuitInfo,
      last_sync: lastSync?.createdAt ?? null,
      db_connected: dbConnected,
    })
  } catch (err) {
    res.json({
      status: 'degraded',
      enabled: zhiPaiClient.isEnabled(),
      db_connected: false,
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
})

// ============ 死信队列 ============

// GET /api/v1/bridge/dead-letter — 列出死信记录
router.get('/bridge/dead-letter', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(toInt(req.query.limit, 50), 200)
    const offset = toInt(req.query.offset, 0)
    const result = await getDeadLetterItems(limit, offset)
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询死信队列失败'
    res.status(500).json({ error: message })
  }
})

// POST /api/v1/bridge/dead-letter/:id/retry — 手动重试死信
router.post('/bridge/dead-letter/:id/retry', async (req: Request, res: Response) => {
  try {
    const ok = await retryDeadLetter(req.params.id)
    if (!ok) {
      res.status(404).json({ error: '死信记录不存在或状态不对' })
      return
    }
    res.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '重试失败'
    res.status(500).json({ error: message })
  }
})

// ============ 统计 ============

// GET /api/v1/bridge/stats — 桥接统计
router.get('/bridge/stats', async (_req: Request, res: Response) => {
  try {
    const [successCount, failedCount, deadCount, pendingRetry] = await Promise.all([
      prisma.bridgeSyncLog.count({ where: { status: 'success' } }),
      prisma.bridgeSyncLog.count({ where: { status: 'failed' } }),
      prisma.bridgeRetryQueue.count({ where: { status: 'dead' } }),
      prisma.bridgeRetryQueue.count({ where: { status: 'pending' } }),
    ])

    res.json({
      sync: { success: successCount, failed: failedCount },
      retry: { pending: pendingRetry, dead: deadCount },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '统计查询失败'
    res.status(500).json({ error: message })
  }
})

export default router
