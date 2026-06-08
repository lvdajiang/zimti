/**
 * 步骤3: 可信度筛选
 *
 * AI 批量评估每条搜索结果的可信度，
 * .gov.cn 来源 +0.2 boost，urlVerified:false 上限 0.5，
 * 阈值 0.4 以下的条目过滤掉。
 */

import { getAIProvider } from '../ai/provider.js'
import type { SearchRawItem } from './stepMultiSearch.js'

export interface FilteredItem extends SearchRawItem {
  credibility: number
  credibilityReason: string
  filtered: boolean
}

export interface CredibilityInput {
  results: SearchRawItem[]
}

export interface CredibilityReport {
  total: number
  passed: number
  filtered: number
  reasons: Record<string, number>  // 过滤原因 -> 数量
}

export interface CredibilityOutput {
  filtered: FilteredItem[]
  report: CredibilityReport
}

const CREDIBILITY_THRESHOLD = 0.4
const GOV_BOOST = 0.2
const UNVERIFIED_URL_CAP = 0.5
const BATCH_SIZE = 12

/**
 * AI 批量评估可信度（10-12条/批）
 */
async function evaluateBatch(items: SearchRawItem[]): Promise<FilteredItem[]> {
  const ai = getAIProvider()

  const itemsText = items.map((item, i) => {
    return `--- 条目 ${i + 1} ---
标题: ${item.title}
URL: ${item.url || '无URL'}
摘要: ${item.snippet || item.content}
来源: ${item.source}${item.isGovSource ? ' (政府来源 .gov.cn)' : ''}${item.urlVerified ? ' (URL已验证)' : ' (URL未验证)'}`
  }).join('\n\n')

  const prompt = `你是一个信息可信度评估专家。请对以下 ${items.length} 条搜索结果进行可信度评估。

${itemsText}

请对每条结果打分（0-1），评分依据：
- 0.8-1.0: 官方权威来源，信息具体可验证
- 0.6-0.8: 知名媒体/平台，信息较可靠
- 0.4-0.6: 一般来源，信息基本合理但需谨慎
- 0.2-0.4: 来源不明，信息模糊或可能过时
- 0.0-0.2: 广告、营销内容或明显不可靠

请返回 JSON 数组，每项包含 index（从1开始）、score、reason：
[{"index": 1, "score": 0.7, "reason": "评分理由"}, ...]

只返回 JSON，不要其他文字。`

  const response = await ai.generate(prompt)

  try {
    const jsonMatch = response.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) throw new Error('未找到 JSON 数组')

    const evaluations = JSON.parse(jsonMatch[0]) as Array<{
      index: number
      score: number
      reason: string
    }>

    return items.map((item, i) => {
      const eval_ = evaluations[i]
      let score = eval_?.score ?? 0.5
      let reason = eval_?.reason ?? '未评估'

      // .gov.cn boost
      if (item.isGovSource) {
        score = Math.min(1.0, score + GOV_BOOST)
        reason += '；政府来源+0.2'
      }

      // urlVerified:false 上限
      if (!item.urlVerified) {
        score = Math.min(score, UNVERIFIED_URL_CAP)
      }

      const isFiltered = score < CREDIBILITY_THRESHOLD

      return {
        ...item,
        credibility: Math.round(score * 100) / 100,
        credibilityReason: reason,
        filtered: isFiltered,
      }
    })
  } catch (err) {
    console.warn(
      `[KnowledgeBuilder] 可信度评估 JSON 解析失败: ${err instanceof Error ? err.message : err}，降级为默认分`
    )
    // 降级：所有条目给默认分
    return items.map(item => ({
      ...item,
      credibility: item.isGovSource ? 0.7 : item.urlVerified ? 0.5 : 0.3,
      credibilityReason: 'AI评估失败，使用降级评分',
      filtered: false,
    }))
  }
}

/**
 * 对所有搜索结果进行可信度筛选
 */
export async function runCredibilityFilter(input: CredibilityInput): Promise<CredibilityOutput> {
  const { results } = input

  console.log(`[KnowledgeBuilder] 可信度筛选 — ${results.length} 条待评估`)

  const allFiltered: FilteredItem[] = []
  const reasons: Record<string, number> = {}

  // 分批评估
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE)
    const batchResults = await evaluateBatch(batch)
    allFiltered.push(...batchResults)

    if (i + BATCH_SIZE < results.length) {
      console.log(`[KnowledgeBuilder] 可信度筛选 — 已评估 ${Math.min(i + BATCH_SIZE, results.length)}/${results.length}`)
    }
  }

  // 统计
  const passed = allFiltered.filter(item => !item.filtered).length
  const filtered = allFiltered.filter(item => item.filtered).length

  for (const item of allFiltered) {
    if (item.filtered) {
      // 提取主要原因关键词
      const mainReason = item.credibilityReason.split('；')[0].slice(0, 20)
      reasons[mainReason] = (reasons[mainReason] ?? 0) + 1
    }
  }

  const report: CredibilityReport = {
    total: results.length,
    passed,
    filtered,
    reasons,
  }

  console.log(`[KnowledgeBuilder] 可信度筛选完成 — 通过 ${passed}, 过滤 ${filtered}`)

  return { filtered: allFiltered, report }
}
