import { prisma } from '../db.js'
import { getAIProvider } from './ai/provider.js'
import type { TouchPointType } from '@zimti/shared'

// 客户分层
type CustomerTier = 'cold' | 'warm' | 'hot' | 'loyal'

// 各分层触达频率（次/周）
const TIER_FREQUENCY: Record<CustomerTier, { min: number; max: number; method: string; label: string }> = {
  cold:  { min: 1, max: 2, method: 'moments',     label: '朋友圈触达' },
  warm:  { min: 2, max: 3, method: 'private_chat', label: '私聊触达' },
  hot:   { min: 3, max: 5, method: 'private_chat', label: '一对一私聊' },
  loyal: { min: 0, max: 1, method: 'moments',      label: '月度优惠触达' },
}

// 合法触达类型
const VALID_TOUCH_TYPES: TouchPointType[] = ['private_chat', 'moments', 'group_post']

// 根据客户阶段和活跃度计算分层
function calculateTier(customer: {
  stage: string
  lastFollowUpAt: Date | null
  createdAt: Date
}): CustomerTier {
  const stage = customer.stage

  // 已下单/完成/复购 → 忠实客户
  if (['ordered', 'traveling', 'completed', 'repurchase'].includes(stage)) {
    return 'loyal'
  }

  // 犹豫阶段（高意向）→ 热客户
  if (stage === 'hesitating') {
    return 'hot'
  }

  // 聊天中/深度咨询 → 暖客户
  if (['chatting', 'deep_consult'].includes(stage)) {
    return 'warm'
  }

  // 新好友/默认 → 冷客户
  return 'cold'
}

// 计算本周已触达次数
async function getWeeklyTouchCount(customerId: string, userId: string): Promise<number> {
  // 本周一 0 点
  const now = new Date()
  const dayOfWeek = now.getDay() || 7 // 周日=7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + 1)
  monday.setHours(0, 0, 0, 0)

  const count = await prisma.touchPoint.count({
    where: {
      customerId,
      userId,
      createdAt: { gte: monday },
    },
  })

  return count
}

// 判断今天是否需要触达
function shouldReachToday(tier: CustomerTier, weeklyCount: number): boolean {
  const freq = TIER_FREQUENCY[tier]
  // loyal: 每月1次，用 weeklyCount==0 简化判断（实际应按月计算）
  if (tier === 'loyal') {
    // 忠实客户每周概率 ≈ 1/4（月均1次）
    return weeklyCount === 0 && new Date().getDay() === 1 // 周一触发
  }
  // 按比例分摊：将每周频次均摊到各天
  // 例如 cold 1-2次/周 → 每天概率 1~2/7
  const todayIndex = (new Date().getDay() || 7) - 1 // 0=周一, 6=周日
  const daysNeeded = Math.max(freq.min, 1)
  // 简化：如果本周还没达到最低频次，且今天是均匀分布的那几天之一
  if (weeklyCount < freq.max) {
    // 每隔几天触达一次
    const interval = Math.floor(7 / freq.max)
    return todayIndex % interval === 0
  }
  return false
}

// 获取今日触达任务
export async function getTodayTasks(userId: string) {
  // 1. 获取所有活跃客户
  const customers = await prisma.customer.findMany({
    where: {
      userId,
      isDeleted: false,
      stage: { notIn: ['completed'] }, // 已完成无活动的排除
    },
    include: { tags: true },
    orderBy: { lastFollowUpAt: 'asc' }, // 最久未联系的排前面
  })

  const tasks: Array<{
    customer: typeof customers[number]
    tier: CustomerTier
    tierLabel: string
    suggestedMethod: string
    weeklyTouchCount: number
    suggestedMessage: string
  }> = []

  const ai = getAIProvider()

  // 2. 逐客户计算分层和触达需求
  for (const customer of customers) {
    const tier = calculateTier(customer)
    const weeklyCount = await getWeeklyTouchCount(customer.id, userId)

    if (!shouldReachToday(tier, weeklyCount)) continue

    const tierConfig = TIER_FREQUENCY[tier]

    // 3. 生成建议消息（AI）
    let suggestedMessage = ''
    if (ai) {
      try {
        const tagNames = customer.tags.map((t) => t.tag).join('、')
        const prompt = `为一位旅游行业客户生成一条触达消息。

客户信息：
- 姓名：${customer.name}
- 阶段：${customer.stage}
- 分层：${tierConfig.label}
- 标签：${tagNames || '无'}
- 备注：${customer.notes || '无'}
- 上次跟进：${customer.lastFollowUpAt ? new Date(customer.lastFollowUpAt).toLocaleDateString('zh-CN') : '从未'}

触达方式：${tierConfig.method === 'private_chat' ? '私聊' : '朋友圈'}

要求：
1. 自然、真诚，避免营销味
2. 结合旅游场景
3. 不超过100字
4. 不要使用"不可错过"、"赶紧"等紧迫性表达

返回 JSON：{ "message": "建议消息内容" }`

        const result = await ai.generate(prompt, '你是私域运营专家。返回纯 JSON。')
        const parsed = JSON.parse(result)
        suggestedMessage = parsed.message ?? ''
      } catch {
        suggestedMessage = ''
      }
    }

    tasks.push({
      customer,
      tier,
      tierLabel: tierConfig.label,
      suggestedMethod: tierConfig.method,
      weeklyTouchCount: weeklyCount,
      suggestedMessage,
    })
  }

  return tasks
}

// 创建触达记录
export async function createTouchPoint(
  userId: string,
  data: {
    customerId: string
    touchType: TouchPointType
    contentSummary: string
    response?: string
  },
) {
  if (!data.customerId) throw new Error('客户 ID 不能为空')
  if (!data.contentSummary) throw new Error('触达摘要不能为空')
  if (!VALID_TOUCH_TYPES.includes(data.touchType)) {
    throw new Error(`触达类型必须是: ${VALID_TOUCH_TYPES.join(', ')}`)
  }

  // 验证客户存在且属于当前用户
  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
  })
  if (!customer || customer.userId !== userId) {
    throw new Error('客户不存在')
  }

  const touchPoint = await prisma.$transaction(async (tx) => {
    const tp = await tx.touchPoint.create({
      data: {
        userId,
        customerId: data.customerId,
        touchType: data.touchType,
        contentSummary: data.contentSummary,
        response: data.response ?? null,
      },
    })

    // 更新客户最后跟进时间
    await tx.customer.update({
      where: { id: data.customerId },
      data: { lastFollowUpAt: new Date() },
    })

    return tp
  })

  return touchPoint
}

// 获取某客户的触达历史
export async function getCustomerHistory(
  userId: string,
  customerId: string,
  page = 1,
  limit = 20,
) {
  const ps = Math.min(limit, 100)

  const [items, total] = await Promise.all([
    prisma.touchPoint.findMany({
      where: { userId, customerId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * ps,
      take: ps,
    }),
    prisma.touchPoint.count({ where: { userId, customerId } }),
  ])

  return { items, total }
}

// 列出所有触达记录（分页）
export async function listTouchPoints(
  userId: string,
  page = 1,
  limit = 20,
  touchType?: TouchPointType,
  customerId?: string,
) {
  const ps = Math.min(limit, 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId }
  if (touchType && VALID_TOUCH_TYPES.includes(touchType)) {
    where.touchType = touchType
  }
  if (customerId) {
    where.customerId = customerId
  }

  const [items, total] = await Promise.all([
    prisma.touchPoint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * ps,
      take: ps,
      include: {
        customer: { select: { name: true, stage: true } },
      },
    }),
    prisma.touchPoint.count({ where }),
  ])

  return { items, total }
}
