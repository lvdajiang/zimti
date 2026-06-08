/**
 * 全网搜索知识提取生成器 — 一键搜索+AI提取结构化知识
 *
 * 架构：
 * 方案A（优先）：直接通过 GLM 原生 API 调用 web_search 工具，
 *   让模型在搜索的同时生成结构化知识条目（一步完成）。
 * 方案B（降级）：先调用 SearXNG 搜索，再将结果喂给 AI 提取。
 */

import { getAIProvider } from '../provider.js'
import { searchWeb, type SearchResult } from '../../webSearch.js'
import type { BrandKnowledgeCategory } from '@zimti/shared'

export interface WebKnowledgeBuildInput {
  topic: string
  category?: BrandKnowledgeCategory
  count?: number
  existingTitles?: string[]
}

export interface ExtractedKnowledge {
  title: string
  content: string
  category: BrandKnowledgeCategory
  tags: string[]
  source_url: string
  confidence: number
}

export interface WebKnowledgeBuildResult {
  searchResults: SearchResult[]
  knowledgeItems: ExtractedKnowledge[]
}

const CATEGORY_DESCRIPTIONS: Record<BrandKnowledgeCategory, string> = {
  brand_intro: '品牌介绍、品牌故事、核心优势、团队实力、差异化定位',
  route: '路线特色、独家路线、特色体验、行程亮点、小众玩法',
  service: '服务承诺、退款政策、安全保障、服务标准、售后保障',
  case: '客户真实评价、旅行故事、效果展示、客户见证',
  faq: '常见问答、用户最关心的问题及标准回答',
  industry: '行业知识、目的地攻略、旅行常识、行业洞察、趋势分析',
}

/**
 * 从全网搜索中构建知识条目
 * 优先使用 GLM 原生 web_search 一步生成
 */
export async function buildKnowledgeFromWeb(input: WebKnowledgeBuildInput): Promise<WebKnowledgeBuildResult> {
  const topic = input.topic
  const count = input.count ?? 5

  // ===== 方案A：GLM web_search 一步生成 =====
  try {
    const apiKey = process.env.GLM_API_KEY
    if (apiKey) {
      const result = await buildViaGLMOneStep(topic, count, input)
      if (result.knowledgeItems.length > 0) {
        return result
      }
      console.warn('[WebKnowledgeBuild] GLM 一步生成返回空，尝试降级方案')
    }
  } catch (err) {
    console.warn(`[WebKnowledgeBuild] GLM 一步生成失败: ${err instanceof Error ? err.message : err}`)
  }

  // ===== 方案B：搜索 + AI 提取（降级） =====
  return buildViaSearchAndExtract(topic, count, input)
}

/**
 * 方案A：GLM web_search 一步生成
 * 通过 GLM 原生 chat/completions API，让模型搜索后直接输出结构化知识
 */
async function buildViaGLMOneStep(
  topic: string,
  count: number,
  input: WebKnowledgeBuildInput,
): Promise<WebKnowledgeBuildResult> {
  const apiKey = process.env.GLM_API_KEY!
  const baseUrl = process.env.GLM_NATIVE_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4'
  const model = process.env.GLM_WEB_SEARCH_MODEL ?? 'glm-4-flash'

  const avoidTitles = input.existingTitles?.length
    ? `\n\n⚠️ 避免与以下已有知识标题重复：\n${input.existingTitles.slice(0, 20).map(t => `- ${t}`).join('\n')}`
    : ''

  const categoryHint = input.category
    ? `只生成"${CATEGORY_DESCRIPTIONS[input.category]}"类别的知识`
    : '从所有类别中选择最合适的分类'

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `你是一个品牌知识库建设专家。请先使用 web_search 工具搜索相关信息，然后基于搜索结果，生成结构化的知识条目。
${categoryHint}。
${avoidTitles}

分类说明：
- brand_intro：${CATEGORY_DESCRIPTIONS.brand_intro}
- route：${CATEGORY_DESCRIPTIONS.route}
- service：${CATEGORY_DESCRIPTIONS.service}
- case：${CATEGORY_DESCRIPTIONS.case}
- faq：${CATEGORY_DESCRIPTIONS.faq}
- industry：${CATEGORY_DESCRIPTIONS.industry}

## ⚠️ 关键要求（必须严格遵守）
1. 标题：15-30字，简洁有力，具体不泛化
2. **正文必须达到 300-600 字**，这是硬性要求！
   - 包含具体的数字、地点、时间、价格等细节
   - 包含实用的建议和操作指南
   - 分段论述，不要一整段
   - 宁可详细也不要简略
3. 综合搜索结果信息，提炼有深度的知识，不要简单复制
4. 每条知识要有独特性和实用价值
5. content 字段的字符数不能少于 200

返回纯 JSON 数组，不要 markdown 代码块：
[{"title":"标题","content":"详细正文（300-600字）","category":"route","tags":["标签1","标签2"],"confidence":0.85}]`,
        },
        { role: 'user', content: `请搜索"${topic}"相关信息，生成 ${count} 条详细的结构化知识条目。注意：每条正文字数必须达到 300 字以上，要有具体细节和实用建议。` },
      ],
      tools: [{ type: 'web_search', web_search: { enable: true } }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GLM API 错误: ${response.status} ${text}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content?: string } }>
  }

  const textContent = data.choices?.[0]?.message?.content
  if (!textContent) return { searchResults: [], knowledgeItems: [] }

  // 解析 AI 返回的 JSON
  const knowledgeItems = parseKnowledgeJSON(textContent, count)
  // 标记为 GLM 来源
  const searchResults: SearchResult[] = knowledgeItems.map(k => ({
    title: k.title,
    url: k.source_url,
    snippet: k.content.slice(0, 100),
    source: 'glm' as const,
  }))

  return { searchResults, knowledgeItems }
}

