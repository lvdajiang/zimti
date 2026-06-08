/**
 * 知识库构建引擎 — 步骤0：评估与规划
 *
 * AI 评估主题的内容规模，自动生成构建方案。
 * 如果有蒸馏关键词，基于真实关键词推断维度；
 * 否则 AI 自行评估维度。
 *
 * 关键词与维度互相增强：
 * - 关键词 → 推断维度（基于真实搜索数据）
 * - 维度 → 发现盲区 → 补全缺失关键词
 */

import { getAIProvider } from '../ai/provider.js'
import type { DistilledKeywordHint } from '@zimti/shared'

export interface EvaluateInput {
  topic: string
  distilledKeywords?: DistilledKeywordHint[]
}

export interface DimensionPlan {
  dimension: string
  description: string
  estimatedItems: number
  infoDensity: 'high' | 'medium' | 'low'
  priority: number
  keywords: string[]
  supplementaryKeywords: string[]
}

export interface KeywordCoverage {
  totalKeywordsProvided: number
  coveredDimensions: number
  blindSpotDimensions: string[]
}

export interface BuildPlan {
  totalEstimatedItems: number
  totalDimensions: number
  estimatedTimeMinutes: number
  isLargeTopic: boolean
  strategy: 'full' | 'skeleton_then_fill'
  qualityStandard: {
    minContentLength: number
    targetContentLength: number
    maxContentLength: number
  }
  dimensions: DimensionPlan[]
  coverageGaps: string[]
  suggestions: string[]
  suggestedKeywords: string[]
  keywordCoverage: KeywordCoverage | null
}

/**
 * AI 评估主题规模并生成构建方案
 */
export async function runEvaluate(input: EvaluateInput): Promise<BuildPlan> {
  const { topic, distilledKeywords } = input

  const provider = getAIProvider()

  // 有蒸馏关键词 → 基于关键词推断维度
  if (distilledKeywords && distilledKeywords.length > 0) {
    return runEvaluateWithKeywords(provider, topic, distilledKeywords)
  }

  // 无蒸馏关键词 → AI 自行评估
  return runEvaluateWithoutKeywords(provider, topic)
}

/**
 * 有蒸馏关键词：基于真实关键词推断维度 + 发现盲区 + 补全关键词
 */
async function runEvaluateWithKeywords(
  provider: ReturnType<typeof getAIProvider>,
  topic: string,
  keywords: DistilledKeywordHint[],
): Promise<BuildPlan> {
  const keywordLines = keywords
    .slice(0, 30)
    .map((k, i) => `${i + 1}. "${k.keyword}" (意图:${k.intentType}, 评分:${k.totalScore}, 竞争度:${k.competition})`)
    .join('\n')

  const prompt = [
    '你是一个知识库规划专家。请基于以下真实搜索关键词，为知识库构建制定最优方案。',
    '',
    '## 主题',
    `"${topic}"`,
    '',
    `## 真实搜索关键词（来自热搜蒸馏，共 ${keywords.length} 个）`,
    keywordLines,
    '',
    '## 任务',
    '',
    '1. **维度推断**：将以上关键词聚类为 4-8 个维度。每个维度列出包含的关键词。',
    '2. **盲区发现**：识别该主题应该有但关键词没有覆盖的重要维度。',
    '3. **关键词补全**：为每个盲区维度建议 2-5 个补充搜索关键词。',
    '4. **规模判断**：根据维度和关键词总量评估总条数。',
    '   - 如果总预估条数 < 30：标记为小主题（"full"策略）',
    '   - 如果总预估条数 >= 30：标记为大主题（"skeleton_then_fill"策略）',
    '',
    '## 质量标准',
    '- 每条知识正文：300-600 字',
    '- 标签：3-5 个核心标签',
    '- 来源：必须引用真实 URL',
    '',
    '## 大主题策略（先骨架后填充）',
    '- 第一轮：每个维度生成 2-3 条核心知识',
    '- 后续轮：用户可手动触发增量更新',
    '',
    '请返回 JSON 格式的规划方案，包含以下字段：',
    'totalEstimatedItems, totalDimensions, estimatedTimeMinutes, isLargeTopic, strategy,',
    'qualityStandard { minContentLength, targetContentLength, maxContentLength },',
    'dimensions [{ dimension, description, estimatedItems, infoDensity, priority,',
    '  keywords(属于该维度的真实关键词数组), supplementaryKeywords(盲区补充关键词数组) }],',
    'coverageGaps(覆盖缺口描述数组), suggestions(建议数组),',
    'suggestedKeywords(所有盲区补充关键词的合并数组),',
    'keywordCoverage { totalKeywordsProvided, coveredDimensions, blindSpotDimensions }',
    '',
    '请严格返回 JSON，不要多余文字。',
  ].join('\n')

  return parseAndBuildPlan(provider, prompt, topic, keywords.length)
}

/**
 * 无蒸馏关键词：AI 自行评估维度
 */
