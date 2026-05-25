import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { getAIProvider } from '../ai/provider.js'
import { BrandMemoryService } from './brandMemory.js'

export interface StrategyRecommendation {
  type: 'topic' | 'moments' | 'follow_up' | 'hotspot' | 'content_improve'
  priority: 'high' | 'medium' | 'low'
  title: string
  reason: string
  action: string
  data?: unknown
}

export class StrategyEngine {
  private userId: string
  private brandMemory: BrandMemoryService

  constructor(userId: string = DEMO_USER_ID) {
    this.userId = userId
    this.brandMemory = new BrandMemoryService(userId)
  }

  async evaluateHotspot(hotspotTitle: string, hotspotDesc: string): Promise<{
    matchScore: number
    reasoning: string
    suggested: boolean
  }> {
    const context = await this.brandMemory.getContext()
    if (!context) {
      return { matchScore: 0, reasoning: '品牌画像尚未建立', suggested: false }
    }

    const ai = getAIProvider()
    if (!ai) return { matchScore: 0, reasoning: 'AI 服务不可用', suggested: false }

    const prompt = `判断以下热点是否适合该用户的自媒体账号。

${context}

热点：${hotspotTitle}
描述：${hotspotDesc}

返回 JSON：
{
  "match_score": 0-100,
  "reasoning": "判断理由",
  "suggested": true/false
}`

    try {
      const result = await ai.generate(prompt, '你是自媒体策略分析师。返回纯 JSON。')
      const parsed = JSON.parse(result)
      return {
        matchScore: parsed.match_score ?? 0,
        reasoning: parsed.reasoning ?? '',
        suggested: parsed.suggested ?? false,
      }
    } catch {
      return { matchScore: 0, reasoning: '分析失败', suggested: false }
    }
  }

  async getRecommendations(): Promise<StrategyRecommendation[]> {
    const recommendations: StrategyRecommendation[] = []

    // CRM 客户洞察 → 选题推荐
    const customerInsights = await this.analyzeCustomerInsights()
    if (customerInsights.length > 0) {
      recommendations.push(...customerInsights)
    }

    // 沉默客户 → 跟进建议
    const silentCustomers = await this.detectSilentCustomers()
    if (silentCustomers.length > 0) {
      recommendations.push({
        type: 'follow_up',
        priority: 'high',
        title: `${silentCustomers.length} 个客户需要跟进`,
        reason: '超过 3 天未互动',
        action: '查看沉默客户列表',
        data: silentCustomers,
      })
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }

  private async analyzeCustomerInsights(): Promise<StrategyRecommendation[]> {
    const recentCustomers = await prisma.customer.findMany({
      where: { userId: this.userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })

    if (recentCustomers.length === 0) return []

    // 统计常见出行意向
    const destinationCounts: Record<string, number> = {}
    for (const c of recentCustomers) {
      const intent = c.travelIntent as { destination?: string } | null
      if (intent?.destination) {
        destinationCounts[intent.destination] = (destinationCounts[intent.destination] ?? 0) + 1
      }
    }

    const topDestinations = Object.entries(destinationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)

    if (topDestinations.length === 0) return []

    return topDestinations.map(([dest, count]) => ({
      type: 'topic' as const,
      priority: count >= 3 ? 'high' as const : 'medium' as const,
      title: `CRM 洞察：${count} 个客户关注${dest}`,
      reason: '来自客户出行意向数据',
      action: `做一条${dest}相关视频`,
      data: { destination: dest, count },
    }))
  }

  private async detectSilentCustomers(): Promise<Array<{ id: string; name: string; daysSilent: number }>> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

    const customers = await prisma.customer.findMany({
      where: {
        userId: this.userId,
        stage: { notIn: ['ordered', 'completed', 'repurchase'] },
        OR: [
          { lastFollowUpAt: { lt: threeDaysAgo } },
          { lastFollowUpAt: null },
        ],
      },
      take: 10,
    })

    return customers.map((c) => ({
      id: c.id,
      name: c.name,
      daysSilent: c.lastFollowUpAt
        ? Math.floor((Date.now() - c.lastFollowUpAt.getTime()) / (24 * 60 * 60 * 1000))
        : 999,
    }))
  }

  async crossModuleAction(sourceModule: string, data: unknown): Promise<StrategyRecommendation[]> {
    const recommendations: StrategyRecommendation[] = []

    if (sourceModule === 'crm' && data && typeof data === 'object' && 'question' in data) {
      const question = (data as { question: string }).question
      recommendations.push({
        type: 'topic',
        priority: 'medium',
        title: `客户常见问题：${question}`,
        reason: 'CRM 客户反馈',
        action: '推荐制作为视频选题',
      })
    }

    if (sourceModule === 'video_metric' && data && typeof data === 'object' && 'completionRate' in data) {
      const metric = data as { completionRate: number; videoId: string }
      if (metric.completionRate > 0.6) {
        recommendations.push({
          type: 'content_improve',
          priority: 'medium',
          title: '高完播率视频，提取成功基因',
          reason: `完播率 ${(metric.completionRate * 100).toFixed(0)}%`,
          action: '分析并应用到后续视频',
        })
      }
    }

    return recommendations
  }
}
