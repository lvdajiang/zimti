/**
 * 事实验证服务 — 用 web search 交叉验证提取的事实
 *
 * 对 needsVerification=true 的事实，调用搜索引擎查找佐证/反驳，
 * AI 判断搜索结果是否支持该事实。
 */

import { getAIProvider } from '../ai/provider.js'
import { searchWeb } from '../webSearch.js'
import type { AtomicFact } from './extractFactsFromTranscript.js'
import type { FactVerificationStatus } from '@zimti/shared'

export interface VerifiedFact extends AtomicFact {
  verificationStatus: FactVerificationStatus
  verificationNote: string
  verifiedUrls: string[]
}

const MAX_VERIFY_PER_RUN = 10 // 控制成本

export async function verifyFacts(facts: AtomicFact[]): Promise<VerifiedFact[]> {
  const results: VerifiedFact[] = []

  // 优先验证 statistic/definition 类型 + needsVerification
  const toVerify = facts
    .filter(f => f.needsVerification && (f.factType === 'statistic' || f.factType === 'definition'))
    .slice(0, MAX_VERIFY_PER_RUN)

  const verifiedContents = new Set<string>()

  for (const fact of toVerify) {
    verifiedContents.add(fact.content)
    try {
      const searchQuery = fact.content.slice(0, 60)
      const searchResults = await searchWeb(searchQuery, 5)

      if (searchResults.length === 0) {
        results.push({
          ...fact,
          verificationStatus: 'pending',
          verificationNote: '未找到搜索结果',
          verifiedUrls: [],
        })
        continue
      }

      const ai = getAIProvider()
      const snippetsText = searchResults
        .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
        .join('\n')

      const verifyPrompt = `请验证以下事实是否被搜索结果支持。

事实: "${fact.content}"

搜索结果:
${snippetsText}

返回 JSON：
{"supported": true/false, "confidence": 0.9, "note": "简短说明验证结果"}`

      const response = await ai.generate(verifyPrompt, '你是事实验证专家。只返回 JSON。')
      const jsonMatch = response.match(/\{[\s\S]*?\}/)

      let supported: boolean | null = null
      let confidence = fact.confidence
      let note = ''

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          supported = parsed.supported
          confidence = clamp01(Number(parsed.confidence) || fact.confidence)
          note = parsed.note || ''
        } catch { /* parse failed, use defaults */ }
      }

      const status: FactVerificationStatus =
        supported === true ? 'verified'
        : supported === false ? 'rejected'
        : 'pending'

      results.push({
        ...fact,
        verificationStatus: status,
        verificationNote: note,
        verifiedUrls: searchResults.map(r => r.url).filter(Boolean),
        sourceUrls: [...new Set([...fact.sourceUrls, ...searchResults.map(r => r.url).filter(Boolean)])],
        confidence,
      })
    } catch (err) {
      console.warn(`[FactVerify] 验证失败:`, err instanceof Error ? err.message : err)
      results.push({
        ...fact,
        verificationStatus: 'pending',
        verificationNote: '验证过程出错',
        verifiedUrls: [],
      })
    }
  }

  // 不需要验证的事实直接标记 unverified
  for (const fact of facts) {
    if (!verifiedContents.has(fact.content)) {
      results.push({
        ...fact,
        verificationStatus: fact.needsVerification ? 'unverified' : 'unverified',
        verificationNote: '',
        verifiedUrls: [],
      })
    }
  }

  return results
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
