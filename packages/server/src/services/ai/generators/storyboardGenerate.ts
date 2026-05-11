import { prisma } from '../../../db.js'
import { getAIProvider } from '../provider.js'

interface StoryboardGenerateInput {
  script_id: number
  video_type?: string
}

export async function generateStoryboard(input: StoryboardGenerateInput): Promise<unknown> {
  const script = await prisma.script.findUnique({ where: { id: input.script_id } })
  if (!script) throw new Error('Script not found')

  const provider = getAIProvider()
  const prompt = `根据以下脚本生成短视频分镜。视频类型：${input.video_type ?? '通用'}。

脚本全文：
${script.fullText}

要求：将脚本拆分为 5-10 个分镜片段，每个片段包含：
- segmentType: "oral"（口播段）、"visual"（画面段）或 "transition"（转场段）
- oralText: 口播文案（仅 oral 类型）
- visualDescription: 画面描述
- duration: 时长（秒，口播段 3-8秒，画面段 2-5秒，转场 0.5-1秒）
- transitionType: 转场类型（淡入、滑动、缩放等）

返回 JSON 数组。`

  const result = await provider.generate(prompt)
  try {
    return JSON.parse(result)
  } catch {
    const segments = script.fullText.split('\n').filter(Boolean).slice(0, 5)
    return segments.map((text, i) => ({
      segmentType: i % 2 === 0 ? 'oral' : 'visual',
      oralText: i % 2 === 0 ? text : null,
      visualDescription: i % 2 !== 0 ? text : `展示${text.slice(0, 10)}相关画面`,
      duration: 3.0,
      transitionType: i > 0 ? 'fade' : null,
    }))
  }
}
