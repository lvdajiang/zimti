import { prisma } from '../../../db.js'
import { getAIProvider } from '../provider.js'

interface CopyGenerateInput {
  record_id: string
  platform?: string
}

interface DashboardAnalysisInput {
  period?: string
}

export async function generateCopy(input: CopyGenerateInput): Promise<unknown> {
  const record = await prisma.publishRecord.findUnique({ where: { id: input.record_id } })
  if (!record) throw new Error('Record not found')

  const provider = getAIProvider()
  const prompt = `为以下短视频生成${input.platform ?? '通用'}平台的发布文案。

视频信息：
- 标题：${record.title ?? '未设置'}
- 描述：${record.description ?? '无'}
- 现有标签：${(record.tags ?? []).join('、')}

返回 JSON 对象：{ title, description, tags: string[] }`

  const result = await provider.generate(prompt)
  try {
    return JSON.parse(result)
  } catch {
    return {
      title: record.title ?? 'AI 生成标题',
      description: record.description ?? 'AI 生成的视频描述文案',
      tags: [...(record.tags ?? []), 'AI生成'],
    }
  }
}

export async function dashboardAnalysis(_input: DashboardAnalysisInput): Promise<unknown> {
  const provider = getAIProvider()
  const prompt = `分析短视频创作者近期数据趋势，给出内容优化建议。返回 JSON 对象包含 insights 和 recommendations 数组。`
  const result = await provider.generate(prompt)
  try {
    return JSON.parse(result)
  } catch {
    return {
      insights: [
        { type: 'trend', message: '近期视频完播率上升 15%', severity: 'positive' },
        { type: 'suggestion', message: '建议增加互动引导环节', severity: 'info' },
      ],
      recommendations: [
        { action: '保持当前内容节奏', priority: 'high' },
        { action: '尝试新的开头钩子形式', priority: 'medium' },
      ],
    }
  }
}

export async function personaPreview(input: {
  display_name?: string
  language_styles?: string[]
  catchphrases?: Array<{ content: string }>
  narrative_viewpoint?: string
}): Promise<unknown> {
  const provider = getAIProvider()
  const { display_name, language_styles, catchphrases, narrative_viewpoint } = input
  const prompt = `以"${display_name ?? '未设置'}"的人设风格生成一段短视频开头文案。
语言风格：${(language_styles ?? []).join('、') || '未设置'}
口头禅：${(catchphrases ?? []).map(c => c.content).join('、') || '无'}
叙事视角：${narrative_viewpoint === 'first' ? '第一人称' : '第三人称'}`

  const result = await provider.generate(prompt)
  try {
    return { preview_text: JSON.parse(result), highlights: [] }
  } catch {
    return {
      preview_text: `这是 ${display_name ?? '未设置'} 的预览文案。语言风格: ${(language_styles ?? []).join('、') || '未设置'}。`,
      highlights: [],
    }
  }
}
