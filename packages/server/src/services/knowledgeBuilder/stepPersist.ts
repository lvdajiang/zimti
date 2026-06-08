/**
 * 步骤6: 入库
 *
 * 将完善后的知识条目批量写入 BrandKnowledge 表。
 * - source = "web_search"
 * - sourceUrl = item.sourceUrls[0] || null
 * - credibility = item.credibility
 * - buildJobId = jobId
 * - needsReview 的条目 isActive = false
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
 * 批量写入 BrandKnowledge
 */
export async function runPersist(input: PersistInput): Promise<PersistOutput> {
  const { items, userId, jobId } = input

  console.log(`[KnowledgeBuilder] 入库 — ${items.length} 条待写入, 用户: ${userId}, 任务: ${jobId}`)

  const createdIds: string[] = []
  let skippedCount = 0

  // 使用 createMany 批量写入，但由于需要获取生成的 ID，逐条写入
  for (const item of items) {
    try {
      const record = await prisma.brandKnowledge.create({
        data: {
          userId,
          title: item.title,
          content: item.content,
          category: item.category,
          source: 'web_search',
          sourceUrl: item.sourceUrls[0] || null,
          credibility: item.credibility,
          tags: item.tags,
          isActive: !item.needsReview,
          sortOrder: 0,
          buildJobId: jobId,
        },
      })
      createdIds.push(record.id)
    } catch (err) {
      console.warn(
        `[KnowledgeBuilder] 写入失败 "${item.title.slice(0, 30)}": ${err instanceof Error ? err.message : err}`
      )
      skippedCount++
    }
  }

  console.log(`[KnowledgeBuilder] 入库完成 — 成功 ${createdIds.length}, 跳过 ${skippedCount}`)

  return { createdIds, skippedCount }
}
