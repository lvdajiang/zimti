import { getAIProvider } from '../provider.js'
import type { TopicSourceAggregate } from '../../aiHub/topicSourceAggregator.js'

interface EnhancedTopicGenerateInput {
  task_title: string
  task_description?: string
  count?: number
  brand_context?: string
  sources?: TopicSourceAggregate
  persona_context?: string
  require_dimension_scores?: boolean
}

/**
 * 增强版选题生成 — 注入品牌记忆 + 多源上下文（GEO/群聊/CRM/热点）
 * 原有 generateTopics 保持不变（向后兼容），此函数用于路由层按需调用
 */
export async function generateEnhancedTopics(input: EnhancedTopicGenerateInput): Promise<unknown> {
  const provider = getAIProvider()
  const count = input.count ?? 5

  // 构造多源上下文段落
  const sections: string[] = []

  if (input.brand_context) {
    sections.push(`【品牌画像】\n${input.brand_context}`)
  }

  if (input.persona_context) {
    sections.push(`【人设定位】\n${input.persona_context}`)
  }

  if (input.sources) {
    const { geoHints, chatInsights, crmInsights, hotspotHints } = input.sources

    if (geoHints.length > 0) {
      const geoText = geoHints
        .slice(0, 5)
        .map(q => `- "${q.question}"（${q.category}/${q.intentType}）`)
        .join('\n')
      sections.push(`【GEO 搜索意图】用户在 AI 搜索引擎中搜索的问题：\n${geoText}`)
    }

    if (chatInsights.hotTopics.length > 0) {
      const topicText = chatInsights.hotTopics
        .map(t => `- ${t.word}（提及${t.count}次）`)
        .join('\n')
      sections.push(`【微信群聊热门话题】\n${topicText}`)
    }

    if (chatInsights.painPoints.length > 0) {
      sections.push(`【客户痛点】\n${chatInsights.painPoints.slice(0, 5).join('、')}`)
    }

    if (crmInsights.length > 0) {
      const crmText = crmInsights
        .map(c => `- ${c.destination}（${c.count}位客户感兴趣）`)
        .join('\n')
      sections.push(`【CRM 客户出行意向】\n${crmText}`)
    }

    if (hotspotHints.length > 0) {
      const hotText = hotspotHints
        .map(h => `- ${h.title}（热度${h.heatValue}）`)
        .join('\n')
      sections.push(`【当前热点】\n${hotText}`)
    }

    // 历史数据分析洞察（闭环反馈）
    const { historicalInsights } = input.sources
    if (historicalInsights?.totalSnapshots > 0) {
      const histParts: string[] = []
      histParts.push(`历史表现数据：${historicalInsights.summary}`)
      if (historicalInsights.topPerformers.length > 0) {
        const topList = historicalInsights.topPerformers
          .slice(0, 3)
          .map(tp => `- 「${tp.title}」(${tp.platform}) 完播率 ${tp.completionRate}% / 播放 ${tp.playCount}`)
          .join('\n')
        histParts.push(`高完播率内容：\n${topList}`)
      }
      if (historicalInsights.recentInsight) {
        histParts.push(`改进建议：${historicalInsights.recentInsight}`)
      }
      sections.push(`【历史数据反馈】\n${histParts.join('\n')}\n\n请参考以上历史表现数据：优先借鉴高完播内容的选题角度和钩子策略，避免重复低表现内容的模式。`)
    }
  }

  const contextBlock = sections.length > 0
    ? `\n\n请综合以下参考信息生成选题：\n\n${sections.join('\n\n')}\n\n要求：选题应紧扣上述参考信息中的真实需求、热点和痛点，确保内容既有流量价值又能解决用户实际问题。`
    : ''

  const dimensionInstruction = input.require_dimension_scores
    ? `\n每个选题还必须包含：
- dimensionScores: { hotspot: 0-100, viral: 0-100, persona: 0-100, brand: 0-100, painPoint: 0-100 }
  - hotspot: 与当前热点/关键词的关联度
  - viral: 是否借鉴了已验证的爆款结构/主题
  - persona: 与创作者人设定位的匹配度
  - brand: 对品牌记忆/调性的支撑程度
  - painPoint: 对真实客户痛点的覆盖程度
- reasoning: 一句话说明为什么这个选题值得做`
    : ''

  const prompt = `根据任务"${input.task_title}"（描述：${input.task_description ?? '无'}），生成 ${count} 个短视频选题。${contextBlock}
每个选题包含：title（标题）、contentSkeleton（内容骨架，含hook/main_points/visual_direction/structure_type）、targetAudience（目标受众）、estimatedHotValue（预估热度 1-100）、sourceHint（选题来源提示）。${dimensionInstruction}
返回 JSON 数组。`

  const result = await provider.generate(prompt)
  try {
    return JSON.parse(result)
  } catch {
    const fallbackScores = { hotspot: 50, viral: 50, persona: 50, brand: 50, painPoint: 50 }
    return [
      { title: '模拟选题1', contentSkeleton: '从痛点切入，引出解决方案', targetAudience: '通用', estimatedHotValue: 70, sourceHint: 'AI推荐', dimensionScores: fallbackScores, reasoning: '通用推荐' },
      { title: '模拟选题2', contentSkeleton: '用数据说话，增强说服力', targetAudience: '通用', estimatedHotValue: 65, sourceHint: 'AI推荐', dimensionScores: fallbackScores, reasoning: '通用推荐' },
    ]
  }
}
