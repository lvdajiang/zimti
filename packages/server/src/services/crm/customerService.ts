import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { getAIProvider } from '../ai/provider.js'
import type { IntentLevel, CustomerStage } from '@zimti/shared'

const SILENT_THRESHOLD_DAYS = 3

export class CustomerService {
  private userId: string

  constructor(userId: string = DEMO_USER_ID) {
    this.userId = userId
  }

  async list(params?: {
    stage?: CustomerStage
    intentLevel?: IntentLevel
    keyword?: string
    page?: number
    pageSize?: number
  }) {
    const p = params?.page ?? 1
    const ps = Math.min(params?.pageSize ?? 20, 100)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { userId: this.userId }
    if (params?.stage) where.stage = params.stage
    if (params?.intentLevel) where.intentLevel = params.intentLevel
    if (params?.keyword) {
      where.OR = [
        { name: { contains: params.keyword, mode: 'insensitive' } },
        { aliases: { contains: params.keyword, mode: 'insensitive' } },
        { phone: { contains: params.keyword } },
        { wechat: { contains: params.keyword, mode: 'insensitive' } },
      ]
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
}
