import { prisma } from '../../../db.js'
import { getAIProvider } from '../provider.js'
import { renderPrompt, type PromptVariables } from '../../promptEngine/index.js'

interface TopicGenerateInput {
  task_id: string
  count?: number
  brand_context?: string
}

export async function generateTopics(input: TopicGenerateInput): Promise<unknown> {
  const task = await prisma.task.findUnique({ where: { id: input.task_id } })
  if (!task) throw new Error('Task not found')

  const count = input.count ?? 5
  const provider = getAIProvider()

  const brandSection = input.brand_context
    ? `\n\n品牌画像参考：\n${input.brand_context}\n请确保选题风格与品牌调性一致。`
    : ''

  const variables: PromptVariables = {
    task_title: task.title,
    task_description: task.description ?? '无',
    count,
    brand_section: brandSection,
  }

  const { systemPrompt, userPrompt } = await renderPrompt(
    'topic_generate',
    variables,
    undefined,
    // 硬编码降级：PromptEngine 不可用时回退到原始逻辑
    (vars) => ({
      systemPrompt: undefined,
      userPrompt: `根据任务"${vars.task_title}"（描述：${vars.task_description}），生成 ${vars.count} 个短视频选题。${vars.brand_section}
每个选题包含：title（标题）、contentSkeleton（内容骨架，100字左右）、targetAudience（目标受众）、estimatedHotValue（预估热度 1-100）。
返回 JSON 数组。`,
    }),
  )

  const result = await provider.generate(userPrompt, systemPrompt)
  try {
    return JSON.parse(result)
  } catch {
    return [
      { title: '模拟选题1', contentSkeleton: '从痛点切入，引出解决方案', targetAudience: '通用', estimatedHotValue: 70 },
      { title: '模拟选题2', contentSkeleton: '用数据说话，增强说服力', targetAudience: '通用', estimatedHotValue: 65 },
      { title: '模拟选题3', contentSkeleton: '对比展示，制造反差效果', targetAudience: '通用', estimatedHotValue: 60 },
    ]
  }
}

export async function mergeTopics(proposalIds: number[]): Promise<unknown> {
  const proposals = await prisma.topicProposal.findMany({
    where: { id: { in: proposalIds } },
  })
  if (proposals.length < 2) throw new Error('至少需要2个选题才能合并')

  const provider = getAIProvider()
  const titles = proposals.map(p => p.title).join('、')

  const { systemPrompt, userPrompt } = await renderPrompt(
    'topic_merge',
    { titles },
    undefined,
    (vars) => ({
      systemPrompt: undefined,
      userPrompt: `合并以下选题为一个更优选题：${vars.titles}。返回合并后的 title 和 contentSkeleton。`,
    }),
  )

  const result = await provider.generate(userPrompt, systemPrompt)
  try {
    return JSON.parse(result)
  } catch {
    return {
      title: `合并选题: ${proposals[0].title}`,
      contentSkeleton: proposals.map(p => p.contentSkeleton).join('\n'),
    }
  }
}
