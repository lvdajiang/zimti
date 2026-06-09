/**
 * 违禁词检测服务 — 双引擎：关键词库 + AI 语境检测
 */

import { prisma } from '../../db.js'
import { getAIProvider } from '../ai/provider.js'
import { renderPrompt, type PromptVariables } from '../promptEngine/index.js'
import type { ProhibitedCheckItem, ProhibitedCheckReport, ProhibitedCategory, ProhibitedPlatform } from '@zimti/shared'

/**
 * 违禁词检测主入口
 */
export async function checkProhibitedWords(
  content: string,
  platforms?: ProhibitedPlatform[],
): Promise<ProhibitedCheckReport> {
  // 引擎1：关键词库匹配
  const keywordItems = await checkByKeywordBank(content, platforms)

  // 引擎2：AI 语境检测（补充关键词库覆盖不到的）
  const aiItems = await checkByAI(content, keywordItems)

  // 合并去重
  const allItems = mergeResults(keywordItems, aiItems)

  return {
    items: allItems,
    checked_at: new Date().toISOString(),
    total_risks: allItems.filter(i => i.risk === 'high' || i.risk === 'medium').length,
  }
}

/**
 * 引擎1：关键词库精确匹配
 */
async function checkByKeywordBank(
  content: string,
  platforms?: ProhibitedPlatform[],
): Promise<ProhibitedCheckItem[]> {
  const where: any = { isActive: true }
  if (platforms?.length) {
    where.OR = [
      { platform: { in: platforms } },
      { platform: 'all' },
    ]
  }

  const words = await prisma.prohibitedWord.findMany({ where })
  const items: ProhibitedCheckItem[] = []

  for (const pw of words) {
    const regex = new RegExp(pw.word, 'gi')
    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      items.push({
        word: pw.word,
        position: match.index,
        category: pw.category as ProhibitedCategory,
        risk: categoryToRisk(pw.category as ProhibitedCategory),
        suggestion: pw.replacement ?? `避免使用"${pw.word}"`,
        platform: [pw.platform as ProhibitedPlatform],
      })
    }
  }

  return items
}

/**
 * 引擎2：AI 语境检测
 */
async function checkByAI(
  content: string,
  existingItems: ProhibitedCheckItem[],
): Promise<ProhibitedCheckItem[]> {
  const provider = getAIProvider()

  // 把已检测出的词排除，让 AI 关注遗漏
  const foundWords = existingItems.map(i => i.word).join('、')

  const variables: PromptVariables = {
    content,
    found_words: foundWords || '无',
  }

  const { systemPrompt, userPrompt } = await renderPrompt(
    'prohibited_check',
    variables,
    undefined,
    (vars) => ({
      systemPrompt: undefined,
      userPrompt: `你是一位短视频内容合规审核专家。请检查以下文案中是否有违禁词、敏感表述、绝对化用语或可能被平台限流的表达。

已通过关键词库检测出的词：${vars.found_words}（请不要再报告这些词）

请关注关键词库可能遗漏的：
1. 语境中的隐性违规（如"全网最低"虽无"最"字但含义违规）
2. 新兴敏感词
3. 平台可能误判的表达

文案内容：
${vars.content}

返回 JSON 数组，每个元素包含：
{ "word": "违禁词", "position": 0, "category": "high_risk", "risk": "high", "suggestion": "替换建议", "platform": ["douyin"] }

如果没有发现新的违禁词，返回空数组 []`,
    }),
  )

  try {
    const result = await provider.generate(userPrompt, systemPrompt)
    const parsed = JSON.parse(result)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: any) => ({
      word: item.word ?? '',
      position: item.position ?? 0,
      category: item.category ?? 'medium_risk',
      risk: item.risk ?? 'medium',
      suggestion: item.suggestion ?? '',
      platform: item.platform ?? ['all'],
    }))
  } catch {
    return []
  }
}

/**
 * 合并去重
 */
function mergeResults(
  keywordItems: ProhibitedCheckItem[],
  aiItems: ProhibitedCheckItem[],
): ProhibitedCheckItem[] {
  const seen = new Set<string>()
  const merged: ProhibitedCheckItem[] = []

  for (const item of [...keywordItems, ...aiItems]) {
    const key = `${item.word}-${item.position}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(item)
    }
  }

  // 按风险等级排序
  const riskOrder = { high: 0, medium: 1, low: 2 }
  merged.sort((a, b) => (riskOrder[a.risk] ?? 9) - (riskOrder[b.risk] ?? 9))

  return merged
}

function categoryToRisk(category: ProhibitedCategory): 'high' | 'medium' | 'low' {
  switch (category) {
    case 'absolute': return 'high'
    case 'high_risk': return 'high'
    case 'medium_risk': return 'medium'
    case 'sensitive': return 'low'
    default: return 'medium'
  }
}

/**
 * 一键替换违禁词
 */
export function applyProhibitedReplacements(
  content: string,
  items: ProhibitedCheckItem[],
): string {
  let result = content
  // 从后往前替换，避免 position 偏移
  const sorted = [...items].sort((a, b) => b.position - a.position)
  for (const item of sorted) {
    if (item.suggestion && item.suggestion !== `避免使用"${item.word}"`) {
      result = result.substring(0, item.position) + item.suggestion + result.substring(item.position + item.word.length)
    }
  }
  return result
}
