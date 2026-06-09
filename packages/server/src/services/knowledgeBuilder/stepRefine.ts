/**
 * 步骤5: 原子事实提炼
 *
 * 将搜索结果分解为独立的、可验证的原子事实。
 * 每条事实 1-2 句话（≤100 字），不含主观评价。
 * 一条搜索结果可能产出多条事实。
 *
 * 批量处理（5条/批，避免 token 超限）。
 */

import { getAIProvider } from '../ai/provider.js'
import type { BrandKnowledgeCategory, FactType } from '@zimti/shared'
import type { MergedItem } from './stepSemanticDedup.js'

export interface RefinedItem {
  id: string
  title: string
  content: string              // 1-2 句话，原子事实
  category: BrandKnowledgeCategory
  tags: string[]
  sourceUrls: string[]
  credibility: number
  needsReview: boolean
  reviewNotes: string
  factType: FactType
  needsVerification: boolean
}

export interface RefineInput {
  items: MergedItem[]
  topic: string
}

export interface RefineOutput {
  refined: RefinedItem[]
}

const VALID_CATEGORIES: BrandKnowledgeCategory[] = [
  'brand_intro', 'route', 'service', 'case', 'faq', 'industry',
]
const VALID_FACT_TYPES: FactType[] = ['definition', 'statistic', 'procedure', 'tip', 'warning', 'comparison']

const REFINE_BATCH_SIZE = 5

/**
 * 批量分解为原子事实
 */
async function refineBatch(
  items: MergedItem[],
  topic: string,
): Promise<RefinedItem[]> {
  const ai = getAIProvider()

  const itemsText = items.map((item, i) => {
    return `--- 搜索结果 ${i + 1} ---
内容: ${item.content}
来源URL: ${item.sourceUrls.join(', ') || '无'}
可信度: ${item.credibility}
初步分类: ${item.category || '未分类'}`
  }).join('\n\n')

  const prompt = `你是一个事实分解专家。主题是"${topic}"。

请将以下 ${items.length} 条搜索结果分解为独立的原子事实。

${itemsText}

原子事实标准：
- 长度：1-2句话（不超过100字），一条就是一个数据点
- 客观：不含主观评价、推测、修辞
- 独立：删除任何一条不影响其他条的可读性
- 可验证：每条事实都能通过搜索引擎独立验证
- 具体性：包含具体数字、地名、时间、名称等

不要提取：
- 主观评价（"风景很美"、"体验很好"）
- 纯建议（除非原文明确说"最佳时间是X月"）
- 重复信息

事实类型分类：
- definition: 定义/定性描述（如"某地属于某气候带"）
- statistic: 数字/统计数据（如"两地相距570公里"）
- procedure: 流程/步骤（如"景区需要提前预约"）
- tip: 实用建议（如"最佳旅行时间是X月"）
- warning: 注意事项/禁忌（如"海拔4000米以上注意高反"）
- comparison: 对比（如"A路线比B路线快2小时"）

每条搜索结果可能产出 0-5 条事实。如果内容全是主观评价，可以返回空数组。

返回 JSON 数组：
[{
  "sourceIndex": 1,
  "content": "原子事实（1-2句话）",
  "factType": "statistic",
  "category": "route",
  "tags": ["标签"],
  "needsVerification": true,
  "needsReview": false,
  "reviewNotes": ""
}]

只返回 JSON，不要其他文字。`

  try {
    const response = await ai.generate(prompt, '你是事实分解专家。只返回 JSON。')
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('未找到 JSON 数组')

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      sourceIndex: number
      content: string
      factType: string
      category: string
      tags: string[]
      needsVerification: boolean
      needsReview: boolean
      reviewNotes: string
    }>

    const results: RefinedItem[] = []
    for (const f of parsed) {
      const sourceItem = items[f.sourceIndex - 1] ?? items[0]
      const category = VALID_CATEGORIES.includes(f.category as BrandKnowledgeCategory)
        ? (f.category as BrandKnowledgeCategory)
        : 'industry'
      const factType = VALID_FACT_TYPES.includes(f.factType as FactType)
        ? (f.factType as FactType)
        : 'definition'

      results.push({
        id: `${sourceItem.id}-${results.length}`,
        title: (f.content || sourceItem.content).slice(0, 200),
        content: f.content || sourceItem.content.slice(0, 100),
        category,
        tags: Array.isArray(f.tags) ? f.tags.slice(0, 5) : [],
        sourceUrls: sourceItem.sourceUrls,
        credibility: sourceItem.credibility,
        needsReview: f.needsReview ?? false,
        reviewNotes: f.reviewNotes || '',
        factType,
        needsVerification: f.needsVerification ?? false,
      })
    }

    return results.length > 0 ? results : items.map(item => ({
      id: item.id,
      title: item.content.slice(0, 200),
      content: item.content.slice(0, 100),
      category: (VALID_CATEGORIES.includes(item.category as BrandKnowledgeCategory)
        ? item.category as BrandKnowledgeCategory : 'industry'),
      tags: [],
      sourceUrls: item.sourceUrls,
      credibility: item.credibility,
      needsReview: true,
      reviewNotes: 'AI分解返回空结果，保留原始摘要',
      factType: 'definition' as FactType,
      needsVerification: true,
    }))
  } catch (err) {
    console.warn(
      `[KnowledgeBuilder] 事实分解 JSON 解析失败: ${err instanceof Error ? err.message : err}，降级保留原始内容`
    )
    return items.map(item => ({
      id: item.id,
      title: item.content.slice(0, 200),
      content: item.content.slice(0, 100),
      category: (VALID_CATEGORIES.includes(item.category as BrandKnowledgeCategory)
        ? item.category as BrandKnowledgeCategory : 'industry'),
      tags: [],
      sourceUrls: item.sourceUrls,
      credibility: item.credibility,
      needsReview: true,
      reviewNotes: 'AI分解失败，需要人工审核',
      factType: 'definition' as FactType,
      needsVerification: true,
    }))
  }
}

/**
 * 执行原子事实提炼
 */
export async function runRefine(input: RefineInput): Promise<RefineOutput> {
  const { items, topic } = input

  console.log(`[KnowledgeBuilder] 事实提炼 — ${items.length} 条搜索结果, 主题: "${topic}"`)

  const allRefined: RefinedItem[] = []

  // 分批处理
  for (let i = 0; i < items.length; i += REFINE_BATCH_SIZE) {
    const batch = items.slice(i, i + REFINE_BATCH_SIZE)
    const batchResults = await refineBatch(batch, topic)
    allRefined.push(...batchResults)

    if (i + REFINE_BATCH_SIZE < items.length) {
      console.log(`[KnowledgeBuilder] 事实提炼 — 已处理 ${Math.min(i + REFINE_BATCH_SIZE, items.length)}/${items.length}`)
    }
  }

  const reviewCount = allRefined.filter(r => r.needsReview).length
  console.log(`[KnowledgeBuilder] 事实提炼完成 — 共 ${allRefined.length} 条原子事实, 需人工审核 ${reviewCount} 条`)

  return { refined: allRefined }
}
