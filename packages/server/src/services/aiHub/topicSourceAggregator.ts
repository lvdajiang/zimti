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
  /** 历史发布数据分析洞察（闭环反馈） */
  historicalInsights: {
    summary: string
    topPerformers: Array<{ title: string; platform: string; completionRate: number; playCount: number }>
    averageCompletionRate: number
    totalSnapshots: number
    recentInsight: string | null
  }
}

/**
 * 聚合所有模块的选题灵感来源
 */
export async function aggregateTopicSources(userId: string): Promise<TopicSourceAggregate> {
  const [geoHints, chatInsights, crmInsights, hotspotHints, historicalInsights] = await Promise.all([
    loadGeoHints(userId),
    loadChatInsights(userId),
    loadCrmInsights(userId),
    loadHotspotHints(),
    loadHistoricalInsights(userId),
  ])

  return { geoHints, chatInsights, crmInsights, hotspotHints, historicalInsights }
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

/** 从历史发布数据中提取洞察，实现 数据→创作 反馈闭环 */
async function loadHistoricalInsights(userId: string): Promise<TopicSourceAggregate['historicalInsights']> {
  const defaults = {
    summary: '暂无历史数据，发布视频后将自动分析',
    topPerformers: [] as Array<{ title: string; platform: string; completionRate: number; playCount: number }>,
    averageCompletionRate: 0,
    totalSnapshots: 0,
    recentInsight: null as string | null,
  }

  try {
    // 查询用户最近 60 天的数据快照
    const thirtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const snapshots = await prisma.dataSnapshot.findMany({
      where: {
        userId,
        snapshotAt: { gte: thirtyDaysAgo },
      },
      orderBy: { snapshotAt: 'desc' },
      take: 200,
      select: {
        playCount: true,
        completionRate: true,
        threeSecondBounceRate: true,
        commentCount: true,
        publishRecord: {
          select: {
            id: true,
            title: true,
            platform: true,
          },
        },
      },
    })

    if (snapshots.length === 0) return defaults

    // 按发布记录聚合
    const recordMap = new Map<string, {
      title: string
      platform: string
      totalPlays: number
      completionRates: number[]
      bounceRates: number[]
      commentCount: number
    }>()

    for (const s of snapshots) {
      const recordId = s.publishRecord.id
      if (!recordMap.has(recordId)) {
        recordMap.set(recordId, {
          title: s.publishRecord.title || '未命名',
          platform: s.publishRecord.platform,
          totalPlays: 0,
          completionRates: [],
          bounceRates: [],
          commentCount: 0,
        })
      }
      const r = recordMap.get(recordId)!
      r.totalPlays = Math.max(r.totalPlays, s.playCount)
      r.completionRates.push(Number(s.completionRate))
      r.commentCount = Math.max(r.commentCount, s.commentCount)
    }

    // 计算各记录的平均数据
    const performers = Array.from(recordMap.entries()).map(([, r]) => ({
      title: r.title,
      platform: r.platform,
      completionRate: Math.round(r.completionRates.reduce((a, b) => a + b, 0) / r.completionRates.length),
      playCount: r.totalPlays,
    })).sort((a, b) => b.completionRate - a.completionRate)

    const topPerformers = performers.slice(0, 5)
    const allRates = performers.map(p => p.completionRate)
    const averageCompletionRate = allRates.length > 0
      ? Math.round(allRates.reduce((a, b) => a + b, 0) / allRates.length)
      : 0
    const totalSnapshots = snapshots.length

    // 生成洞察摘要
    let summary = `过去 60 天共追踪 ${totalSnapshots} 个数据点，覆盖 ${performers.length} 个发布。`
    if (topPerformers.length > 0) {
      summary += `平均完播率 ${averageCompletionRate}%。`
      summary += `表现最好的内容是「${topPerformers[0].title}」（完播率 ${topPerformers[0].completionRate}%）。`
    }

    // 生成具体的改进建议
    let recentInsight: string | null = null
    if (topPerformers.length >= 2) {
      const best = topPerformers[0]
      const worst = topPerformers[topPerformers.length - 1]
      if (best.completionRate - worst.completionRate > 15) {
        recentInsight = `高完播率内容（如「${best.title}」完播率 ${best.completionRate}%）vs 低完播内容（如「${worst.title}」完播率 ${worst.completionRate}%）差距明显，建议分析高完播内容的选题角度和开头钩子策略，作为新选题参考。`
      }
    }

    return {
      summary,
      topPerformers,
      averageCompletionRate,
      totalSnapshots,
      recentInsight,
    }
  } catch {
    return defaults
  }
}
