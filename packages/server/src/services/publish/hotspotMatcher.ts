/**
 * 热点标签匹配器 — 将当前活跃热点与视频内容进行 AI 匹配
 *
 * 查询有效热点数据，AI 计算每个热点与视频内容的相关性，
 * 输出匹配的热点标签供用户在发布前采纳（蹭热点）。
 */

import { prisma } from '../../db.js'
import { getAIProvider } from '../ai/provider.js'

export interface HotspotMatchInput {
  title: string
  description: string
  script_text: string
  existing_tags: string[]
  top_n?: number
}

export interface HotspotMatch {
  hotspot_id: number
  hotspot_title: string
  source_platform: string
  heat_value: number
  matched_keywords: string[]
  relevance_score: number
  suggested_tag: string
}

export interface HotspotMatchResult {
  matches: HotspotMatch[]
}

export async function matchHotspotsForPublish(
  input: HotspotMatchInput,
): Promise<HotspotMatchResult> {
  const { title, description, script_text, existing_tags, top_n } = input
  const limit = top_n ?? 10

  // 1. 查询当前有效的热点（按热度降序，取 top 50）
  const hotspots = await prisma.hotspot.findMany({
    where: {
      validUntil: { gte: new Date() },
    },
    orderBy: { heatValue: 'desc' },
    take: 50,
  })

  if (hotspots.length === 0) {
    return { matches: [] }
  }

  // 2. AI 匹配热点与内容的相关性
  const contentSummary = [
    `标题: ${title || '无'}`,
    `描述: ${(description || '无').slice(0, 200)}`,
    `脚本文本: ${script_text.slice(0, 300)}`,
    `已有标签: ${existing_tags.join('、') || '无'}`,
  ].join('\n')

  const hotspotList = hotspots
    .map((h, i) => `${i + 1}. [${h.sourcePlatform} 热度${h.heatValue}] ${h.title}${h.keywords.length > 0 ? ` (关键词: ${h.keywords.join(',')})` : ''}`)
    .join('\n')

  const provider = getAIProvider()
  const prompt = `你是一位短视频运营专家，擅长"蹭热点"。请分析以下视频内容与热点列表的匹配度。

## 视频内容
${contentSummary}

## 当前热点（共 ${hotspots.length} 个）
${hotspotList}

## 任务
1. 找出与视频内容最相关的热点（最多 ${limit} 个）
2. 对每个匹配的热点：
   - 计算相关性分数（0-1），考虑主题契合度、时效性、流量价值
   - 提取匹配的关键词
   - 建议一个适合发布的标签（该标签应能蹭到热点流量）
3. 按相关性从高到低排序

## 要求
- 相关性评分要客观，低于 0.3 的不返回
- 建议标签要自然，不能太生硬
- 标签要包含热点核心词，让内容能被热点流量覆盖

返回 JSON 对象：
{
  "matches": [{
    "hotspot_index": 1,
    "relevance_score": 0.85,
    "matched_keywords": ["关键词1", "关键词2"],
    "suggested_tag": "推荐标签"
  }]
}`

  const result = await provider.generate(prompt)
  try {
    const parsed = JSON.parse(result) as {
      matches?: Array<{
        hotspot_index: number
        relevance_score: number
        matched_keywords: string[]
        suggested_tag: string
      }>
    }

    if (!Array.isArray(parsed.matches)) throw new Error('Invalid format')

    const matches: HotspotMatch[] = parsed.matches
      .filter(m => m.relevance_score >= 0.3 && m.hotspot_index >= 1 && m.hotspot_index <= hotspots.length)
      .map(m => {
        const hotspot = hotspots[m.hotspot_index - 1]
        return {
          hotspot_id: hotspot.id,
          hotspot_title: hotspot.title,
          source_platform: hotspot.sourcePlatform,
          heat_value: hotspot.heatValue,
          matched_keywords: m.matched_keywords,
          relevance_score: m.relevance_score,
          suggested_tag: m.suggested_tag,
        }
      })
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit)

    return { matches }
  } catch {
    // 降级：基于标题关键词简单匹配
    return simpleMatch(hotspots, title, description, limit)
  }
}

/** 降级方案：基于关键词的简单匹配 */
function simpleMatch(
  hotspots: Array<{ id: number; title: string; sourcePlatform: string; heatValue: number; keywords: string[] }>,
  title: string,
  description: string,
  limit: number,
): HotspotMatchResult {
  const contentWords = new Set(
    `${title} ${description}`
      .split(/[\s,，。！？、]+/)
      .filter(w => w.length >= 2),
  )

  const matches: HotspotMatch[] = hotspots
    .map(hotspot => {
      const hotspotWords = hotspot.title.split(/[\s,，。！？、]+/).filter(w => w.length >= 2)
      const matched = hotspotWords.filter(w => contentWords.has(w))
      const keywordMatched = hotspot.keywords.filter(k => contentWords.has(k))
      const allMatched = [...new Set([...matched, ...keywordMatched])]
      const score = Math.min(1, allMatched.length * 0.3)

      return {
        hotspot_id: hotspot.id,
        hotspot_title: hotspot.title,
        source_platform: hotspot.sourcePlatform,
        heat_value: hotspot.heatValue,
        matched_keywords: allMatched,
        relevance_score: score,
        suggested_tag: hotspot.title.slice(0, 10),
      }
    })
    .filter(m => m.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit)

  return { matches }
}