/**
 * 方案B：先搜索，再让 AI 提取
 */
async function buildViaSearchAndExtract(
  topic: string,
  count: number,
  input: WebKnowledgeBuildInput,
): Promise<WebKnowledgeBuildResult> {
  const searchResults = await searchWeb(topic, 15)
  if (searchResults.length === 0) {
    return { searchResults: [], knowledgeItems: [] }
  }

  const searchDigest = searchResults
    .map((r, i) => {
      let entry = `[${i + 1}] ${r.title}`
      if (r.url) entry += `\n    URL: ${r.url}`
      entry += `\n    摘要: ${r.snippet}`
      return entry
    })
    .join('\n\n')

  const avoidTitles = input.existingTitles?.length
    ? `\n\n⚠️ 避免与以下已有知识标题重复：\n${input.existingTitles.slice(0, 20).map(t => `- ${t}`).join('\n')}`
    : ''

  const categoryHint = input.category
    ? `只生成"${CATEGORY_DESCRIPTIONS[input.category]}"类别的知识`
    : '从所有类别中选择最合适的分类'

  const provider = getAIProvider()
  const prompt = `你是品牌知识库建设专家。以下是关于"${topic}"的搜索结果。

## 搜索结果
${searchDigest}
${avoidTitles}

请提取 ${count} 条有价值的知识条目。${categoryHint}。
标题15-30字，正文200-500字，标签3-5个，confidence 0-1。

返回纯 JSON 数组：
[{"title":"标题","content":"正文","category":"route","tags":["标签1"],"source_url":"","confidence":0.85}]`

  const result = await provider.generate(prompt, '返回 JSON 格式的知识条目数组。')

  const knowledgeItems = parseKnowledgeJSON(result, count)
  return { searchResults, knowledgeItems }
}

/**
 * 解析 AI 返回的 JSON 知识条目（容错处理）
 */
function parseKnowledgeJSON(text: string, count: number): ExtractedKnowledge[] {
  // 尝试提取 JSON 数组（支持 markdown 代码块包裹）
  let jsonStr = text
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed)) {
      return (parsed as ExtractedKnowledge[]).slice(0, count).map(item => ({
        title: String(item.title || '未命名知识'),
        content: String(item.content || ''),
        category: validateCategory(item.category),
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        source_url: String(item.source_url || ''),
        confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.7,
      }))
    }
  } catch {
    console.warn('[WebKnowledgeBuild] JSON 解析失败，尝试宽松解析')
  }

  // 降级：逐行提取（当 AI 没有返回严格 JSON 时）
  const items: ExtractedKnowledge[] = []
  const segments = text.split(/(?=\n###|\n\d+\.|\n\[{)/).filter(s => s.trim().length > 50)
  for (const seg of segments.slice(0, count)) {
    const lines = seg.trim().split('\n').filter(Boolean)
    const title = lines[0].replace(/^#+\s*|\d+\.\s*|\[|\]/g, '').trim().slice(0, 50)
    const content = lines.slice(1).join('\n').trim().slice(0, 500)
    if (title && content.length > 30) {
      items.push({
        title,
        content,
        category: 'industry',
        tags: [],
        source_url: '',
        confidence: 0.6,
      })
    }
  }
  return items
}

function validateCategory(cat: unknown): BrandKnowledgeCategory {
  const valid: BrandKnowledgeCategory[] = ['brand_intro', 'route', 'service', 'case', 'faq', 'industry']
  if (typeof cat === 'string' && valid.includes(cat as BrandKnowledgeCategory)) {
    return cat as BrandKnowledgeCategory
  }
  return 'industry'
}
