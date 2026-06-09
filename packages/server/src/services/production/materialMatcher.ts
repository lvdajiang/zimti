/**
 * 素材匹配服务 — 将素材关联到拍摄计划
 */
import { prisma } from '../../db.js'

/** 手动匹配：将素材分配到拍摄计划项 */
export async function matchMaterialsForPlan(planId: string, materialIds: string[]): Promise<void> {
  await prisma.shootingPlan.update({
    where: { id: planId },
    data: { materialIds, status: 'matched' },
  })

  // 同步到 StoryboardSegment
  const plan = await prisma.shootingPlan.findUnique({ where: { id: planId } })
  if (!plan) return

  const segment = await prisma.storyboardSegment.findFirst({
    where: { scriptId: plan.scriptId, segmentIndex: plan.segmentIndex },
  })
  if (segment) {
    await prisma.storyboardSegment.update({
      where: { id: segment.id },
      data: { materialIds },
    })
  }
}

/** 批量 AI 匹配：根据文本描述自动将素材匹配到拍摄计划 */
export async function batchMatchByAi(scriptId: number): Promise<{ matched: number; skipped: number }> {
  const plans = await prisma.shootingPlan.findMany({
    where: { scriptId, status: 'pending' },
    orderBy: { segmentIndex: 'asc' },
  })

  // 获取该用户的所有可用素材
  const materials = await prisma.material.findMany({
    where: { type: { in: ['image', 'video'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  let matched = 0
  let skipped = 0

  for (const plan of plans) {
    // 简单文本匹配：素材 tag / filename 包含场景关键词
    const sceneKeywords = plan.scene.split(/[,，\s、]/).filter(w => w.length >= 2)
    const matchedMaterials = materials.filter(m => {
      const text = `${m.name || ''} ${(m.tags || []).join(' ')}`.toLowerCase()
      return sceneKeywords.some(kw => text.includes(kw.toLowerCase()))
    })

    if (matchedMaterials.length > 0) {
      const ids = matchedMaterials.slice(0, 3).map(m => m.id)
      await matchMaterialsForPlan(plan.id, ids)
      matched++
    } else {
      skipped++
    }
  }

  return { matched, skipped }
}
