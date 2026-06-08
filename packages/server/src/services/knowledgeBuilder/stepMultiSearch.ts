/**
 * 步骤2: 多维搜索（关键词增强版）
 *
 * 优先用真实关键词搜索，无关键词时回退到维度名搜索。
 * 每条搜索结果标记所属维度（展示用）和搜索关键词（溯源用）。
 */

import { searchWebWithGov } from '../webSearch.js'
import type { DimensionKeywordMapping } from '@zimti/shared'

export interface SearchRawItem {
  id: string
  dimension: string
  searchKeyword?: string  // 实际使用的搜索关键词（溯源用）
  title: string
  url: string
  snippet: string
  content: string
  source: 'glm' | 'searxng'
  urlVerified: boolean
  isGovSource: boolean
}

export interface MultiSearchInput {
  dimensions: string[]
  topic: string
  dimensionMappings?: DimensionKeywordMapping[]  // 维度-关键词映射
  suggestedKeywords?: string[]                     // 盲区补充关键词
}

export interface MultiSearchOutput {
  results: SearchRawItem[]
  searchKeywords: string[]  // 本次搜索使用的所有关键词
}

/**
 * 生成简单的短ID
 */
function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * 并发限制器
 */
async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = []
  let index = 0

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++
      try {
        results[i] = await tasks[i]()
      } catch (err) {
        console.warn(`[parallelLimit] task ${i} failed:`, err)
        results[i] = [] as T
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

/**
 * 多维搜索 — 优先用关键词搜索
 */
export async function runMultiSearch(input: MultiSearchInput): Promise<MultiSearchOutput> {
  const { dimensions, topic, dimensionMappings, suggestedKeywords } = input

  console.log(`[KnowledgeBuilder] 多维搜索 — ${dimensions.length} 个维度, 主题: "${topic}"`)

  const allResults: SearchRawItem[] = []
  const usedKeywords: string[] = []
  const resultsPerQuery = 5

  // 构建搜索任务列表
  const searchTasks: Array<() => Promise<SearchRawItem[]>> = []

  if (dimensionMappings && dimensionMappings.length > 0) {
    // 有关键词映射：用真实关键词搜索
    for (const mapping of dimensionMappings) {
      const queries = mapping.searchQueries.length > 0
        ? mapping.searchQueries.slice(0, 3)
        : [`${topic} ${mapping.dimension}`]

      for (const query of queries) {
        usedKeywords.push(query)
        searchTasks.push(() => searchByKeyword(query, mapping.dimension, resultsPerQuery))
      }
    }

    // 搜索盲区补充关键词
    if (suggestedKeywords && suggestedKeywords.length > 0) {
      for (const kw of suggestedKeywords.slice(0, 5)) {
        usedKeywords.push(kw)
        searchTasks.push(() => searchByKeyword(kw, '盲区补充', 4))
      }
    }

    console.log(`[KnowledgeBuilder] 使用 ${usedKeywords.length} 个关键词搜索（含 ${suggestedKeywords?.length || 0} 个盲区关键词）`)
  } else {
    // 无关键词映射：回退到维度名搜索
    for (const dimension of dimensions) {
      const query = `${topic} ${dimension}`
      usedKeywords.push(query)
      searchTasks.push(() => searchByKeyword(query, dimension, resultsPerQuery))
    }

    console.log(`[KnowledgeBuilder] 使用维度名搜索（无关键词映射）`)
  }

  // 并行搜索（最多 6 个并发）
  const dimensionResults = await parallelLimit(searchTasks, 6)

  // 合并所有结果
  for (const dimResults of dimensionResults) {
    allResults.push(...dimResults)
  }

  console.log(`[KnowledgeBuilder] 多维搜索完成 — 总计 ${allResults.length} 条结果`)

  return { results: allResults, searchKeywords: usedKeywords }
}

/**
 * 用单个关键词搜索，结果标记所属维度
 */
async function searchByKeyword(
  query: string,
  dimension: string,
  maxResults: number,
): Promise<SearchRawItem[]> {
  try {
    const searchResults = await searchWebWithGov(query, maxResults)
    return searchResults.map(result => ({
      id: generateId(),
      dimension,
      searchKeyword: query,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      content: result.snippet,
      source: result.source,
      urlVerified: result.urlVerified,
      isGovSource: result.isGovSource,
    }))
  } catch (err) {
    console.warn(
      `[KnowledgeBuilder] 关键词 "${query}" 搜索失败: ${err instanceof Error ? err.message : err}`
    )
    return []
  }
}
