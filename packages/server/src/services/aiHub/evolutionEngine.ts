import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { BrandMemoryService } from './brandMemory.js'
import type { EvolutionType } from '@zimti/shared'

export interface EvolutionInput {
  type: EvolutionType
  trigger: string
  before: unknown
  after: unknown
  metric?: number
}

export class EvolutionEngine {
  private userId: string
  private brandMemory: BrandMemoryService

  constructor(userId: string = DEMO_USER_ID) {
    this.userId = userId
    this.brandMemory = new BrandMemoryService(userId)
  }

  async recordAndLearn(input: EvolutionInput): Promise<void> {
    // 记录进化日志
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = JSON.parse(JSON.stringify({
      before: input.before,
      after: input.after,
      metric: input.metric,
    })) as any
    await prisma.evolutionLog.create({
      data: {
        userId: this.userId,
        type: input.type,
        trigger: input.trigger,
        detail,
      },
    })

    // 根据类型自动学习
    switch (input.type) {
      case 'style':
        await this.learnStyleEvolution(input)
        break
      case 'content':
        await this.learnContentPattern(input)
        break
      case 'skill':
        await this.learnSkillEvolution(input)
        break
    }
  }

  async analyzePatterns(type?: EvolutionType): Promise<Array<{
    pattern: string
    frequency: number
    impact: number
  }>> {
    const where: Record<string, unknown> = { userId: this.userId }
    if (type) where.type = type

    const logs = await prisma.evolutionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const patterns: Record<string, { count: number; totalMetric: number }> = {}
    for (const log of logs) {
      const detail = log.detail as { metric?: number }
      const key = `${log.type}:${log.trigger}`
      if (!patterns[key]) patterns[key] = { count: 0, totalMetric: 0 }
      patterns[key].count++
      if (detail.metric) patterns[key].totalMetric += detail.metric
    }

    return Object.entries(patterns)
      .map(([key, val]) => ({
        pattern: key,
        frequency: val.count,
        impact: val.count > 0 ? val.totalMetric / val.count : 0,
      }))
      .sort((a, b) => b.frequency - a.frequency)
  }

  async getRecentLogs(limit = 20): Promise<Array<{
    id: string
    type: string
    trigger: string
    detail: unknown
    createdAt: string
  }>> {
    const logs = await prisma.evolutionLog.findMany({
      where: { userId: this.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs.map((l) => ({
      id: l.id,
      type: l.type,
      trigger: l.trigger,
      detail: l.detail,
      createdAt: l.createdAt.toISOString(),
    }))
  }

  private async learnStyleEvolution(input: EvolutionInput): Promise<void> {
    if (input.trigger === 'user_edit' && input.before && input.after) {
      await this.brandMemory.learnStyle(
        String(input.before),
        String(input.after),
      )
    }
  }

  private async learnContentPattern(input: EvolutionInput): Promise<void> {
    if (!input.metric) return

    // 高表现内容 → 提取成功模式
    if (input.metric > 0.6 && input.after) {
      const existing = await this.brandMemory.getCategory('skill')
      const successPatterns = [
        ...((existing.content_success_patterns as unknown[]) ?? []),
        input.after,
      ]
      // 保留最近 50 条
      await this.brandMemory.upsert('skill', 'content_success_patterns',
        successPatterns.slice(-50), 'learned', Math.min(input.metric, 1))
    }
  }

  private async learnSkillEvolution(input: EvolutionInput): Promise<void> {
    // Skill 效果评估：metric 持续低于 0.3 → 标记需调优
    if (input.metric !== undefined && input.metric < 0.3 && input.before) {
      const skillName = String(input.before)
      await this.brandMemory.upsert('skill', `skill:${skillName}:needs_review`,
        { reason: `效果得分 ${input.metric.toFixed(2)}，低于阈值`, trigger: input.trigger },
        'learned', 0)
    }
  }
}
