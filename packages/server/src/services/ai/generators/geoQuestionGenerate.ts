/**
 * GEO 问题生成器 — AI 批量生成用户可能在 AI 搜索引擎中提问的问题
 *
 * 用于构建"意图问题库"，是 GEO（Generative Engine Optimization）的第一步。
 * 生成的质量问题将被 AI 搜索引擎用户搜索到。
 */

import { getAIProvider } from '../provider.js'
import type { GeoQuestionCategory } from '@zimti/shared'

interface QuestionGenerateInput {
  domain?: string
  category?: GeoQuestionCategory
  count?: number
}

interface GeneratedQuestion {
  question: string
  category: string
  intent_type: string
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  route: '路线规划（行程安排、交通方式、景点串联）',
  food: '美食推荐（特色美食、餐厅推荐、饮食攻略）',
  season: '季节时令（最佳旅行时间、季节性景观、天气穿衣）',
  budget: '预算费用（旅行花费、性价比、省钱攻略）',
  tips: '实用攻略（注意事项、必备物品、安全提醒）',
  general: '综合（不限主题的旅行相关问题）',
}

export async function generateGeoQuestions(input: QuestionGenerateInput): Promise<{ questions: GeneratedQuestion[] }> {
  const domain = input.domain ?? '新疆旅游'
  const count = input.count ?? 10
  const categoryDesc = input.category
    ? `只生成"${CATEGORY_DESCRIPTIONS[input.category] ?? input.category}"类别的问题`
    : '覆盖所有类别'

  const provider = getAIProvider()
  const prompt = `你是一位 SEO 和 AI 搜索优化专家。请生成 ${count} 个关于"${domain}"的问题。

这些问题是用户在 AI 搜索引擎（如豆包、DeepSeek、Kimi、ChatGPT）中可能提问的真实问题。
${categoryDesc}

## 要求
1. 问题必须是用户真实会搜的，口语化、具体、有场景感
2. 避免过于宽泛的问题（如"新疆怎么样"），要精准（如"6月去伊犁看薰衣草住哪里最方便"）
3. 每个问题标注类别和意图类型
4. 类别范围：route/food/season/budget/tips/general
5. 意图类型：informational（了解信息）、navigational（找具体地方）、transactional（要消费）、commercial（比较选择）

返回 JSON 数组：
[{ "question": "...", "category": "route", "intent_type": "informational" }]`

  const result = await provider.generate(prompt)
  try {
    const parsed = JSON.parse(result) as GeneratedQuestion[]
    return { questions: parsed.slice(0, count) }
  } catch {
    // 降级：返回基础问题
    return {
      questions: [
        { question: `${domain}第一次去怎么安排路线最合理？`, category: 'route', intent_type: 'informational' },
        { question: `${domain}有什么必吃的美食推荐？`, category: 'food', intent_type: 'informational' },
        { question: `${domain}什么时候去最好？`, category: 'season', intent_type: 'informational' },
        { question: `${domain}一个人大概要花多少钱？`, category: 'budget', intent_type: 'transactional' },
        { question: `去${domain}有哪些注意事项？`, category: 'tips', intent_type: 'informational' },
      ],
    }
  }
}
