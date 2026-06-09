/**
 * 步骤6: 入库
 *
 * 将提炼后的原子事实写入 BrandKnowledge 表。
 * - contentType = 'fact'
 * - factType = 事实类型
 * - verificationStatus = needsVerification ? 'pending' : null
 * - metadata 存储多来源 URL + 提取来源
 */

import { prisma } from '../../db.js'
import type { RefinedItem } from './stepRefine.js'

export interface PersistInput {
  items: RefinedItem[]
  userId: string
  jobId: string
}

export interface PersistOutput {
  createdIds: string[]
  skippedCount: number
}

/**
 * 批量写入 BrandKnowledge（原子事实格式）
 */
export async function runPersist(input: PersistInput): Promise<PersistOutput> {
  const { items, userId, jobId } = input

  console.log(`[KnowledgeBuilder] 入库 — ${items.length} 条原子事实待写入, 用户: ${userId}, 任务: ${jobId}`)

  const createdIds: string[] = []
  let skippedCount = 0

  for (const item of items) {
    try {
      const record = await prisma.brandKnowledge.create({
        data: {
          userId,
          title: item.content.slice(0, 200),
          content: item.content,
          category: item.category,
          source: 'web_search',
          sourceUrl: item.sourceUrls[0] || null,
          credibility: item.credibility,
          tags: item.tags,
          isActive: !item.needsReview,
          sortOrder: 0,
          buildJobId: jobId,
          // 原子事实扩展字段
          contentType: 'fact',
          factType: item.factType,
          verificationStatus: item.needsVerification ? 'pending' : null,
          metadata: {
            sourceUrls: item.sourceUrls,
            confidence: item.credibility,
            extractSource: 'web_search',
            factContext: item.title,
          },
        },
      })
      createdIds.push(record.id)
    } catch (err) {
      console.warn(
        `[KnowledgeBuilder] 写入失败 "${item.content.slice(0, 30)}": ${err instanceof Error ? err.message : err}`
      )
      skippedCount++
    }
  }

  console.log(`[KnowledgeBuilder] 入库完成 — 成功 ${createdIds.length} 条事实, 跳过 ${skippedCount}`)

  return { createdIds, skippedCount }
}
