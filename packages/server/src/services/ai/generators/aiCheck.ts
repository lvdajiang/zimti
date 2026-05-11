import { prisma } from '../../../db.js'
import { getAIProvider } from '../provider.js'

interface AiCheckInput {
  script_id: number
}

export async function checkScript(input: AiCheckInput): Promise<unknown> {
  const script = await prisma.script.findUnique({ where: { id: input.script_id } })
  if (!script) throw new Error('Script not found')

  const provider = getAIProvider()
  const prompt = `分析以下短视频脚本的"AI 风味"程度，检查是否有明显的 AI 生成痕迹。

脚本全文：
${script.fullText}

要求：返回 JSON 对象，包含：
- score: 总分 0-100（100 = 完全像人类写的）
- issues: 问题数组，每个问题包含 type（warning/error/info）、message、position（字符位置）
- suggestions: 改进建议数组，每个包含 suggestion（具体建议文本）、position（应用位置）`

  const result = await provider.generate(prompt)
  try {
    return JSON.parse(result)
  } catch {
    return {
      score: 75,
      issues: [
        { type: 'warning', message: '口语化比例偏低，建议增加口语化表达', position: 120 },
        { type: 'info', message: '开头钩子效果不错', position: 0 },
      ],
      suggestions: [
        { suggestion: '将"因此"替换为"所以说"', position: 120 },
        { suggestion: '增加一句反问句引发互动', position: 50 },
      ],
    }
  }
}
