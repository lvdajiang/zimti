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

// ============================================================
// GEO 种子问题（50 条新疆旅行意图问题）
// ============================================================

const GEO_SEED_QUESTIONS: Array<{
  question: string
  category: 'route' | 'food' | 'season' | 'budget' | 'tips' | 'general'
  intent_type: 'informational' | 'navigational' | 'transactional' | 'commercial'
  tags: string[]
}> = [
  // --- 路线规划（10 条）---
  { question: '新疆旅游走北疆环线还是南疆环线好？', category: 'route', intent_type: 'informational', tags: ['北疆', '南疆', '环线'] },
  { question: '伊犁草原哪几个最值得去？那拉提、喀拉峻、巴音布鲁克怎么选？', category: 'route', intent_type: 'informational', tags: ['伊犁', '草原', '那拉提'] },
  { question: '新疆自驾游走独库公路需要几天？沿途有哪些必停景点？', category: 'route', intent_type: 'informational', tags: ['独库公路', '自驾', '景点'] },
  { question: '第一次去新疆，7天行程怎么安排最合理？', category: 'route', intent_type: 'informational', tags: ['行程', '7天', '新手'] },
  { question: '南疆自驾从喀什出发，推荐走哪条线路？', category: 'route', intent_type: 'informational', tags: ['南疆', '喀什', '自驾'] },
  { question: '新疆北疆10天深度游路线推荐，不想太赶', category: 'route', intent_type: 'informational', tags: ['北疆', '10天', '深度游'] },
  { question: '从乌鲁木齐到禾木怎么走最快？需要多久？', category: 'route', intent_type: 'navigational', tags: ['乌鲁木齐', '禾木', '交通'] },
  { question: '独库公路开放时间是什么时候？冬季能走吗？', category: 'route', intent_type: 'informational', tags: ['独库公路', '开放时间', '冬季'] },
  { question: '赛里木湖环湖一圈要多久？有哪些拍照机位？', category: 'route', intent_type: 'informational', tags: ['赛里木湖', '环湖', '拍照'] },
  { question: '喀纳斯和禾木安排几天比较合适？住哪里最方便？', category: 'route', intent_type: 'commercial', tags: ['喀纳斯', '禾木', '住宿'] },

  // --- 美食推荐（8 条）---
  { question: '新疆有哪些必吃的当地美食？', category: 'food', intent_type: 'informational', tags: ['美食', '必吃', '推荐'] },
  { question: '乌鲁木齐哪里能吃到最正宗的大盘鸡？', category: 'food', intent_type: 'navigational', tags: ['乌鲁木齐', '大盘鸡', '餐厅'] },
  { question: '新疆烤羊肉串和内地的有什么不同？怎么烤才好吃？', category: 'food', intent_type: 'informational', tags: ['烤肉', '羊肉串', '做法'] },
  { question: '去新疆一定要尝的抓饭在哪里能吃到？', category: 'food', intent_type: 'navigational', tags: ['抓饭', '餐厅', '推荐'] },
  { question: '新疆的馕有多少种？哪些最值得尝试？', category: 'food', intent_type: 'informational', tags: ['馕', '种类', '美食'] },
  { question: '在新疆能喝到什么特色饮品？奶茶和酸奶推荐吗？', category: 'food', intent_type: 'informational', tags: ['饮品', '奶茶', '酸奶'] },
  { question: '喀什老城附近有什么特色小吃？', category: 'food', intent_type: 'navigational', tags: ['喀什', '小吃', '老城'] },
  { question: '新疆水果哪几个月最好吃？有什么季节限定？', category: 'food', intent_type: 'informational', tags: ['水果', '季节', '限定'] },

  // --- 季节时令（8 条）---
  { question: '新疆旅游几月份去最好？不同季节有什么区别？', category: 'season', intent_type: 'informational', tags: ['最佳时间', '季节', '对比'] },
  { question: '6月去新疆看薰衣草，伊犁哪个花海最壮观？', category: 'season', intent_type: 'informational', tags: ['6月', '薰衣草', '伊犁'] },
  { question: '9月去新疆看胡杨林，哪里最美？最佳观赏期是什么时候？', category: 'season', intent_type: 'informational', tags: ['9月', '胡杨林', '秋季'] },
  { question: '冬天去新疆滑雪，阿勒泰和丝绸之路度假区哪个更适合新手？', category: 'season', intent_type: 'commercial', tags: ['冬季', '滑雪', '阿勒泰'] },
  { question: '7-8月新疆热吗？需要带什么衣服？', category: 'season', intent_type: 'informational', tags: ['夏季', '穿衣', '气温'] },
  { question: '新疆杏花什么时候开？哪里可以看杏花？', category: 'season', intent_type: 'informational', tags: ['杏花', '春季', '赏花'] },
  { question: '国庆节去新疆人多吗？推荐去哪里避开人流？', category: 'season', intent_type: 'informational', tags: ['国庆', '人少', '小众'] },
  { question: '新疆的日出日落时间跟内地差多少？需要调整作息吗？', category: 'season', intent_type: 'informational', tags: ['时差', '日出', '作息'] },

  // --- 预算费用（8 条）---
  { question: '去新疆旅游一趟大概要花多少钱？', category: 'budget', intent_type: 'informational', tags: ['费用', '预算', '总花销'] },
  { question: '新疆自驾游每天花销大概多少？油费和过路费高吗？', category: 'budget', intent_type: 'informational', tags: ['自驾', '油费', '花销'] },
  { question: '新疆住宿贵吗？推荐性价比高的酒店或民宿', category: 'budget', intent_type: 'commercial', tags: ['住宿', '酒店', '性价比'] },
  { question: '跟团去新疆和自由行哪个更划算？', category: 'budget', intent_type: 'commercial', tags: ['跟团', '自由行', '对比'] },
  { question: '新疆旅游有哪些隐形消费需要注意？', category: 'budget', intent_type: 'informational', tags: ['隐形消费', '陷阱', '注意'] },
  { question: '独库公路沿途住宿怎么选？有平价选择吗？', category: 'budget', intent_type: 'commercial', tags: ['独库公路', '住宿', '平价'] },
  { question: '新疆包车一天多少钱？找什么样的司机靠谱？', category: 'budget', intent_type: 'transactional', tags: ['包车', '价格', '司机'] },
  { question: '在新疆吃饭贵不贵？人均一天餐饮预算多少？', category: 'budget', intent_type: 'informational', tags: ['餐饮', '人均', '预算'] },

  // --- 实用攻略（10 条）---
  { question: '去新疆需要办边防证吗？哪些地方需要？', category: 'tips', intent_type: 'informational', tags: ['边防证', '证件', '攻略'] },
  { question: '新疆旅游会有高原反应吗？哪些地方海拔高？', category: 'tips', intent_type: 'informational', tags: ['高原反应', '海拔', '健康'] },
  { question: '在新疆租车自驾需要什么条件？哪家租车公司靠谱？', category: 'tips', intent_type: 'transactional', tags: ['租车', '自驾', '条件'] },
  { question: '新疆安全吗？一个人去旅行需要注意什么？', category: 'tips', intent_type: 'informational', tags: ['安全', '独自旅行', '注意'] },
  { question: '去新疆要带什么必备物品？有什么容易忽略的？', category: 'tips', intent_type: 'informational', tags: ['行李清单', '必备', '攻略'] },
  { question: '新疆网络信号好吗？需要买当地电话卡吗？', category: 'tips', intent_type: 'informational', tags: ['网络', '信号', '电话卡'] },
  { question: '新疆有哪些民俗禁忌需要了解？', category: 'tips', intent_type: 'informational', tags: ['民俗', '禁忌', '文化'] },
  { question: '新疆的安检严格吗？坐飞机火车需要提前多久到？', category: 'tips', intent_type: 'informational', tags: ['安检', '交通', '时间'] },
  { question: '新疆旅游用什么导航软件最好？Google Maps 好用吗？', category: 'tips', intent_type: 'navigational', tags: ['导航', '地图', '软件'] },
  { question: '新疆买东西能讲价吗？大巴扎购物有什么建议？', category: 'tips', intent_type: 'informational', tags: ['购物', '讲价', '大巴扎'] },

  // --- 综合（6 条）---
  { question: '新疆和西藏哪个更值得去？各有什么特色？', category: 'general', intent_type: 'commercial', tags: ['新疆', '西藏', '对比'] },
  { question: '新疆有哪些小众景点值得去？不想去人挤人的地方', category: 'general', intent_type: 'informational', tags: ['小众', '秘境', '推荐'] },
  { question: '新疆旅游带无人机航拍可以吗？哪些景区禁飞？', category: 'general', intent_type: 'informational', tags: ['无人机', '航拍', '规定'] },
  { question: '新疆自由行不会开车怎么办？有公共交通吗？', category: 'general', intent_type: 'informational', tags: ['公共交通', '不开车', '出行'] },
  { question: '新疆值得去第二次吗？每次去有什么不同体验？', category: 'general', intent_type: 'informational', tags: ['重游', '体验', '推荐'] },
  { question: '新疆旅行最适合拍什么风格的照片？有什么拍摄技巧？', category: 'general', intent_type: 'informational', tags: ['摄影', '风格', '技巧'] },
]

export async function seedGeoQuestions(userId: string): Promise<number> {
  const existing = await prisma.geoQuestion.count({ where: { userId } })
  if (existing > 0) return 0 // 已有种子数据，跳过

  await prisma.geoQuestion.createMany({
    data: GEO_SEED_QUESTIONS.map((q) => ({
      userId,
      question: q.question,
      category: q.category,
      intentType: q.intent_type,
      aiGenerated: false,
      source: 'seed',
      tags: q.tags,
    })),
  })
  return GEO_SEED_QUESTIONS.length
}
