/**
 * 发布关键词提取器 — 从视频内容中提取并评分关键词
 *
 * 基于视频标题、描述、脚本文本，AI 提取候选关键词并评分排序，
 * 输出推荐标签列表供用户在发布前一键采纳。
 */

import { getAIProvider } from '../provider.js'

export interface PublishKeywordInput {
  title: string
  description: string
  script_text: string
  existing_tags: string[]
  brand_context?: string
  domain?: string
}

export interface ScoredKeyword {
  keyword: string
  total_score: number
  competition: 'low' | 'medium' | 'high'
  brand_relevance: number
  content_opportunity: number
  recommendation: string
}

export interface PublishKeywordResult {
  extracted_keywords: ScoredKeyword[]
  suggested_tags: string[]
}

export async function extractPublishKeywords(
  input: PublishKeywordInput,
): Promise<PublishKeywordResult> {
  const { title, description, script_text, existing_tags, brand_context, domain } = input
  const domainLabel = domain ?? '短视频'

  const brandSection = brand_context
    ? `\n## 品牌信息\n${brand_context}`
    : ''

  const existingSection = existing_tags.length > 0
    ? `\n## 已有标签\n${existing_tags.join('、')}`
    : ''

  // 脚本文本截取前 500 字避免过长
  const scriptExcerpt = script_text.slice(0, 500)

  const provider = getAIProvider()
  const prompt = `你是一位 SEO 和短视频运营专家。请从以下视频内容中提取关键词并评估价值。

## 领域
${domainLabel}
${brandSection}
${existingSection}

## 视频内容
- 标题：${title || '无'}
- 描述：${description || '无'}
- 脚本文本（节选）：${scriptExcerpt || '无'}

## 任务
1. 从内容中提取 10-15 个候选关键词/标签
2. 对每个关键词评估：
   - 竞争度（low=低 / medium=中 / high=高）
   - 品牌相关性（0-100）：与视频主题的相关程度
   - 内容机会（0-100）：该标签带来流量的潜力
   - 综合评分（0-100）：加权 = 品牌相关性×0.3 + 内容机会×0.4 + 竞争度反向分×0.3
   - 推荐理由（一句话）
3. 按综合评分从高到低排序

## 要求
- 标签要适合短视频平台（抖音、小红书、视频号等）
- 包含一些热门流量词和长尾精准词
- 不要重复已有标签

返回 JSON 对象：
{
  "keywords": [{
    "keyword": "关键词",
    "competition": "low",
    "brand_relevance": 85,
    "content_opportunity": 90,
    "total_score": 88,
    "recommendation": "推荐理由"
  }]
}`

  const result = await provider.generate(prompt)
  try {
    const parsed = JSON.parse(result) as { keywords?: ScoredKeyword[] }
    if (!Array.isArray(parsed.keywords)) throw new Error('Invalid format')

    const extracted_keywords = parsed.keywords
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, 15)

    const suggested_tags = extracted_keywords
      .filter(k => k.total_score >= 50)
      .slice(0, 8)
      .map(k => k.keyword)

    return { extracted_keywords, suggested_tags }
  } catch {
    // 降级：从标题和描述中提取基础标签
    const fallbackKeywords = extractFallbackKeywords(title, description, existing_tags)
    return {
      extracted_keywords: fallbackKeywords.map(kw => ({
        keyword: kw,
        total_score: 50,
        competition: 'medium' as const,
        brand_relevance: 50,
        content_opportunity: 50,
        recommendation: '自动提取，建议人工复核',
      })),
      suggested_tags: fallbackKeywords.slice(0, 8),
    }
  }
}

/** 降级方案：从文本中提取基础关键词 */
function extractFallbackKeywords(
  title: string,
  description: string,
  existing_tags: string[],
): string[] {
  const text = `${title} ${description}`
  const existing = new Set(existing_tags)
  // 简单分词：按空格和标点分割，取 2-6 字的片段
  const segments = text
    .split(/[\s,，。！？、；：""''（）\[\]{}]+/)
    .filter(s => s.length >= 2 && s.length <= 6 && !existing.has(s))
  // 去重并取前 10 个
  return [...new Set(segments)].slice(0, 10)
}
