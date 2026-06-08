/**
 * 关键词蒸馏生成器 — AI 评估关键词价值并输出高价值词列表
 *
 * 从大量原始搜索词中，AI 逐个评估搜索意图、竞争度、品牌相关性和内容机会，
 * 输出排序后的高价值关键词列表，附带评分和推荐理由。
 */

import { getAIProvider } from '../provider.js'

interface DistillInput {
  keywords: string[]
  domain: string
  brand_context?: string
}

interface DistillResult {
  keyword: string
  intent_type: string
  competition: string
  brand_relevance: number
  content_opportunity: number
  total_score: number
  recommendation: string
}

export async function distillKeywords(input: DistillInput): Promise<{ results: DistillResult[] }> {
  const { keywords, domain, brand_context } = input

  if (keywords.length === 0) return { results: [] }

  // 限制单次蒸馏最多 50 个关键词
  const batch = keywords.slice(0, 50)

  const brandSection = brand_context
    ? `\n## 品牌信息\n${brand_context}`
    : ''

  const provider = getAIProvider()
  const prompt = `你是一位 SEO 和 AI 搜索优化专家。请对以下关键词进行价值评估和蒸馏。

## 领域
${domain}
${brandSection}

## 待评估关键词（共 ${batch.length} 个）
${batch.map((kw, i) => `${i + 1}. ${kw}`).join('\n')}

## 评估维度
对每个关键词评估：
1. 搜索意图（informational=了解信息 / navigational=找具体地方 / transactional=要消费 / commercial=比较选择）
2. 竞争度（low=低 / medium=中 / high=高）：该词在 AI 搜索结果中的竞争激烈程度
3. 品牌相关性（0-100）：与我们品牌业务的相关程度
4. 内容机会（0-100）：我们创建优质内容的难易程度和潜在效果
5. 综合评分（0-100）：加权 = 品牌相关性×0.3 + 内容机会×0.4 + 竞争度反向分×0.3
   - 竞争度反向分：low=90, medium=60, high=30
6. 推荐理由（一句话，说明为什么值得做或放弃）

## 要求
1. 严格按综合评分从高到低排序
2. 评分要客观，不要所有词都给高分
3. 推荐理由要具体、可操作

返回 JSON 数组：
[{
  "keyword": "原始关键词",
  "intent_type": "informational",
  "competition": "low",
  "brand_relevance": 85,
  "content_opportunity": 90,
  "total_score": 88,
  "recommendation": "推荐理由"
}]`

  const result = await provider.generate(prompt)
  try {
    const parsed = JSON.parse(result)
    if (!Array.isArray(parsed)) throw new Error('Not an array')
    const results = (parsed as DistillResult[]).sort((a, b) => b.total_score - a.total_score)
    return { results }
  } catch {
    // 降级：为每个关键词生成基础评估
    return {
      results: batch.map(keyword => ({
        keyword,
        intent_type: 'informational' as const,
        competition: 'medium' as const,
        brand_relevance: 50,
        content_opportunity: 50,
        total_score: 50,
        recommendation: '自动评估，建议人工复核',
      })),
    }
  }
}
