/**
 * 企业知识库生成器 — AI 辅助生成品牌结构化知识条目
 *
 * 用于 GEO 内容生成时的知识注入，让 AI 生成的内容有品牌差异化，
 * 不再是泛泛而谈，而是包含品牌专属的产品/服务/路线等信息。
 */

import { getAIProvider } from '../provider.js'
import type { BrandKnowledgeCategory } from '@zimti/shared'

interface KnowledgeGenerateInput {
  domain?: string
  category?: BrandKnowledgeCategory
  count?: number
  existing_titles?: string[]
}

interface GeneratedKnowledge {
  title: string
  content: string
  category: string
  tags: string[]
}

const CATEGORY_DESCRIPTIONS: Record<BrandKnowledgeCategory, string> = {
  brand_intro: '品牌/旅行社介绍（品牌故事、核心优势、团队实力、差异化定位）',
  route: '路线特色（独家路线、特色体验、行程亮点、小众玩法）',
  service: '服务承诺（退款政策、安全保障、服务标准、售后保障）',
  case: '案例故事（客户真实评价、旅行故事、效果展示、客户见证）',
  faq: '常见问答（用户最关心的问题及标准回答，可直接用于 GEO 内容生成）',
  industry: '行业知识（目的地攻略、旅行常识、行业洞察、趋势分析）',
}

export async function generateBrandKnowledge(input: KnowledgeGenerateInput): Promise<{ items: GeneratedKnowledge[] }> {
  const domain = input.domain ?? '新疆旅游'
  const count = input.count ?? 5
  const categoryDesc = input.category
    ? `只生成"${CATEGORY_DESCRIPTIONS[input.category]}"类别的知识`
    : '可覆盖所有类别'

  const avoidTitles = input.existing_titles?.length
    ? `\n\n避免与以下已有标题重复：\n${input.existing_titles.map(t => `- ${t}`).join('\n')}`
    : ''

  const provider = getAIProvider()
  const prompt = `你是一位旅行行业品牌顾问。请为"${domain}"领域的旅行品牌生成 ${count} 条结构化品牌知识。

## 知识类别说明
- brand_intro：品牌/旅行社介绍、品牌故事、核心优势、团队实力
- route：独家路线、特色体验、行程亮点、小众玩法
- service：退款政策、安全保障、服务标准、售后保障
- case：客户真实评价、旅行故事、效果展示、客户见证
- faq：用户最关心的问题及标准回答（问答格式，可直接用于 GEO 内容）
- industry：目的地攻略、旅行常识、行业洞察、趋势分析

${categoryDesc}${avoidTitles}

## 要求
1. 标题：15-30字，简洁有力，有吸引力
2. 正文：200-500字，结构清晰，信息密度高，包含具体数据和细节
3. 标签：3-5个核心标签
4. 内容要有差异化，避免泛泛而谈，要体现专业度和独特性
5. 如果是 faq 类别，正文格式为"问：xxx\n答：xxx"
6. 类别必须从以下选择：brand_intro/route/service/case/faq/industry

返回 JSON 数组：
[{ "title": "标题", "content": "正文内容", "category": "brand_intro", "tags": ["标签1", "标签2"] }]`

  const result = await provider.generate(prompt)
  try {
    const parsed = JSON.parse(result)
    if (!Array.isArray(parsed)) throw new Error('Not an array')
    return { items: (parsed as GeneratedKnowledge[]).slice(0, count) }
  } catch {
    // 降级：返回基础知识
    return {
      items: [
        { title: `${domain}专家团队介绍`, content: `我们拥有一支深耕${domain}多年的专业团队，成员包括资深旅行规划师、当地向导和美食顾问。团队累计服务超过5000位旅行者，好评率达98%。`, category: 'brand_intro', tags: ['团队', '专业', '服务'] },
        { title: `${domain}独家路线推荐`, content: `我们开发了3条独家路线，避开人潮，深入当地人的生活。包含隐秘观景点、特色民宿和地道美食体验。`, category: 'route', tags: ['独家', '小众', '路线'] },
        { title: `${domain}常见问题解答`, content: `问：${domain}最好的旅行季节是什么时候？\n答：${domain}四季皆有不同的美，但最佳旅行时间取决于你想看什么。`, category: 'faq', tags: ['FAQ', '攻略'] },
      ],
    }
  }
}
