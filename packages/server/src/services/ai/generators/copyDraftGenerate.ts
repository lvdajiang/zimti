/**
 * 文案初稿生成器 — 基于选题+热点+品牌记忆生成创作文案
 * 与 copyGenerate.ts（发布文案）不同，这是内容创作的第一步
 */

import { prisma } from '../../../db.js'
import { getAIProvider } from '../provider.js'
import { renderPrompt, type PromptVariables } from '../../promptEngine/index.js'

interface CopyDraftInput {
  topic_id?: number
  task_id?: string
  brand_context?: string
  platform?: string
}

export async function generateCopyDraft(input: CopyDraftInput): Promise<{
  title: string
  content: string
  structure: { hook: string; body: string; cta: string; style_notes: string }
}> {
  const provider = getAIProvider()

  // 收集上下文
  let topicTitle = input.task_id ?? '未指定选题'
  let topicSkeleton = ''
  let hotspotText = ''

  if (input.topic_id) {
    const topic = await prisma.topicProposal.findUnique({ where: { id: input.topic_id } })
    if (topic) {
      topicTitle = topic.title
      topicSkeleton = typeof topic.contentSkeleton === 'object'
        ? JSON.stringify(topic.contentSkeleton)
        : String(topic.contentSkeleton)

      // 加载关联热点
      if (topic.hotspotIds?.length) {
        const hotspots = await prisma.hotspot.findMany({
          where: { id: { in: topic.hotspotIds } },
          take: 5,
        })
        hotspotText = hotspots.map(h => `${h.title}(热度${h.heatValue})`).join('、')
      }
    }
  }

  const brandSection = input.brand_context
    ? `\n\n品牌画像参考：\n${input.brand_context}\n请确保文案风格与品牌调性一致。`
    : ''

  const variables: PromptVariables = {
    topic_title: topicTitle,
    topic_skeleton: topicSkeleton || '无',
    hotspot_list: hotspotText || '无',
    brand_section: brandSection,
    platform: input.platform ?? '通用',
  }

  const { systemPrompt, userPrompt } = await renderPrompt(
    'copy_draft_generate',
    variables,
    undefined,
    // 硬编码降级
    (vars) => ({
      systemPrompt: undefined,
      userPrompt: `你是一位专业的短视频文案创作者。请为选题"${vars.topic_title}"写一篇短视频文案。

目标平台：${vars.platform}
${vars.brand_section}

内容骨架参考：${vars.topic_skeleton}
相关热点：${vars.hotspot_list}

要求：
1. 开头钩子（hook）：3秒内抓住注意力
2. 正文（body）：核心内容，200-500字
3. 结尾CTA（call_to_action）：引导互动
4. 风格自然口语化，避免AI痕迹

返回 JSON 对象：
{
  "title": "文案标题",
  "content": "完整文案全文",
  "structure": {
    "hook": "开头钩子",
    "body": "正文内容",
    "cta": "结尾互动引导",
    "style_notes": "风格说明"
  }
}`,
    }),
  )

  const result = await provider.generate(userPrompt, systemPrompt)
  try {
    const parsed = JSON.parse(result)
    return {
      title: parsed.title ?? topicTitle,
      content: parsed.content ?? '',
      structure: parsed.structure ?? { hook: '', body: '', cta: '', style_notes: '' },
    }
  } catch {
    return {
      title: topicTitle,
      content: '文案生成失败，请手动编辑或重新生成。',
      structure: { hook: '', body: '', cta: '', style_notes: '' },
    }
  }
}

/**
 * 文案润色/改写
 */
export async function refineCopy(
  content: string,
  instruction: string,
  brand_context?: string,
): Promise<string> {
  const provider = getAIProvider()

  const brandSection = brand_context
    ? `\n品牌调性：${brand_context}`
    : ''

  const variables: PromptVariables = {
    content,
    instruction,
    brand_section: brandSection,
  }

  const { systemPrompt, userPrompt } = await renderPrompt(
    'copy_refine',
    variables,
    undefined,
    (vars) => ({
      systemPrompt: undefined,
      userPrompt: `请${vars.instruction}以下短视频文案：${vars.brand_section}

原始文案：
${vars.content}

返回润色后的完整文案（纯文本，不要JSON格式）。`,
    }),
  )

  const result = await provider.generate(userPrompt, systemPrompt)
  return result.trim()
}
