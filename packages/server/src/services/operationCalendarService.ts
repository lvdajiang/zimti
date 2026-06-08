import { prisma } from '../db.js'
import type { CalendarEventType } from '@zimti/shared'

// 合法事件类型
const VALID_EVENT_TYPES: CalendarEventType[] = ['holiday', 'campaign', 'content_plan', 'reminder']

// 获取某月事件
export async function getEventsByMonth(userId: string, year: number, month: number) {
  // 构建月份范围：月初 ~ 月末
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1) // 下月1号

  const events = await prisma.operationCalendar.findMany({
    where: {
      userId,
      eventDate: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: { eventDate: 'asc' },
  })

  return events
}

// 获取所有事件（分页）
export async function getEvents(
  userId: string,
  page = 1,
  limit = 20,
  eventType?: CalendarEventType,
  refId?: string,
) {
  const ps = Math.min(limit, 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId }
  if (eventType && VALID_EVENT_TYPES.includes(eventType)) {
    where.eventType = eventType
  }
  if (refId) {
    where.refId = refId
  }

  const [items, total] = await Promise.all([
    prisma.operationCalendar.findMany({
      where,
      orderBy: { eventDate: 'desc' },
      skip: (page - 1) * ps,
      take: ps,
    }),
    prisma.operationCalendar.count({ where }),
  ])

  return { items, total }
}

// 创建事件
export async function createEvent(
  userId: string,
  data: {
    eventDate: string
    title: string
    eventType: CalendarEventType
    content?: object
    remindAt?: string
    refId?: string
    refType?: string
  },
) {
  if (!data.title) throw new Error('事件标题不能为空')
  if (!data.eventDate) throw new Error('事件日期不能为空')
  if (!VALID_EVENT_TYPES.includes(data.eventType)) {
    throw new Error(`事件类型必须是: ${VALID_EVENT_TYPES.join(', ')}`)
  }

  const event = await prisma.operationCalendar.create({
    data: {
      userId,
      eventDate: new Date(data.eventDate),
      title: data.title,
      eventType: data.eventType,
      content: (data.content ?? undefined) as any,
      remindAt: data.remindAt ? new Date(data.remindAt) : null,
      refId: data.refId ?? null,
      refType: data.refType ?? null,
    },
  })

  return event
}

// 更新事件
export async function updateEvent(
  userId: string,
  id: string,
  data: {
    eventDate?: string
    title?: string
    eventType?: CalendarEventType
    content?: object
    remindAt?: string
  },
) {
  // 确认事件属于当前用户
  const existing = await prisma.operationCalendar.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) {
    throw new Error('事件不存在')
  }

  if (data.eventType && !VALID_EVENT_TYPES.includes(data.eventType)) {
    throw new Error(`事件类型必须是: ${VALID_EVENT_TYPES.join(', ')}`)
  }

  const event = await prisma.operationCalendar.update({
    where: { id },
    data: {
      ...(data.eventDate && { eventDate: new Date(data.eventDate) }),
      ...(data.title && { title: data.title }),
      ...(data.eventType && { eventType: data.eventType }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.remindAt !== undefined && { remindAt: data.remindAt ? new Date(data.remindAt) : null }),
    },
  })

  return event
}

// 删除事件
export async function deleteEvent(userId: string, id: string) {
  const existing = await prisma.operationCalendar.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) {
    throw new Error('事件不存在')
  }

  await prisma.operationCalendar.delete({ where: { id } })
}

// 旅游行业预设节假日（不存入数据库，仅返回预定义列表）
export function getPresetHolidays(year: number) {
  // 春节日期（基于农历近似，2026/2027）
  const chineseNewYear: Record<number, string> = {
    2025: '2025-01-29',
    2026: '2026-02-17',
    2027: '2027-02-06',
    2028: '2028-01-26',
  }

  // 端午节日期（农历五月初五近似）
  const dragonBoat: Record<number, string> = {
    2025: '2025-05-31',
    2026: '2026-06-19',
    2027: '2027-06-09',
    2028: '2028-05-28',
  }

  // 中秋节日期（农历八月十五近似）
  const midAutumn: Record<number, string> = {
    2025: '2025-10-06',
    2026: '2026-09-25',
    2027: '2027-09-15',
    2028: '2028-10-03',
  }

  const holidays = [
    { event_date: `${year}-01-01`, title: '元旦', event_type: 'holiday' as const, content: { moments_plan: '新年祝福 + 旅游目的地推荐' } },
    { event_date: chineseNewYear[year] ?? `${year}-02-01`, title: '春节', event_type: 'holiday' as const, content: { moments_plan: '春节旅行团余位提醒 / 家庭游套餐推广', campaign_plan: '春节早鸟价' } },
    { event_date: `${year}-04-04`, title: '清明节', event_type: 'holiday' as const, content: { moments_plan: '清明踏青 / 短途游推荐' } },
    { event_date: `${year}-05-01`, title: '五一劳动节', event_type: 'holiday' as const, content: { moments_plan: '五一出游攻略 / 提前预订优惠', campaign_plan: '五一大促' } },
    { event_date: dragonBoat[year] ?? `${year}-06-01`, title: '端午节', event_type: 'holiday' as const, content: { moments_plan: '端午民俗体验 / 短假推荐' } },
    { event_date: `${year}-07-01`, title: '暑假开始', event_type: 'reminder' as const, content: { campaign_plan: '暑假亲子游系列推广', moments_plan: '暑假早鸟价倒计时' } },
    { event_date: `${year}-08-31`, title: '暑假结束', event_type: 'reminder' as const, content: { campaign_plan: '暑期收官促销', moments_plan: '抓住暑假尾巴' } },
    { event_date: midAutumn[year] ?? `${year}-09-15`, title: '中秋节', event_type: 'holiday' as const, content: { moments_plan: '中秋团圆旅行 / 赏月目的地推荐' } },
    { event_date: `${year}-10-01`, title: '国庆节', event_type: 'holiday' as const, content: { moments_plan: '国庆长假攻略 / 热门线路', campaign_plan: '国庆黄金周大促' } },
    { event_date: `${year}-11-11`, title: '双十一', event_type: 'campaign' as const, content: { campaign_plan: '双十一旅游囤货节', moments_plan: '限时抢购 / 尾单特价' } },
    { event_date: `${year}-12-12`, title: '双十二', event_type: 'campaign' as const, content: { campaign_plan: '年终返场优惠', moments_plan: '错峰出行好价' } },
    { event_date: `${year}-12-25`, title: '圣诞节', event_type: 'holiday' as const, content: { moments_plan: '圣诞 + 元旦跨年旅行推荐' } },
    { event_date: `${year}-12-20`, title: '年终促销', event_type: 'campaign' as const, content: { campaign_plan: '年终大促 / 明年早鸟预售', moments_plan: '年度旅行盘点 + 新年展望' } },
  ]

  return holidays
}
