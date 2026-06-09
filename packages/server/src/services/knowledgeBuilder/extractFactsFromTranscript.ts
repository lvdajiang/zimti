/**
 * 从文案/转录文本中提取原子事实
 *
 * 输入一段文本（如视频号文案），AI 分解为独立的、可验证的原子事实。
 */

import { getAIProvider } from '../ai/provider.js'
import type { FactType } from '@zimti/shared'

export interface AtomicFact {
  content: string            // 1-2 句话，原子事实本身
  factType: FactType
  confidence: number         // 0-1
  factContext: string        // 原文中的相关句子（溯源）
  sourceUrls: string[]       // 空（transcript 来源无 URL，验证后填充）
  tags: string[]
  needsVerification: boolean // confidence < 0.7 或 statistic 类型
}

export interface ExtractFactsInput {
  transcript: string
  topic?: string
  maxFacts?: number
}

export interface ExtractFactsOutput {
  facts: AtomicFact[]
  totalCount: number
  topic: string
}

const EXTRACT_BATCH_SIZE = 3000 // 每批次最大字符数
const VALID_FACT_TYPES: FactType[] = ['definition', 'statistic', 'procedure', 'tip', 'warning', 'comparison']

export async function extractFactsFromTranscript(input: ExtractFactsInput): Promise<ExtractFactsOutput> {
  const { transcript, topic, maxFacts = 80 } = input
  const ai = getAIProvider()

  const chunks = chunkTranscript(transcript, EXTRACT_BATCH_SIZE)
  const allFacts: AtomicFact[] = []

  for (const chunk of chunks) {
    if (allFacts.length >= maxFacts) break

    const topicHint = topic ? `主题是「${topic}」。` : ''
    const prompt = `你是一个事实提取专家。${topicHint}

请从以下文本中提取所有客观、可验证的原子事实。

原子事实标准：
- 长度：1-2句话（不超过100字）
- 客观性：不含主观评价、感受、推测、修辞
- 可验证性：是独立的事实陈述，可通过搜索确认或否认
- 具体性：包含具体数字、地名、时间、名称等

好的例子：
- "乌鲁木齐到阿勒泰约570公里" → statistic
- "赛里木湖环湖全程约92公里" → statistic
- "独库公路每年6月到10月开放" → definition
- "景区需要提前预约购票" → procedure
- "海拔4000米以上可能出现高反" → warning

坏的例子（不要提取）：
- "风景太美了" → 主观感受
- "建议秋天去" → 建议不是事实（除非原文说"最佳旅行时间是X月"）
- "体验很棒" → 主观评价

事实类型：definition | statistic | procedure | tip | warning | comparison

文本内容：
---
${chunk}
---

返回 JSON 数组，每项格式：
{ "content": "事实内容", "factType": "statistic", "confidence": 0.85, "factContext": "原文中的相关句子", "needsVerification": true, "tags": ["标签1"] }

只返回 JSON 数组，不要其他文字。`

    try {
      const response = await ai.generate(prompt, '你是事实提取专家。只返回 JSON。')
      const parsed = parseFactsJSON(response)

      for (const item of parsed) {
        if (allFacts.length >= maxFacts) break
        allFacts.push({
          content: (item.content || '').slice(0, 200),
          factType: (VALID_FACT_TYPES as readonly string[]).includes(item.factType) ? (item.factType as FactType) : 'definition' as FactType,
          confidence: clamp01(Number(item.confidence) || 0.5),
          factContext: item.factContext || '',
          sourceUrls: [],
          tags: Array.isArray(item.tags) ? item.tags.slice(0, 5).map(String) : [],
          needsVerification: item.needsVerification ?? false,
        })
      }
    } catch (err) {
      console.warn(`[FactExtract] AI 返回解析失败:`, err instanceof Error ? err.message : err)
    }
  }

  return { facts: allFacts, totalCount: allFacts.length, topic: topic || '' }
}

/** 按句子分段，避免超过 token 限制 */
function chunkTranscript(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const chunks: string[] = []
  const sentences = text.split(/[。！？\n]+/).filter(s => s.trim().length > 10)
  let current = ''
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      chunks.push(current)
      current = ''
    }
    current += sentence + '。'
  }
  if (current.trim()) chunks.push(current)
  return chunks.length > 0 ? chunks : [text.slice(0, maxChars)]
}

/** 健壮解析 AI 返回的 JSON */
function parseFactsJSON(response: string): Array<{
  content: string
  factType: string
  confidence: number
  factContext: string
  needsVerification: boolean
  tags: string[]
}> {
  // 尝试匹配 JSON 数组
  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item: unknown) =>
      item && typeof item === 'object' && 'content' in (item as Record<string, unknown>)
    )
  } catch {
    // 尝试修复常见 JSON 错误（尾逗号、缺少括号等）
    try {
      const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, '$1')
      const parsed = JSON.parse(fixed)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
