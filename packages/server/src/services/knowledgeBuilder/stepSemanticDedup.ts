/**
 * 步骤4: 语义去重
 *
 * 1. 与已有知识库比对，排除与已有知识高度相似的条目（相似度 > 0.7）
 * 2. 新结果内部 AI 聚类合并，合并相似条目
 */

import { getAIProvider } from '../ai/provider.js'
import type { FilteredItem } from './stepCredibility.js'

export interface MergedItem {
  id: string
  title: string
  content: string
  dimensions: string[]
  sourceUrls: string[]
  sourceIds: string[]
  credibility: number
  category: string
  needsReview: boolean
}

export interface SemanticDedupInput {
  items: FilteredItem[]
  existingKnowledge: Array<{ id: string; title: string; content: string }>
}

export interface SemanticDedupReport {
  duplicates: number           // 新结果内部去重数量
  existingDuplicates: number   // 与已有知识重复的数量
}

export interface SemanticDedupOutput {
  merged: MergedItem[]
  report: SemanticDedupReport
}

const SIMILARITY_THRESHOLD = 0.7

/**
 * 生成简单的短ID
 */
function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * 与已有知识语义比对（AI判断）
 */
async function checkExistingDuplicates(
  items: FilteredItem[],
  existingKnowledge: Array<{ id: string; title: string; content: string }>
): Promise<Set<string>> {
  if (existingKnowledge.length === 0) return new Set()

  const ai = getAIProvider()
  const duplicateIds = new Set<string>()

  // 取条目标题和摘要用于比对
  const existingText = existingKnowledge
    .slice(0, 30)  // 限制已有知识数量避免 token 过多
    .map((k, i) => `[已有${i + 1}] ${k.title}: ${k.content.slice(0, 100)}`)
    .join('\n')

  const newItemsText = items
    .filter(item => !item.filtered)
    .map((item, i) => `[新${i + 1}|${item.id}] ${item.title}: ${(item.snippet || item.content).slice(0, 100)}`)
    .join('\n')

  const prompt = `你是一个语义相似度判断专家。请比较以下新搜索结果与已有知识库内容的相似度。

已有知识库：
${existingText}

新的搜索结果：
${newItemsText}

请判断每条新结果是否与已有知识高度重复（相似度 > ${SIMILARITY_THRESHOLD}）。
高度重复意味着核心信息点完全一致，不是简单的主题相关。

返回 JSON 数组，每项包含 itemId 和 isDuplicate：
[{"itemId": "xxx", "isDuplicate": true}, ...]

只返回 JSON，不要其他文字。`

  try {
    const response = await ai.generate(prompt)
    const jsonMatch = response.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) throw new Error('未找到 JSON 数组')

    const results = JSON.parse(jsonMatch[0]) as Array<{ itemId: string; isDuplicate: boolean }>
    for (const r of results) {
      if (r.isDuplicate) {
        duplicateIds.add(r.itemId)
      }
    }

    console.log(`[KnowledgeBuilder] 已有知识去重 — 发现 ${duplicateIds.size} 条重复`)
  } catch (err) {
    console.warn(
      `[KnowledgeBuilder] 已有知识去重判断失败: ${err instanceof Error ? err.message : err}，跳过此步骤`
    )
  }

  return duplicateIds
}

/**
 * 新结果内部 AI 聚类合并
 */
