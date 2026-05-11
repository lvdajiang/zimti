import { prisma } from '../../../db.js'
import { getAIProvider } from '../provider.js'

interface TopicGenerateInput {
  task_id: string
  count?: number
}

export async function generateTopics(input: TopicGenerateInput): Promise<unknown> {
  const task = await prisma.task.findUnique({ where: { id: input.task_id } })
  if (!task) throw new Error('Task not found')

  const count = input.count ?? 5
  const provider = getAIProvider()

  const prompt = `根据任务"${task.title}"（描述：${task.description ?? '无'}），生成 ${count} 个短视频选题。
每个选题包含：title（标题）、contentSkeleton（内容骨架，100字左右）、targetAudience（目标受众）、estimatedHotValue（预估热度 1-100）。
返回 JSON 数组。`

  const result = await provider.generate(prompt)
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
  const prompt = `合并以下选题为一个更优选题：${titles}。返回合并后的 title 和 contentSkeleton。`

  const result = await provider.generate(prompt)
  try {
    return JSON.parse(result)
  } catch {
    return {
      title: `合并选题: ${proposals[0].title}`,
      contentSkeleton: proposals.map(p => p.contentSkeleton).join('\n'),
    }
  }
}
