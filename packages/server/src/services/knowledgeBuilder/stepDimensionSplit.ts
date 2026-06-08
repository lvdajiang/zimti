/**
 * 步骤1: 维度拆分 + 关键词映射
 *
 * 将主题拆分为 4-8 个搜索维度，同时维护维度-关键词映射。
 * 如果评估步骤已提供维度和关键词映射，直接透传。
 */

import { getAIProvider } from '../ai/provider.js'
import type { DimensionKeywordMapping } from '@zimti/shared'

// 旅行领域预设维度模板（作为 AI 引导参考）
const TRAVEL_DIMENSION_HINTS = [
  '基本信息（地理位置、面积、人口、气候）',
  '交通出行（航班、火车、自驾路线、当地交通）',
  '景点推荐（热门景点、小众景点、季节特色）',
  '美食文化（当地特色菜、餐厅推荐、饮食文化）',
  '住宿指南（酒店类型、区域选择、价格区间）',
  '注意事项（签证、安全、禁忌、最佳旅行时间）',
  '费用预算（消费水平、交通费用、门票价格）',
  '当地文化（习俗、节日、语言、历史背景）',
]

export interface DimensionSplitInput {
  topic: string
  dimensions?: string[]
  dimensionMappings?: DimensionKeywordMapping[]  // 来自 evaluation 的维度-关键词映射
  suggestedKeywords?: string[]                     // 盲区补充关键词
}

export interface DimensionSplitOutput {
  dimensions: string[]
  dimensionMappings: DimensionKeywordMapping[]
  suggestedKeywords: string[]
}

/**
 * 维度拆分 + 关键词映射
 * 如果评估步骤已提供 mappings，直接透传
 */
export async function runDimensionSplit(input: DimensionSplitInput): Promise<DimensionSplitOutput> {
  const { topic, dimensions: presetDimensions, dimensionMappings: presetMappings, suggestedKeywords: presetSuggested } = input

  console.log(`[KnowledgeBuilder] 维度拆分 — 主题: "${topic}"`)

  // 如果评估步骤已提供维度和映射，直接透传
  if (presetMappings && presetMappings.length >= 3) {
    const dims = presetDimensions ?? presetMappings.map(m => m.dimension)
    console.log(`[KnowledgeBuilder] 使用评估步骤提供的 ${dims.length} 个维度和关键词映射`)
    return {
      dimensions: dims.slice(0, 8),
      dimensionMappings: presetMappings.slice(0, 8),
      suggestedKeywords: presetSuggested ?? [],
    }
  }

  // 如果只有维度没有映射，为每个维度构造默认搜索查询
  if (presetDimensions && presetDimensions.length >= 3) {
    console.log(`[KnowledgeBuilder] 使用评估步骤提供的 ${presetDimensions.length} 个维度`)
    const mappings: DimensionKeywordMapping[] = presetDimensions.slice(0, 8).map(dim => ({
      dimension: dim,
      keywords: [],
      searchQueries: [`${topic} ${dim}`],
    }))
    return {
      dimensions: presetDimensions.slice(0, 8),
      dimensionMappings: mappings,
      suggestedKeywords: presetSuggested ?? [],
    }
  }

  // 无预设维度，AI 自行拆分
  const ai = getAIProvider()

  const prompt = `你是一个知识研究专家。请将以下主题拆分为 4-8 个搜索维度，确保覆盖该主题的主要知识面。

主题：${topic}

请参考以下旅行领域的维度分类思路（如果主题不是旅行相关，请自行调整）：
${TRAVEL_DIMENSION_HINTS.map((h, i) => `${i + 1}. ${h}`).join('\n')}

要求：
1. 每个维度是一个具体的搜索短语（5-15字），适合直接用于搜索引擎
2. 维度之间尽量不重叠
3. 覆盖该主题最核心的 4-8 个知识面
4. 如果主题涉及特定领域，请用该领域的专业维度

请只返回 JSON 数组，不要任何其他文字：
["维度1", "维度2", "维度3", ...]`

  const response = await ai.generate(prompt)

  // 尝试解析 JSON
  let dimensions: string[] = []

  try {
    const jsonMatch = response.match(/\[[\s\S]*?\]/)
    if (jsonMatch) {
      dimensions = JSON.parse(jsonMatch[0])
    }
  } catch {
    console.warn(`[KnowledgeBuilder] 维度拆分 JSON 解析失败，尝试行分割降级`)
  }

  // 降级：按行分割提取
  if (dimensions.length === 0) {
    dimensions = response
      .split('\n')
      .map(line => line.replace(/^\d+[\.\、\)]\s*/, '').trim())
      .filter(line => line.length >= 3 && line.length <= 50)
  }

  // 限制维度数量
  if (dimensions.length < 3) {
    console.warn(`[KnowledgeBuilder] 维度过少(${dimensions.length})，使用原始主题作为补充`)
    dimensions = [topic, ...dimensions]
  }
  dimensions = dimensions.slice(0, 8)

  // 构造默认映射（无关键词时用 topic + dimension 作为搜索查询）
  const mappings: DimensionKeywordMapping[] = dimensions.map(dim => ({
    dimension: dim,
    keywords: [],
    searchQueries: [`${topic} ${dim}`],
  }))

  console.log(`[KnowledgeBuilder] 维度拆分完成 — ${dimensions.length} 个维度: ${dimensions.join(', ')}`)

  return {
    dimensions,
    dimensionMappings: mappings,
    suggestedKeywords: [],
  }
}
