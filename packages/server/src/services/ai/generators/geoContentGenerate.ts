/**
 * GEO 内容生成器 — 生成 EEAT 标准的 AI 搜索优化内容
 *
 * 为每个意图问题生成高质量的回答内容，
 * 包含 FAQ Schema 标记，便于 AI 搜索引擎引用。
 */

import { getAIProvider } from '../provider.js'

interface ContentGenerateInput {
  question_id: string
  question_text: string
  category: string
  domain?: string
  brand_context?: string
}

interface ContentGenerateResult {
  title: string
  content: string
  schema_markup: Record<string, unknown>
  keywords: string[]
  eeat_score: number
}

export async function generateGeoContent(input: ContentGenerateInput): Promise<ContentGenerateResult> {
  const domain = input.domain ?? '新疆旅游'
  const provider = getAIProvider()

  const prompt = `你是一位旅行领域的内容专家，擅长撰写被 AI 搜索引擎引用的高质量内容。

## 任务
为以下问题撰写一篇详细的回答，目标是让豆包、DeepSeek、Kimi 等 AI 搜索引擎优先引用你的内容。

## 问题
"${input.question_text}"（分类：${input.category}）
${input.brand_context ? `品牌背景：${input.brand_context}` : ''}
领域：${domain}

## EEAT 标准（必须严格遵循）
- **Experience（经验）**：用第一人称经验语调，提及具体场景和个人感受，避免"据说""有人说"
- **Expertise（专业性）**：提供具体数据、事实、对比，如价格范围、距离、时间、推荐指数
- **Authoritativeness（权威性）**：使用确定性语言，适当引用标准或官方信息
- **Trustworthiness（可信度）**：客观评价，包含优缺点，不夸大不隐瞒

## 要求
1. 标题：简洁有力，包含核心关键词，15-30字
2. 正文：500-1500字，结构清晰（分段+小标题），信息密度高
3. 关键词：提取3-8个核心关键词
4. 自评 EEAT 分数（0-100）
5. 生成 FAQ Schema 标记（JSON-LD 格式）

返回 JSON 对象：
{
  "title": "标题",
  "content": "正文内容（支持换行）",
  "keywords": ["关键词1", "关键词2"],
  "eeat_score": 85,
  "schema_markup": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [{
      "@type": "Question",
      "name": "问题",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "答案"
      }
    }]
  }
}`

  const result = await provider.generate(prompt)
  try {
    const parsed = JSON.parse(result) as ContentGenerateResult
    return {
      title: parsed.title ?? input.question_text,
      content: parsed.content ?? '',
      schema_markup: parsed.schema_markup ?? generateDefaultSchema(input.question_text, ''),
      keywords: parsed.keywords ?? [],
      eeat_score: parsed.eeat_score ?? 70,
    }
  } catch {
    return {
      title: input.question_text,
      content: `关于"${input.question_text}"的详细解答正在生成中。`,
      schema_markup: generateDefaultSchema(input.question_text, ''),
      keywords: [domain, input.category],
      eeat_score: 50,
    }
  }
}

/** 批量生成（返回按 question_id 索引的结果） */
export async function batchGenerateGeoContent(
  items: ContentGenerateInput[],
): Promise<Record<string, ContentGenerateResult>> {
  const results: Record<string, ContentGenerateResult> = {}
  for (const item of items) {
    results[item.question_id] = await generateGeoContent(item)
  }
  return results
}

function generateDefaultSchema(question: string, answer: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    }],
  }
}
