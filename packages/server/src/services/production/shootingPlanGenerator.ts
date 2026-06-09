/**
 * 拍摄清单生成器 — 从分镜段生成结构化拍摄计划
 *
 * 输入: scriptId（脚本 ID）
 * 逻辑: 加载 StoryboardSegments → AI 生成每个段的拍摄方案 → 写入 ShootingPlan
 * 输出: ShootingPlan 记录数组
 */
import { prisma } from '../../db.js'
import { getAIProvider } from '../ai/provider.js'
import { renderPrompt, type PromptVariables } from '../promptEngine/index.js'

interface ShootingPlanGenerateResult {
  plans: {
    segmentIndex: number
    scene: string
    props: string[]
    cameraMovement: string
    duration: number
    notes: string
  }[]
}

export async function generateShootingPlan(scriptId: number): Promise<ShootingPlanGenerateResult> {
  // 加载分镜段
  const segments = await prisma.storyboardSegment.findMany({
    where: { scriptId },
    orderBy: { segmentIndex: 'asc' },
  })

  if (segments.length === 0) throw new Error('没有找到分镜段，请先生成分镜')

  // 删除该脚本的旧拍摄计划
  await prisma.shootingPlan.deleteMany({ where: { scriptId } })

  // 构建分镜摘要给 AI
  const segmentSummary = segments.map((s, i) => ({
    index: i,
    segmentType: s.segmentType,
    oralText: s.oralText || '',
    visualDescription: s.visualDescription,
    duration: Number(s.duration),
  }))

  const provider = getAIProvider()

  const variables: PromptVariables = {
    segment_count: String(segments.length),
    segments_json: JSON.stringify(segmentSummary, null, 2),
  }

  const { systemPrompt, userPrompt } = await renderPrompt(
    'shooting_plan_generate',
    variables,
    undefined,
    // 硬编码降级
    (vars) => ({
      systemPrompt: '你是一个专业的视频拍摄导演。根据分镜信息生成拍摄清单。只返回 JSON，不要其他文字。',
      userPrompt: `根据以下 ${vars.segment_count} 个分镜段生成拍摄清单。

分镜信息：
${vars.segments_json}

为每个分镜生成拍摄方案，包含：
- segmentIndex: 分镜序号
- scene: 场景描述（具体到场地、光线、氛围）
- props: 需要的道具列表（数组）
- cameraMovement: 运镜方式（static/pan_left/pan_right/tracking/close_up/wide_shot/aerial）
- duration: 建议拍摄时长（秒）
- notes: 导演备注（拍摄要点、注意事项）

返回 JSON 格式：{ "plans": [...] }`,
    }),
  )

  const result = await provider.generate(userPrompt, systemPrompt)

  let parsed: ShootingPlanGenerateResult
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    // 降级：为每个段生成简单拍摄方案
    parsed = {
      plans: segments.map((s, i) => ({
        segmentIndex: i,
        scene: s.visualDescription || `第${i + 1}段画面`,
        props: [],
        cameraMovement: 'static',
        duration: Number(s.duration),
        notes: s.segmentType === 'oral' ? '口播段，建议正面中景' : '画面段，按描述拍摄',
      })),
    }
  }

  // 写入数据库
  const created = []
  for (const plan of parsed.plans) {
    const segment = segments[plan.segmentIndex]
    if (!segment) continue

    const record = await prisma.shootingPlan.create({
      data: {
        scriptId,
        segmentIndex: plan.segmentIndex,
        scene: plan.scene || segment.visualDescription,
        props: plan.props || [],
        cameraMovement: plan.cameraMovement || 'static',
        duration: plan.duration || Number(segment.duration),
        notes: plan.notes || null,
        status: 'pending',
        source: 'ai',
      },
    })
    created.push(record)
  }

  return {
    plans: created.map((c) => ({
      segmentIndex: c.segmentIndex,
      scene: c.scene,
      props: c.props,
      cameraMovement: c.cameraMovement || 'static',
      duration: Number(c.duration),
      notes: c.notes || '',
    })),
  }
}
