import { prisma } from '../../../db.js'
import { getAIProvider } from '../provider.js'

export async function analyzeViralVideo(input: { video_id: number }): Promise<unknown> {
  const video = await prisma.viralVideo.findUnique({ where: { id: input.video_id } })
  if (!video) throw new Error(`ViralVideo ${input.video_id} not found`)

  const provider = getAIProvider()
  const prompt = `分析以下爆款短视频的成功要素。

视频信息：
- 标题：${video.title}
- 平台：${video.platform}
- 时长：${video.duration}秒
- 播放：${video.playCount}、点赞：${video.likeCount}、评论：${video.commentCount}、收藏：${video.collectCount}、转发：${video.shareCount}
- 互动率：${video.interactionRate ?? '未知'}
- 文案/字幕：${video.transcript ?? '无'}

请从以下维度分析并返回 JSON 对象：
{
  "strengths": ["强项1", "强项2"],
  "weaknesses": ["可改进点1"],
  "content_hooks": ["开头钩子技巧"],
  "structure_analysis": {
    "opening": "开头分析",
    "body": "主体分析",
    "ending": "结尾分析"
  },
  "recommendations": ["优化建议1", "优化建议2"],
  "overall_score": 85
}

注意：overall_score 为 0-100 的整数评分。`

  const result = await provider.generate(prompt)
  let analysis: Record<string, unknown>
  try {
    analysis = JSON.parse(result) as Record<string, unknown>
  } catch {
    analysis = {
      strengths: ['内容完整'],
      weaknesses: [],
      content_hooks: [],
      structure_analysis: { opening: '待分析', body: '待分析', ending: '待分析' },
      recommendations: [],
      overall_score: 70,
    }
  }

  await prisma.viralVideo.update({
    where: { id: input.video_id },
    data: { analysisJson: analysis as object },
  })

  return analysis
}
