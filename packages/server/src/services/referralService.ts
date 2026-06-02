import { prisma } from '../db.js'
import { createHmac } from 'crypto'

/**
 * 推荐裂变服务
 * 处理推荐记录、推荐码生成、奖励管理
 */

// 创建推荐记录
export async function createReferral(userId: string, data: {
  referrerCustomerId: string
  refereeCustomerId?: string
  sourceType: string  // friend/poster/group_invite
  note?: string
}) {
  // 验证推荐人客户存在
  const referrer = await prisma.customer.findFirst({
    where: { id: data.referrerCustomerId, userId },
  })
  if (!referrer) throw new Error('推荐人客户不存在')

  // 如果指定了被推荐人，验证其存在
  if (data.refereeCustomerId) {
    const referee = await prisma.customer.findFirst({
      where: { id: data.refereeCustomerId, userId },
    })
    if (!referee) throw new Error('被推荐人客户不存在')
  }

  return prisma.referral.create({
    data: {
      userId,
      referrerCustomerId: data.referrerCustomerId,
      refereeCustomerId: data.refereeCustomerId ?? null,
      sourceType: data.sourceType,
      note: data.note ?? null,
    },
  })
}

// 生成推荐码/文本
export async function generateReferralCode(userId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, userId },
  })
  if (!customer) throw new Error('客户不存在')

  // 生成 HMAC-based 推荐码
  const secret = process.env.JWT_SECRET || 'dev-insecure-key'
  const code = createHmac('sha256', secret)
    .update(`${customerId}:${userId}`)
    .digest('base64url')
    .slice(0, 12)

  const referralText = `${customer.name}的专属推荐 | 推荐码: ${code}`
  const shareLink = `https://zimti.app/r/${code}`

  return { code, referralText, shareLink }
}

// 查询推荐列表
export async function listReferrals(userId: string, filters?: {
  status?: string
  sourceType?: string
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId }
  if (filters?.status) where.status = filters.status
  if (filters?.sourceType) where.sourceType = filters.sourceType

  const [items, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        rewards: true,
      },
    }),
    prisma.referral.count({ where }),
  ])

  return { items, total }
}

// 获取推荐统计
export async function getReferralStats(userId: string) {
  const [total, converted, pending] = await Promise.all([
    prisma.referral.count({ where: { userId } }),
    prisma.referral.count({ where: { userId, status: 'converted' } }),
    prisma.referral.count({ where: { userId, status: 'pending' } }),
  ])

  // 按来源类型分组统计
  const bySourceTypeRaw = await prisma.referral.groupBy({
    by: ['sourceType'],
    where: { userId },
    _count: { id: true },
  })
  const bySourceType: Record<string, number> = {}
  for (const row of bySourceTypeRaw) {
    bySourceType[row.sourceType] = row._count.id
  }

  // 推荐排行 Top 5
  const topReferrersRaw = await prisma.referral.groupBy({
    by: ['referrerCustomerId'],
    where: { userId },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  })

  const topReferrers = []
  for (const row of topReferrersRaw) {
    const customer = await prisma.customer.findUnique({
      where: { id: row.referrerCustomerId },
      select: { id: true, name: true },
    })
    if (customer) {
      topReferrers.push({ ...customer, count: row._count.id })
    }
  }

  return { total, converted, pending, bySourceType, topReferrers }
}

// 更新推荐状态
export async function updateReferralStatus(userId: string, id: string, status: string) {
  const referral = await prisma.referral.findFirst({ where: { id, userId } })
  if (!referral) throw new Error('推荐记录不存在')

  return prisma.referral.update({
    where: { id },
    data: { status },
  })
}

// 创建奖励
export async function createReward(userId: string, data: {
  referralId: string
  rewardType: string
  rewardValue: number
}) {
  const referral = await prisma.referral.findFirst({
    where: { id: data.referralId, userId },
  })
  if (!referral) throw new Error('推荐记录不存在')

  return prisma.referralReward.create({
    data: {
      userId,
      referralId: data.referralId,
      rewardType: data.rewardType,
      rewardValue: data.rewardValue,
    },
  })
}

// 查询奖励列表
export async function listRewards(userId: string) {
  return prisma.referralReward.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      referral: {
        select: {
          id: true,
          referrerCustomerId: true,
          sourceType: true,
        },
      },
    },
  })
}

// 更新奖励状态
export async function updateRewardStatus(userId: string, id: string, status: string) {
  const reward = await prisma.referralReward.findFirst({ where: { id, userId } })
  if (!reward) throw new Error('奖励记录不存在')

  return prisma.referralReward.update({
    where: { id },
    data: { status },
  })
}