async function runEvaluateWithoutKeywords(
  provider: ReturnType<typeof getAIProvider>,
  topic: string,
): Promise<BuildPlan> {
  const prompt = [
    '你是一个知识库规划专家。请评估以下主题的内容规模，制定最优的知识库构建方案。',
    '',
    '## 主题',
    `"${topic}"`,
    '',
    '## 评估要求',
    '',
    '1. **维度拆分**：将主题拆分为 4-8 个搜索维度',
    '2. **信息密度**：评估每个维度的信息密度（高/中/低）',
    '3. **优先级排序**：根据品牌 GEO 需求排序（1-10）',
    '4. **规模判断**：',
    '   - 总预估条数 < 30：小主题（"full"策略）',
    '   - 总预估条数 >= 30：大主题（"skeleton_then_fill"策略）',
    '',
    '请返回 JSON 格式的规划方案，包含以下字段：',
    'totalEstimatedItems, totalDimensions, estimatedTimeMinutes, isLargeTopic, strategy,',
    'qualityStandard { minContentLength, targetContentLength, maxContentLength },',
    'dimensions [{ dimension, description, estimatedItems, infoDensity, priority,',
    '  keywords(空数组), supplementaryKeywords(为该维度建议的搜索关键词,2-3个) }],',
    'coverageGaps, suggestions, suggestedKeywords(所有维度建议关键词的合并数组),',
    'keywordCoverage { totalKeywordsProvided:0, coveredDimensions:0, blindSpotDimensions:[] }',
    '',
    '请严格返回 JSON，不要多余文字。',
  ].join('\n')

  return parseAndBuildPlan(provider, prompt, topic, 0)
}

/**
 * 解析 AI 返回的 JSON 并构建 BuildPlan
 */
async function parseAndBuildPlan(
  provider: ReturnType<typeof getAIProvider>,
  prompt: string,
  topic: string,
  keywordCount: number,
): Promise<BuildPlan> {
  const result = await provider.generate(prompt, '你是知识库规划专家。返回 JSON 格式的规划方案。只返回 JSON，不要 markdown 代码块。')

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    const plan = JSON.parse(jsonMatch ? jsonMatch[0] : result)

    const totalItems = plan.totalEstimatedItems || 15
    return {
      totalEstimatedItems: totalItems,
      totalDimensions: plan.totalDimensions || 5,
      estimatedTimeMinutes: plan.estimatedTimeMinutes || 3,
      isLargeTopic: totalItems >= 30,
      strategy: totalItems >= 30 ? 'skeleton_then_fill' : 'full',
      qualityStandard: plan.qualityStandard || {
        minContentLength: 300,
        targetContentLength: 400,
        maxContentLength: 600,
      },
      dimensions: (plan.dimensions || []).map((d: Record<string, unknown>) => ({
        dimension: String(d.dimension || '未命名维度'),
        description: String(d.description || ''),
        estimatedItems: Number(d.estimatedItems) || 3,
        infoDensity: ['high', 'medium', 'low'].includes(String(d.infoDensity)) ? String(d.infoDensity) as 'high' | 'medium' | 'low' : 'medium' as const,
        priority: Number(d.priority) || 5,
        keywords: Array.isArray(d.keywords) ? d.keywords.map(String) : [],
        supplementaryKeywords: Array.isArray(d.supplementaryKeywords) ? d.supplementaryKeywords.map(String) : [],
      })),
      coverageGaps: Array.isArray(plan.coverageGaps) ? plan.coverageGaps.map(String) : [],
      suggestions: Array.isArray(plan.suggestions) ? plan.suggestions.map(String) : [],
      suggestedKeywords: Array.isArray(plan.suggestedKeywords) ? plan.suggestedKeywords.map(String) : [],
      keywordCoverage: plan.keywordCoverage || {
        totalKeywordsProvided: keywordCount,
        coveredDimensions: plan.dimensions?.length || 0,
        blindSpotDimensions: [],
      },
    }
  } catch {
    console.warn('[StepEvaluate] JSON 解析失败，使用降级方案')
    return buildFallbackPlan(topic, keywordCount)
  }
}

/**
 * 降级方案
 */
function buildFallbackPlan(topic: string, keywordCount: number): BuildPlan {
  return {
    totalEstimatedItems: 15,
    totalDimensions: 5,
    estimatedTimeMinutes: 3,
    isLargeTopic: false,
    strategy: 'full',
    qualityStandard: { minContentLength: 300, targetContentLength: 400, maxContentLength: 600 },
    dimensions: [
      { dimension: `${topic}攻略`, description: `${topic}相关的攻略和指南`, estimatedItems: 5, infoDensity: 'medium' as const, priority: 1, keywords: [], supplementaryKeywords: [`${topic}攻略推荐`, `${topic}旅行指南`] },
      { dimension: `${topic}路线`, description: `${topic}路线推荐`, estimatedItems: 3, infoDensity: 'medium' as const, priority: 2, keywords: [], supplementaryKeywords: [`${topic}最佳路线`, `${topic}自驾路线`] },
      { dimension: `${topic}美食`, description: `${topic}美食推荐`, estimatedItems: 3, infoDensity: 'medium' as const, priority: 3, keywords: [], supplementaryKeywords: [`${topic}特色美食`, `${topic}美食攻略`] },
      { dimension: `${topic}文化`, description: `${topic}文化特色`, estimatedItems: 2, infoDensity: 'medium' as const, priority: 4, keywords: [], supplementaryKeywords: [`${topic}文化体验`] },
      { dimension: `${topic}注意`, description: `${topic}注意事项`, estimatedItems: 2, infoDensity: 'low' as const, priority: 5, keywords: [], supplementaryKeywords: [`${topic}旅游注意事项`] },
    ],
    coverageGaps: [],
    suggestions: [],
    suggestedKeywords: [],
    keywordCoverage: { totalKeywordsProvided: keywordCount, coveredDimensions: 5, blindSpotDimensions: [] },
  }
}
