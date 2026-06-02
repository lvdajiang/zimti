import { prisma } from '../db.js'
import { getAIProvider } from './ai/index.js'

/**
 * 解析微信 PC 导出的 txt 格式
 * 格式1: "昵称 时间\n消息内容"
 * 格式2: "昵称(微信号) YYYY-MM-DD HH:mm:ss\n消息内容"
 */
function parseWeChatTxt(content: string): Array<{ sender: string; time: string; message: string }> {
  const messages: Array<{ sender: string; time: string; message: string }> = []
  const lines = content.split('\n')

  // 匹配消息头行：昵称 + 时间
  // 格式: "昵称 2024/1/15 10:30:02" 或 "昵称(微信号) 2024-01-15 10:30"
  const headerPattern = /^(.+?)\s+(\d{4}[/\-年]\d{1,2}[/\-月]\d{1,2}日?\s+\d{1,2}:\d{2}(?::\d{2})?)/
  let currentSender = ''
  let currentTime = ''
  let currentMessage = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      // 空行可能是消息结束
      if (currentSender && currentMessage) {
        messages.push({ sender: currentSender, time: currentTime, message: currentMessage.trim() })
        currentMessage = ''
      }
      continue
    }

    const match = trimmed.match(headerPattern)
    if (match) {
      // 先保存上一条消息
      if (currentSender && currentMessage) {
        messages.push({ sender: currentSender, time: currentTime, message: currentMessage.trim() })
      }
      // 去掉可能的微信号括号
      currentSender = match[1].replace(/\(.*?\)$/, '').trim()
      currentTime = match[2]
      currentMessage = ''
    } else {
      // 非头部行，追加到当前消息
      currentMessage += (currentMessage ? '\n' : '') + trimmed
    }
  }

  // 保存最后一条消息
  if (currentSender && currentMessage) {
    messages.push({ sender: currentSender, time: currentTime, message: currentMessage.trim() })
  }

  return messages
}

/**
 * 分析群聊文件
 * 1. 解析消息
 * 2. 调用 AI 提取线索、话题、痛点、价格区间
 * 3. 保存分析报告
 */
export async function analyzeGroupChat(
  userId: string,
  groupName: string,
  fileName: string,
  content: string
): Promise<{
  id: string
  groupName: string
  messageCount: number
  leadCount: number
  report: {
    leads: Array<{ name: string; intent: string; context: string }>
    hotTopics: Array<{ word: string; count: number }>
    painPoints: string[]
    priceRange: { min: number; max: number; currency: string } | null
  }
}> {
  // 1. 解析消息
  const messages = parseWeChatTxt(content)
  const messageCount = messages.length

  if (messageCount === 0) {
    throw new Error('未能解析出有效消息，请确认文件格式为微信 PC 导出的 txt 文件')
  }

  // 2. 构建分析摘要（避免 token 过多，截取最近的 200 条消息）
  const recentMessages = messages.slice(-200)
  const messageText = recentMessages
    .map((m) => `[${m.time}] ${m.sender}: ${m.message}`)
    .join('\n')

  // 统计发言人数
  const senderSet = new Set(messages.map((m) => m.sender))
  const senderCount = senderSet.size

  // 3. 调用 AI 分析
  const ai = getAIProvider()
  const prompt = `分析以下微信群聊记录，提取旅游相关的商业洞察。

群名：${groupName}
消息数：${messageCount}
发言人数：${senderCount}

聊天记录（最近200条）：
${messageText}

请提取以下信息并返回 JSON：
{
  "leads": [
    { "name": "发言者昵称", "intent": "high/medium/low", "context": "表达意向的原文片段" }
  ],
  "hot_topics": [
    { "word": "目的地/景点名", "count": 被提及次数 }
  ],
  "pain_points": ["客户抱怨或不满的点"],
  "price_range": { "min": 最低预算, "max": 最高预算, "currency": "CNY" }
}

提取规则：
- leads: 找出表达了旅行意向的人（咨询行程、问价格、说想去等），intent 根据意向强度判断
- hot_topics: 按提及频次排列热门目的地/景点，取 top 10
- pain_points: 提取客户不满、抱怨、痛点（如价格太贵、服务不好、行程太赶等）
- price_range: 从预算讨论中提取价格区间，如没有讨论则填 null
- 如果某个字段没有相关内容，返回空数组或 null

只返回 JSON，不要额外文字。`

  let report: {
    leads: Array<{ name: string; intent: string; context: string }>
    hotTopics: Array<{ word: string; count: number }>
    painPoints: string[]
    priceRange: { min: number; max: number; currency: string } | null
  }

  try {
    const aiResult = await ai.generate(prompt, '你是旅游行业数据分析师。返回纯 JSON。')
    const parsed = JSON.parse(aiResult)
    report = {
      leads: parsed.leads ?? [],
      hotTopics: parsed.hot_topics ?? [],
      painPoints: parsed.pain_points ?? [],
      priceRange: parsed.price_range ?? null,
    }
  } catch {
    // AI 解析失败时返回基础结构
    report = {
      leads: [],
      hotTopics: [],
      painPoints: [],
      priceRange: null,
    }
  }

  // 4. 保存分析结果到数据库
  const analysis = await prisma.groupChatAnalysis.create({
    data: {
      userId,
      groupName,
      fileName,
      messageCount,
      leadCount: report.leads.length,
      report: report as any,
    },
  })

  return {
    id: analysis.id,
    groupName: analysis.groupName,
    messageCount: analysis.messageCount,
    leadCount: analysis.leadCount,
    report,
  }
}

/**
 * 获取分析报告列表
 */
export async function getAnalyses(
  userId: string,
  page = 1,
  limit = 20
): Promise<{
  items: Array<{
    id: string
    groupName: string
    fileName: string
    messageCount: number
    leadCount: number
    createdAt: string
  }>
  total: number
}> {
  const ps = Math.min(limit, 50)
  const where = { userId }

  const [items, total] = await Promise.all([
    prisma.groupChatAnalysis.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * ps,
      take: ps,
      select: {
        id: true,
        groupName: true,
        fileName: true,
        messageCount: true,
        leadCount: true,
        createdAt: true,
      },
    }),
    prisma.groupChatAnalysis.count({ where }),
  ])

  return {
    items: items.map((item) => ({
      id: item.id,
      groupName: item.groupName,
      fileName: item.fileName,
      messageCount: item.messageCount,
      leadCount: item.leadCount,
      createdAt: item.createdAt.toISOString(),
    })),
    total,
  }
}

/**
 * 获取单条分析报告详情
 */
export async function getAnalysis(userId: string, id: string) {
  const analysis = await prisma.groupChatAnalysis.findFirst({
    where: { id, userId },
  })

  if (!analysis) {
    throw new Error('分析报告不存在')
  }

  return {
    id: analysis.id,
    groupName: analysis.groupName,
    fileName: analysis.fileName,
    messageCount: analysis.messageCount,
    leadCount: analysis.leadCount,
    report: analysis.report,
    createdAt: analysis.createdAt.toISOString(),
  }
}