async function clusterMerge(
  items: FilteredItem[],
  excludeIds: Set<string>
): Promise<MergedItem[]> {
  const candidates = items.filter(item => !item.filtered && !excludeIds.has(item.id))

  if (candidates.length <= 1) {
    return candidates.map(item => ({
      id: item.id,
      title: item.title,
      content: item.snippet || item.content,
      dimensions: [item.dimension],
      sourceUrls: item.url ? [item.url] : [],
      sourceIds: [item.id],
      credibility: item.credibility,
      category: '',
      needsReview: false,
    }))
  }

  const ai = getAIProvider()

  const itemsText = candidates.map((item, i) => {
    return `[${i}] ID=${item.id} | 标题=${item.title} | 维度=${item.dimension} | 可信度=${item.credibility}
内容: ${(item.snippet || item.content).slice(0, 150)}`
  }).join('\n\n')

  const prompt = `你是一个事实聚合专家。请对以下 ${candidates.length} 条搜索结果进行语义去重。

${itemsText}

规则：
- 如果多条结果陈述同一个事实（核心数据点一致），合并为一条，保留最详细的描述
- 如果信息不完全一致（如不同数字），保留为独立条目，标记 needsReview=true
- 不要把不同的事实合并成文章
- 保留所有来源URL
- 合并后取最高可信度

返回 JSON 数组，每项包含：
- ids: 要合并的条目ID数组（单条也放数组）
- title: 事实的简短描述
- content: 事实的完整描述（1-3句话，保留关键数据点，不超过150字）
- category: 初步分类（brand_intro/route/service/case/faq/industry 之一）
- needsReview: 如果信息有冲突或不确定则为 true

[{"ids": ["id1", "id2"], "title": "标题", "content": "内容", "category": "route", "needsReview": false}, ...]

只返回 JSON，不要其他文字。`

  try {
    const response = await ai.generate(prompt)
    const jsonMatch = response.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) throw new Error('未找到 JSON 数组')

    const clusters = JSON.parse(jsonMatch[0]) as Array<{
      ids: string[]
      title: string
      content: string
      category: string
      needsReview: boolean
    }>

    const idMap = new Map<string, FilteredItem>()
    for (const item of candidates) {
      idMap.set(item.id, item)
    }

    return clusters.map(cluster => ({
      id: generateId(),
      title: cluster.title,
      content: cluster.content,
      dimensions: [...new Set(cluster.ids.map(id => idMap.get(id)?.dimension).filter(Boolean) as string[])],
      sourceUrls: [...new Set(cluster.ids.map(id => idMap.get(id)?.url).filter(Boolean) as string[])],
      sourceIds: cluster.ids,
      credibility: Math.max(...cluster.ids.map(id => idMap.get(id)?.credibility ?? 0.5)),
      category: cluster.category || '',
      needsReview: cluster.needsReview ?? false,
    }))
  } catch (err) {
    console.warn(
      `[KnowledgeBuilder] 内部聚类合并失败: ${err instanceof Error ? err.message : err}，降级为逐条保留`
    )
    return candidates.map(item => ({
      id: item.id,
      title: item.title,
      content: item.snippet || item.content,
      dimensions: [item.dimension],
      sourceUrls: item.url ? [item.url] : [],
      sourceIds: [item.id],
      credibility: item.credibility,
      category: '',
      needsReview: true,
    }))
  }
}

/**
 * 执行语义去重
 */
export async function runSemanticDedup(input: SemanticDedupInput): Promise<SemanticDedupOutput> {
  const { items, existingKnowledge } = input

  console.log(`[KnowledgeBuilder] 语义去重 — ${items.length} 条新结果, ${existingKnowledge.length} 条已有知识`)

  // 1. 与已有知识比对
  const duplicateIds = await checkExistingDuplicates(items, existingKnowledge)

  // 2. 内部聚类合并
  const merged = await clusterMerge(items, duplicateIds)

  // 统计
  const originalCount = items.filter(item => !item.filtered).length
  const report: SemanticDedupReport = {
    duplicates: originalCount - merged.length - duplicateIds.size,
    existingDuplicates: duplicateIds.size,
  }

  console.log(
    `[KnowledgeBuilder] 语义去重完成 — 原始 ${originalCount} 条, 去重后 ${merged.length} 条, ` +
    `内部去重 ${report.duplicates}, 已有重复 ${report.existingDuplicates}`
  )

  return { merged, report }
}
