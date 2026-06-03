import { Prisma } from '@prisma/client'
import { prisma } from '../../db.js'

/**
 * 选题来源聚合器 — 从多模块收集洞察，作为选题生成的输入
 */

export interface TopicSourceAggregate {
  /** GEO 意题库中的高价值问题 */
  geoHints: Array<{ question: string; category: string; intentType: string }>
  /** 群聊分析中的热门目的地和痛点 */
  chatInsights: {
    hotTopics: Array<{ word: string; count: number }>
    painPoints: string[]
  }
  /** CRM 客户出行意向统计 */
  crmInsights: Array<{ destination: string; count: number }>
  /** 高热度未过期热点 */
  hotspotHints: Array<{ title: string; heatValue: number; keywords: string[] }>
}

/**
 * 聚合所有模块的选题灵感来源
 */
export async function aggregateTopicSources(userId: string): Promise<TopicSourceAggregate> {
  const [geoHints, chatInsights, crmInsights, hotspotHints] = await Promise.all([
    loadGeoHints(userId),
    loadChatInsights(userId),
    loadCrmInsights(userId),
    loadHotspotHints(),
  ])

  return { geoHints, chatInsights, crmInsights, hotspotHints }
}

/** 从 GEO 意图题库中取最近未使用的高价值问题 */
async function loadGeoHints(userId: string): Promise<TopicSourceAggregate['geoHints']> {
  try {
    // 取最近 20 条问题，优先 informational 和 commercial 意图
    const questions = await prisma.geoQuestion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { question: true, category: true, intentType: true },
    })
    return questions.map(q => ({
      question: q.question,
      category: q.category,
      intentType: q.intentType,
    }))
  } catch {
    return []
  }
}

/** 从群聊分析中聚合热门目的地和痛点 */
async function loadChatInsights(userId: string): Promise<TopicSourceAggregate['chatInsights']> {
  try {
    const analyses = await prisma.groupChatAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { report: true },
    })

    // 合并所有分析的 hotTopics 和 painPoints
    const topicMap = new Map<string, number>()
    const painPointSet = new Set<string>()

    for (const analysis of analyses) {
      const report = analysis.report as {
        hotTopics?: Array<{ word: string; count: number }>
        painPoints?: string[]
      } | null
      if (!report) continue

      if (Array.isArray(report.hotTopics)) {
        for (const t of report.hotTopics) {
          topicMap.set(t.word, (topicMap.get(t.word) || 0) + t.count)
        }
      }
      if (Array.isArray(report.painPoints)) {
        for (const p of report.painPoints) {
          painPointSet.add(p)
        }
      }
    }

    const hotTopics = Array.from(topicMap.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      hotTopics,
      painPoints: Array.from(painPointSet).slice(0, 10),
    }
  } catch {
    return { hotTopics: [], painPoints: [] }
  }
}

/** 从 CRM 客户出行意向中统计热门目的地 */
async function loadCrmInsights(userId: string): Promise<TopicSourceAggregate['crmInsights']> {
  try {
    const customers = await prisma.customer.findMany({
      where: { userId, isDeleted: false, travelIntent: { not: Prisma.DbNull } },
      select: { travelIntent: true },
    })

    const destMap = new Map<string, number>()
    for (const c of customers) {
      const intent = c.travelIntent as { destination?: string } | null
      if (intent?.destination) {
        destMap.set(intent.destination, (destMap.get(intent.destination) || 0) + 1)
      }
    }

    return Array.from(destMap.entries())
      .map(([destination, count]) => ({ destination, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  } catch {
    return []
  }
}

/** 从热点模块取高热度未过期的热点 */
async function loadHotspotHints(): Promise<TopicSourceAggregate['hotspotHints']> {
  try {
    const hotspots = await prisma.hotspot.findMany({
      where: {
        usageStatus: 'unused',
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } },
        ],
      },
      orderBy: { heatValue: 'desc' },
      take: 10,
      select: { title: true, heatValue: true, keywords: true },
    })
    return hotspots.map(h => ({
      title: h.title,
      heatValue: h.heatValue,
      keywords: h.keywords,
    }))
  } catch {
    return []
  }
}
