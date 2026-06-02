import { prisma } from '../db.js'
import type { CustomerStage } from '@zimti/shared'

// 品牌记忆预设
const BRAND_MEMORIES = [
  // profile 类（4条）
  { category: 'profile', key: 'account_name', value: '旅行达人小王', source: 'interview' as const },
  { category: 'profile', key: 'domain', value: '旅行自媒体', source: 'interview' as const },
  { category: 'profile', key: 'style', value: '轻松活泼、真实记录、注重体验感', source: 'interview' as const },
  { category: 'profile', key: 'audience', value: '25-35岁爱旅行的年轻人，注重性价比和独特体验', source: 'interview' as const },
  // style 类（4条）
  { category: 'style', key: 'language_style', value: '口语化，善用感叹词，避免书面表达', source: 'interview' as const },
  { category: 'style', key: 'rhythm', value: '开头3秒抓眼球，中间节奏紧凑，结尾留悬念', source: 'interview' as const },
  { category: 'style', key: 'camera', value: '多用第一人称视角、手持跟拍、航拍大景', source: 'interview' as const },
  { category: 'style', key: 'slogan', value: '跟我走，不踩雷', source: 'interview' as const },
]

// 演示客户（8个阶段各1个）
const DEMO_CUSTOMERS: Array<{
  name: string
  stage: CustomerStage
  intentLevel: 'high' | 'medium' | 'low'
  phone: string
  travelIntent: { people: string; date: string; destination: string; budget: string }
}> = [
  { name: '张三', stage: 'new_friend', intentLevel: 'low', phone: '138****1001', travelIntent: { people: '未定', date: '未定', destination: '未定', budget: '未定' } },
  { name: '李姐', stage: 'chatting', intentLevel: 'medium', phone: '139****1002', travelIntent: { people: '2人', date: '暑期', destination: '云南', budget: '5000/人' } },
  { name: '王总', stage: 'deep_consult', intentLevel: 'high', phone: '137****1003', travelIntent: { people: '一家四口', date: '7月中', destination: '日本大阪', budget: '2万/人' } },
  { name: '赵哥', stage: 'hesitating', intentLevel: 'medium', phone: '136****1004', travelIntent: { people: '情侣2人', date: '8月初', destination: '巴厘岛 vs 普吉岛', budget: '8000/人' } },
  { name: '孙女士', stage: 'ordered', intentLevel: 'high', phone: '135****1005', travelIntent: { people: '3闺蜜', date: '6月底', destination: '三亚', budget: '6000/人' } },
  { name: '刘哥一家', stage: 'traveling', intentLevel: 'high', phone: '158****1006', travelIntent: { people: '5人团', date: '出行中', destination: '新疆', budget: '1.5万/人' } },
  { name: '周姐', stage: 'completed', intentLevel: 'medium', phone: '150****1007', travelIntent: { people: '2人', date: '5月初已出行', destination: '成都', budget: '4000/人' } },
  { name: '老陈', stage: 'repurchase', intentLevel: 'high', phone: '133****1008', travelIntent: { people: '公司团建15人', date: '9月', destination: '青海湖', budget: '待定' } },
]

// 话术模板（每个阶段1条）
const CHAT_TEMPLATES: Array<{ stage: CustomerStage; category: string; content: string }> = [
  { stage: 'new_friend', category: 'greeting', content: '你好呀！我是做定制旅行的，看你朋友圈也喜欢到处跑 😊 有什么想去的地方可以随时找我聊聊~' },
  { stage: 'chatting', category: 'probing', content: '你这次出行大概几个人呢？有没有比较偏好的目的地类型，比如海岛、古镇、自然风光？' },
  { stage: 'deep_consult', category: 'closing', content: '根据你的需求，我做了两个方案对比：\n方案A（大阪5日）：机酒+签证+环球影城，人均 ¥18,800\n方案B（东京+箱根6日）：温泉体验+富士山，人均 ¥21,500\n你看哪个更合适？' },
  { stage: 'hesitating', category: 'objection', content: '理解你的顾虑！其实巴厘岛和普吉岛各有优势——巴厘岛更适合蜜月/打卡，普吉岛性价比更高、水上项目更丰富。要不我给你发两个行程的详细对比？' },
  { stage: 'ordered', category: 'closing', content: '好的！合同和付款链接已经发你微信了。接下来我会建一个专属服务群，有任何问题随时群里说~ 出发前7天会提醒你准备签证材料' },
  { stage: 'traveling', category: 'general', content: '到啦！今天第一站推荐你去 XXX，记得上午去人少。如果遇到任何问题随时微信我，24小时在线 😄' },
  { stage: 'completed', category: 'greeting', content: '旅行回来了吧！感觉怎么样？有没有特别喜欢的或者觉得可以改进的地方？你的真实反馈对我特别重要~' },
  { stage: 'repurchase', category: 'probing', content: '上次去成都玩得开心吧！听说你们公司9月有团建需求？我可以做一份专属方案，团建和自由行结合的那种，要不要聊聊？' },
]

export async function initDemoData(userId: string): Promise<{ brandMemories: number; customers: number; chatTemplates: number }> {
  const [brandMemories, customers, chatTemplates] = await Promise.all([
    seedBrandMemories(userId),
    seedCustomers(userId),
    seedChatTemplates(userId),
  ])
  return { brandMemories, customers, chatTemplates }
}

async function seedBrandMemories(userId: string): Promise<number> {
  const existing = await prisma.brandMemory.findMany({
    where: { userId, category: { in: ['profile', 'style'] } },
    select: { key: true, category: true },
  })
  const existingKeys = new Set(existing.map((m) => `${m.category}:${m.key}`))

  const toCreate = BRAND_MEMORIES.filter((m) => !existingKeys.has(`${m.category}:${m.key}`))
  if (toCreate.length === 0) return 0

  await prisma.brandMemory.createMany({
    data: toCreate.map((m) => ({ userId, ...m })),
  })
  return toCreate.length
}

async function seedCustomers(userId: string): Promise<number> {
  const existing = await prisma.customer.findMany({
    where: { userId },
    select: { name: true },
  })
  const existingNames = new Set(existing.map((c) => c.name))

  const toCreate = DEMO_CUSTOMERS.filter((c) => !existingNames.has(c.name))
  if (toCreate.length === 0) return 0

  const results = await prisma.$transaction(
    toCreate.map((c) =>
      prisma.customer.create({
        data: {
          userId,
          name: c.name,
          phone: c.phone,
          stage: c.stage,
          intentLevel: c.intentLevel,
          travelIntent: c.travelIntent,
          notes: '演示数据',
          lastFollowUpAt: new Date(),
        },
      })
    )
  )
  return results.length
}

async function seedChatTemplates(userId: string): Promise<number> {
  const existing = await prisma.chatTemplate.findMany({
    where: { userId, category: { in: CHAT_TEMPLATES.map((t) => t.category) } },
    select: { stage: true, category: true },
  })
  const existingKeys = new Set(existing.map((t) => `${t.stage}:${t.category}`))

  const toCreate = CHAT_TEMPLATES.filter((t) => !existingKeys.has(`${t.stage}:${t.category}`))
  if (toCreate.length === 0) return 0

  await prisma.chatTemplate.createMany({
    data: toCreate.map((t) => ({ userId, ...t })),
  })
  return toCreate.length
}
