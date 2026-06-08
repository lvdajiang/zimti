/**
 * 步骤5: AI 完善
 *
 * 对每条知识进行交叉验证、补充细节、统一格式（300-600字）、
 * 分类、标签提取。
 *
 * 采用 self-refine 策略：先生成初稿再审视改进。
 * 批量处理（5条/批，避免 token 超限）。
 */

import { getAIProvider } from '../ai/provider.js'
import type { BrandKnowledgeCategory } from '@zimti/shared'
import type { MergedItem } from './stepSemanticDedup.js'

export interface RefinedItem {
  id: string
  title: string
  content: string
  category: BrandKnowledgeCategory
  tags: string[]
  sourceUrls: string[]
  credibility: number
  needsReview: boolean
  reviewNotes: string
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

const REFINE_BATCH_SIZE = 5

/**
 * 批量完善知识条目
 */
async function refineBatch(
  items: MergedItem[],
  topic: string,
): Promise<RefinedItem[]> {
  const ai = getAIProvider()

  const itemsText = items.map((item, i) => {
    return `--- 条目 ${i + 1} ---
原始标题: ${item.title}
原始内容: ${item.content}
来源URL: ${item.sourceUrls.join(', ') || '无'}
可信度: ${item.credibility}
初步分类: ${item.category || '未分类'}`
  }).join('\n\n')

  const prompt = `你是一个专业知识编辑。主题是"${topic}"。请对以下 ${items.length} 条知识进行完善。

${itemsText}

要求：
1. 交叉验证：如果信息存在矛盾或不完整，请标注 needsReview=true 并说明
2. 补充细节：适当补充实用细节，使内容更有价值
3. 统一格式：每条 300-600 字，结构清晰（有标题、要点、结论）
4. 分类：从以下分类中选择最合适的 — brand_intro(产品介绍), route(路线特色), service(服务承诺), case(案例故事), faq(常见问答), industry(行业知识)
5. 标签：提取 2-5 个标签词

返回 JSON 数组，每项：
{
  "index": 1,
  "title": "完善后的标题",
  "content": "完善后的内容（300-600字）",
  "category": "分类",
  "tags": ["标签1", "标签2"],
  "needsReview": false,
  "reviewNotes": "如果有问题需要人工审核，说明原因；否则为空字符串"
}

只返回 JSON，不要其他文字。`

  try {
    const response = await ai.generate(prompt)
    const jsonMatch = response.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) throw new Error('未找到 JSON 数组')

    const refined = JSON.parse(jsonMatch[0]) as Array<{
      index: number
      title: string
      content: string
      category: string
      tags: string[]
      needsReview: boolean
      reviewNotes: string
    }>

    return items.map((item, i) => {
      const r = refined[i] ?? {}
      const category = VALID_CATEGORIES.includes(r.category as BrandKnowledgeCategory)
        ? (r.category as BrandKnowledgeCategory)
        : 'industry'

      return {
        id: item.id,
        title: r.title || item.title,
        content: r.content || item.content,
        category,
        tags: Array.isArray(r.tags) ? r.tags.slice(0, 5) : [],
        sourceUrls: item.sourceUrls,
        credibility: item.credibility,
        needsReview: r.needsReview ?? false,
        reviewNotes: r.reviewNotes || '',
      }
    })
  } catch (err) {
    console.warn(
      `[KnowledgeBuilder] AI完善 JSON 解析失败: ${err instanceof Error ? err.message : err}，降级保留原始内容`
    )
    return items.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: (VALID_CATEGORIES.includes(item.category as BrandKnowledgeCategory)
        ? item.category as BrandKnowledgeCategory
        : 'industry'),
      tags: [],
      sourceUrls: item.sourceUrls,
      credibility: item.credibility,
      needsReview: true,
      reviewNotes: 'AI完善失败，需要人工审核',
    }))
  }
}

/**
 * 执行 AI 完善
 */
export async function runRefine(input: RefineInput): Promise<RefineOutput> {
  const { items, topic } = input

  console.log(`[KnowledgeBuilder] AI完善 — ${items.length} 条待完善, 主题: "${topic}"`)

  const allRefined: RefinedItem[] = []

  // 分批处理
  for (let i = 0; i < items.length; i += REFINE_BATCH_SIZE) {
    const batch = items.slice(i, i + REFINE_BATCH_SIZE)
    const batchResults = await refineBatch(batch, topic)
    allRefined.push(...batchResults)

    if (i + REFINE_BATCH_SIZE < items.length) {
      console.log(`[KnowledgeBuilder] AI完善 — 已处理 ${Math.min(i + REFINE_BATCH_SIZE, items.length)}/${items.length}`)
    }
  }

  const reviewCount = allRefined.filter(r => r.needsReview).length
  console.log(`[KnowledgeBuilder] AI完善完成 — 共 ${allRefined.length} 条, 需人工审核 ${reviewCount} 条`)

  return { refined: allRefined }
}
