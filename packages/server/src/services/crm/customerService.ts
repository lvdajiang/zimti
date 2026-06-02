import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { getAIProvider } from '../ai/provider.js'
import type { IntentLevel, CustomerStage, ContactHealth } from '@zimti/shared'

const SILENT_THRESHOLD_DAYS = 3

// 健康度阈值（天）
const HEALTHY_THRESHOLD = 7
const ATTENTION_THRESHOLD = 30
const AT_RISK_THRESHOLD = 90

// 不需要健康追踪的阶段
const EXCLUDED_HEALTH_STAGES: CustomerStage[] = ['ordered', 'traveling', 'completed', 'repurchase']

export class CustomerService {
  private userId: string

  constructor(userId: string = DEMO_USER_ID) {
    this.userId = userId
  }

  async list(params?: {
    stage?: CustomerStage
    intentLevel?: IntentLevel
    keyword?: string
    tagCategories?: string[]    // 按标签分类筛选
    sourceType?: string         // 按来源类型筛选
    isDeleted?: boolean         // 筛选已删除联系人
    health?: ContactHealth      // 按健康度筛选
    page?: number
    pageSize?: number
  }) {
    const p = params?.page ?? 1
    const ps = Math.min(params?.pageSize ?? 20, 100)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { userId: this.userId }
    if (params?.stage) where.stage = params.stage
    if (params?.intentLevel) where.intentLevel = params.intentLevel
    if (params?.sourceType) where.sourceType = params.sourceType
    if (params?.isDeleted !== undefined) where.isDeleted = params.isDeleted
    if (params?.keyword) {
      where.OR = [
        { name: { contains: params.keyword, mode: 'insensitive' } },
        { aliases: { contains: params.keyword, mode: 'insensitive' } },
        { phone: { contains: params.keyword } },
        { wechat: { contains: params.keyword, mode: 'insensitive' } },
      ]
    }
    // 按标签分类筛选
    if (params?.tagCategories?.length) {
      where.tags = { some: { category: { in: params.tagCategories } } }
    }
    // 按健康度筛选（动态计算）
    if (params?.health) {
      where.stage = { notIn: EXCLUDED_HEALTH_STAGES }
      const now = Date.now()
      const dayMs = 24 * 60 * 60 * 1000
      switch (params.health) {
        case 'healthy':
          where.lastFollowUpAt = { gte: new Date(now - HEALTHY_THRESHOLD * dayMs) }
          break
        case 'attention':
          where.AND = [
            { lastFollowUpAt: { lt: new Date(now - HEALTHY_THRESHOLD * dayMs) } },
            { lastFollowUpAt: { gte: new Date(now - ATTENTION_THRESHOLD * dayMs) } },
          ]
          break
        case 'at_risk':
          where.AND = [
            { lastFollowUpAt: { lt: new Date(now - ATTENTION_THRESHOLD * dayMs) } },
            { lastFollowUpAt: { gte: new Date(now - AT_RISK_THRESHOLD * dayMs) } },
          ]
          break
        case 'lost':
          where.OR = [
            { lastFollowUpAt: { lt: new Date(now - AT_RISK_THRESHOLD * dayMs) } },
            { lastFollowUpAt: null },
          ]
          break
      }
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where, orderBy: { updatedAt: 'desc' }, skip: (p - 1) * ps, take: ps,
        include: { tags: true },
      }),
      prisma.customer.count({ where }),
    ])

    return { items, total }
  }

  async create(data: {
    name: string
    aliases?: string
    phone?: string
    wechat?: string
    sourceType?: string
    sourceRefId?: string
    intentLevel?: IntentLevel
    stage?: CustomerStage
    travelIntent?: unknown
    notes?: string
    tags?: string[]
  }) {
    const customer = await prisma.customer.create({
      data: {
        userId: this.userId,
        name: data.name,
        aliases: data.aliases ?? '',
        phone: data.phone ?? null,
        wechat: data.wechat ?? null,
        sourceType: data.sourceType ?? 'manual',
        sourceRefId: data.sourceRefId ?? null,
        intentLevel: data.intentLevel ?? 'medium',
        stage: data.stage ?? 'new_friend',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        travelIntent: data.travelIntent ? JSON.parse(JSON.stringify(data.travelIntent)) as any : null,
        notes: data.notes ?? null,
      },
    })

    if (data.tags?.length) {
      await prisma.customerTag.createMany({
        data: data.tags.map((tag) => ({ customerId: customer.id, tag })),
        skipDuplicates: true,
      })
    }

    // 记录初始阶段
    await prisma.customerStageLog.create({
      data: { customerId: customer.id, fromStage: '', toStage: customer.stage },
    })

    return customer
  }

  async update(id: string, data: {
    name?: string
    aliases?: string
    phone?: string
    wechat?: string
    intentLevel?: IntentLevel
    travelIntent?: unknown
    notes?: string
  }) {
    return prisma.customer.update({
      where: { id, userId: this.userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.aliases !== undefined && { aliases: data.aliases }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.wechat !== undefined && { wechat: data.wechat }),
        ...(data.intentLevel && { intentLevel: data.intentLevel }),
        ...(data.travelIntent !== undefined && {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          travelIntent: data.travelIntent ? JSON.parse(JSON.stringify(data.travelIntent)) as any : null,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })
  }

  async updateStage(id: string, toStage: CustomerStage, note?: string) {
    const customer = await prisma.customer.findUnique({ where: { id, userId: this.userId } })
    if (!customer) throw new Error('客户不存在')

    const fromStage = customer.stage as CustomerStage
    if (fromStage === toStage) return customer

    await prisma.customerStageLog.create({
      data: { customerId: id, fromStage, toStage, note: note ?? null },
    })

    return prisma.customer.update({
      where: { id },
      data: { stage: toStage },
    })
  }

  async addTags(customerId: string, tags: string[]) {
    await prisma.customerTag.createMany({
      data: tags.map((tag) => ({ customerId, tag })),
      skipDuplicates: true,
    })
  }

  async removeTag(customerId: string, tag: string) {
    await prisma.customerTag.delete({
      where: { customerId_tag: { customerId, tag } },
    })
  }

  async delete(id: string) {
    await prisma.customer.delete({ where: { id, userId: this.userId } })
  }

  async parseVoiceInput(text: string): Promise<{
    name?: string
    travelIntent?: { people?: number; date?: string; destination?: string; budget?: string }
    notes?: string
    tags?: string[]
  }> {
    const ai = getAIProvider()
    if (!ai) return { notes: text }

    const prompt = `从用户语音输入中提取客户信息。用户可能用口语化方式描述。

语音内容：「${text}」

请提取以下信息并返回 JSON：
{
  "name": "客户姓名（如果有）",
  "travel_intent": {
    "people": 人数（数字），
    "date": "出行时间",
    "destination": "目的地",
    "budget": "预算"
  },
  "tags": ["标签1", "标签2"],
  "notes": "关键信息摘要"
}

如果某项信息不存在，对应字段填 null。`

    try {
      const result = await ai.generate(prompt, '你是客户信息提取助手。返回纯 JSON。')
      const parsed = JSON.parse(result)
      return {
        name: parsed.name ?? undefined,
        travelIntent: parsed.travel_intent ?? undefined,
        notes: parsed.notes ?? text,
        tags: parsed.tags ?? undefined,
      }
    } catch {
      return { notes: text }
    }
  }

  async getSilentCustomers(days = SILENT_THRESHOLD_DAYS) {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return prisma.customer.findMany({
      where: {
        userId: this.userId,
        stage: { notIn: ['ordered', 'completed', 'repurchase'] },
        OR: [
          { lastFollowUpAt: { lt: threshold } },
          { lastFollowUpAt: null },
        ],
      },
      orderBy: { lastFollowUpAt: 'asc' },
    })
  }

  async getFunnelStats() {
    const stages = ['new_friend', 'chatting', 'deep_consult', 'hesitating', 'ordered', 'traveling', 'completed', 'repurchase']
    const stats: Record<string, number> = {}
    for (const stage of stages) {
      stats[stage] = await prisma.customer.count({
        where: { userId: this.userId, stage },
      })
    }
    return stats
  }

  /**
   * 获取联系人健康度列表
   * 基于最后跟进时间和阶段计算健康度
   */
  async getContactHealth(): Promise<Array<{
    id: string
    name: string
    stage: string
    lastFollowUpAt: Date | null
    health: ContactHealth
    daysSinceContact: number | null
  }>> {
    const customers = await prisma.customer.findMany({
      where: {
        userId: this.userId,
        isDeleted: false,
        stage: { notIn: EXCLUDED_HEALTH_STAGES },
      },
      select: { id: true, name: true, stage: true, lastFollowUpAt: true },
      orderBy: { lastFollowUpAt: 'asc' },
    })

    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    return customers.map((c) => {
      let health: ContactHealth
      let daysSinceContact: number | null = null

      if (!c.lastFollowUpAt) {
        health = 'lost'
      } else {
        daysSinceContact = Math.floor((now - c.lastFollowUpAt.getTime()) / dayMs)
        if (daysSinceContact <= HEALTHY_THRESHOLD) {
          health = 'healthy'
        } else if (daysSinceContact <= ATTENTION_THRESHOLD) {
          health = 'attention'
        } else if (daysSinceContact <= AT_RISK_THRESHOLD) {
          health = 'at_risk'
        } else {
          health = 'lost'
        }
      }

      return {
        id: c.id,
        name: c.name,
        stage: c.stage,
        lastFollowUpAt: c.lastFollowUpAt,
        health,
        daysSinceContact,
      }
    })
  }

  /**
   * 批量生成唤醒话术
   * 为指定客户生成个性化的 AI 唤醒消息
   */
  async batchGenerateWakeScripts(customerIds: string[]): Promise<Array<{
    customerId: string
    name: string
    script: string
  }>> {
    const customers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
        userId: this.userId,
      },
      select: {
        id: true,
        name: true,
        stage: true,
        lastFollowUpAt: true,
        notes: true,
        tags: { select: { tag: true } },
        travelIntent: true,
      },
    })

    const ai = getAIProvider()
    const results: Array<{ customerId: string; name: string; script: string }> = []

    for (const customer of customers) {
      const daysSilent = customer.lastFollowUpAt
        ? Math.floor((Date.now() - customer.lastFollowUpAt.getTime()) / (24 * 60 * 60 * 1000))
        : 999

      const tagsStr = customer.tags.map((t) => t.tag).join('、') || '无'
      const intentStr = customer.travelIntent
        ? JSON.stringify(customer.travelIntent)
        : '未知'

      const prompt = `你是旅游私域运营专家。请为以下沉默客户生成一条唤醒消息（非营销，要像朋友间的关心）。

客户信息：
- 姓名：${customer.name}
- 当前阶段：${customer.stage}
- 沉默天数：${daysSilent}天
- 标签：${tagsStr}
- 旅行意向：${intentStr}
- 备注：${customer.notes || '无'}

要求：
1. 语气自然亲切，不要像机器人
2. 可以结合旅行意向或者最近的热门目的地
3. 不要直接推销，先引起对话
4. 控制在 2-3 句话，50字以内

只返回唤醒消息文本，不要任何额外内容。`

      try {
        const script = await ai.generate(prompt, '你是私域运营话术专家。')
        results.push({
          customerId: customer.id,
          name: customer.name,
          script: script.trim(),
        })
      } catch {
        results.push({
          customerId: customer.id,
          name: customer.name,
          script: `[生成失败] ${customer.name}，好久不见，最近有出行计划吗？`,
        })
      }
    }

    return results
  }

  /**
   * 批量导入线索
   * 从群聊分析等来源批量创建客户
   */
  async importLeads(leads: Array<{
    name: string
    phone?: string
    wechat?: string
    sourceDetail?: unknown
    travelIntent?: unknown
    tags?: string[]
  }>): Promise<{ count: number }> {
    let count = 0

    for (const lead of leads) {
      const customer = await prisma.customer.create({
        data: {
          userId: this.userId,
          name: lead.name,
          phone: lead.phone ?? null,
          wechat: lead.wechat ?? null,
          sourceType: 'group_chat',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sourceDetail: lead.sourceDetail ? JSON.parse(JSON.stringify(lead.sourceDetail)) as any : null,
          intentLevel: 'medium',
          stage: 'new_friend',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          travelIntent: lead.travelIntent ? JSON.parse(JSON.stringify(lead.travelIntent)) as any : null,
        },
      })

      // 添加标签
      if (lead.tags?.length) {
        await prisma.customerTag.createMany({
          data: lead.tags.map((tag) => ({
            customerId: customer.id,
            tag,
            category: 'interest',
          })),
          skipDuplicates: true,
        })
      }

      // 记录初始阶段
      await prisma.customerStageLog.create({
        data: { customerId: customer.id, fromStage: '', toStage: 'new_friend' },
      })

      count++
    }

    return { count }
  }

  /**
   * 漏斗分析 — 基于 CustomerStageLog 计算转化率与停留时间
   */
  async getFunnelAnalysis(filters?: {
    startDate?: string
    endDate?: string
    sourceType?: string
    tags?: string[]
  }) {
    // 构建客户筛选条件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerWhere: Record<string, any> = { userId: this.userId, isDeleted: false }
    if (filters?.sourceType) customerWhere.sourceType = filters.sourceType
    if (filters?.tags?.length) {
      customerWhere.tags = { some: { tag: { in: filters.tags } } }
    }

    // 日期范围筛选（基于创建时间）
    if (filters?.startDate || filters?.endDate) {
      customerWhere.createdAt = {}
      if (filters.startDate) customerWhere.createdAt.gte = new Date(filters.startDate)
      if (filters.endDate) customerWhere.createdAt.lte = new Date(filters.endDate)
    }

    // 获取客户总数
    const totalCustomers = await prisma.customer.count({ where: customerWhere })

    // 阶段顺序定义
    const stages = ['new_friend', 'chatting', 'deep_consult', 'hesitating', 'ordered', 'traveling', 'completed', 'repurchase'] as const

    // 统计每个阶段的客户数（从客户当前阶段）
    const stageCounts: Record<string, number> = {}
    for (const stage of stages) {
      stageCounts[stage] = await prisma.customer.count({
        where: { ...customerWhere, stage },
      })
    }

    // 获取所有阶段流转日志，用于计算停留时间
    const stageLogs = await prisma.customerStageLog.findMany({
      where: {
        customer: customerWhere,
      },
      orderBy: { createdAt: 'asc' },
    })

    // 按客户分组计算停留时间
    const logsByCustomer: Record<string, typeof stageLogs> = {}
    for (const log of stageLogs) {
      if (!logsByCustomer[log.customerId]) logsByCustomer[log.customerId] = []
      logsByCustomer[log.customerId].push(log)
    }

    const avgDaysByStage: Record<string, number[]> = {}
    for (const logs of Object.values(logsByCustomer)) {
      for (let i = 0; i < logs.length; i++) {
        const from = logs[i]
        const to = logs[i + 1]
        if (!to) continue
        const days = (to.createdAt.getTime() - from.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        if (!avgDaysByStage[from.toStage]) avgDaysByStage[from.toStage] = []
        avgDaysByStage[from.toStage].push(days)
      }
    }

    // 构建结果
    let bottleneck: { stage: string; rate: number } = { stage: '', rate: 1 }

    const result = stages.map((stage, idx) => {
      const count = stageCounts[stage]
      const prevCount = idx === 0 ? totalCustomers : stageCounts[stages[idx - 1]]
      const conversionRate = prevCount > 0 ? Math.round((count / prevCount) * 100) / 100 : 0

      const days = avgDaysByStage[stage] || []
      const avgDays = days.length > 0
        ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10
        : 0

      // 找转化率最低的阶段作为瓶颈
      if (idx > 0 && conversionRate < bottleneck.rate) {
        bottleneck = { stage: stages[idx - 1], rate: conversionRate }
      }

      return { stage, count, conversionRate, avgDays }
    })

    return {
      stages: result,
      totalCustomers,
      bottleneck,
    }
  }
}
