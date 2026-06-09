/**
 * 提示词模板 CRUD API
 *
 * GET    /prompt-templates              列表（系统预设 + 用户自定义）
 * GET    /prompt-templates/:stepKey     获取单个（优先用户自定义）
 * POST   /prompt-templates              创建用户自定义
 * PUT    /prompt-templates/:stepKey     更新用户自定义
 * DELETE /prompt-templates/:stepKey     删除自定义（恢复系统预设）
 * POST   /prompt-templates/seed         重新播种系统预设
 * POST   /prompt-templates/:stepKey/reset 重置为系统预设
 */

import { Router } from 'express'
import { prisma } from '../../db.js'
import { getUserId } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { seedPromptTemplates } from '../../services/promptEngine/index.js'
import type { Request, Response } from 'express'

const router: Router = Router()
router.use(optionalAuth)

// ── 列表 ──────────────────────────────────────────────
router.get('/prompt-templates', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const stepKey = req.query.step_key as string | undefined

  // 系统预设
  const systemWhere: any = { userId: null, isActive: true }
  if (stepKey) systemWhere.stepKey = stepKey
  const systemTemplates = await prisma.promptTemplate.findMany({ where: systemWhere })

  // 用户自定义
  let userTemplates: any[] = []
  if (userId) {
    const userWhere: any = { userId, isActive: true }
    if (stepKey) userWhere.stepKey = stepKey
    userTemplates = await prisma.promptTemplate.findMany({ where: userWhere })
  }

  // 合并：用户自定义覆盖系统预设
  const userMap = new Map(userTemplates.map(t => [t.stepKey, t]))
  const merged = systemTemplates.map(sys => ({
    ...sys,
    isCustom: userMap.has(sys.stepKey),
    customVersion: userMap.get(sys.stepKey) ?? null,
  }))

  // 加上没有系统预设的纯用户模板
  const systemKeys = new Set(systemTemplates.map(t => t.stepKey))
  for (const ut of userTemplates) {
    if (!systemKeys.has(ut.stepKey)) {
      merged.push({ ...ut, isCustom: true, customVersion: ut })
    }
  }

  res.json(merged)
})

// ── 获取单个 ──────────────────────────────────────────
router.get('/prompt-templates/:stepKey', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const stepKey = req.params.stepKey as string

  // 优先用户自定义
  if (userId) {
    const custom = await prisma.promptTemplate.findFirst({
      where: { userId, stepKey, isActive: true },
    })
    if (custom) {
      res.json({ ...custom, isCustom: true })
      return
    }
  }

  // 系统预设
  const system = await prisma.promptTemplate.findFirst({
    where: { userId: null, stepKey, isActive: true },
  })
  if (system) {
    res.json({ ...system, isCustom: false })
    return
  }

  res.status(404).json({ error: `未找到步骤 "${stepKey}" 的提示词模板` })
})

// ── 创建用户自定义 ────────────────────────────────────
router.post('/prompt-templates', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) {
    res.status(401).json({ error: '需要登录' })
    return
  }

  const { stepKey, label, description, systemPrompt, userPromptTemplate, variableDefs } = req.body
  if (!stepKey || !label || !userPromptTemplate) {
    res.status(400).json({ error: 'stepKey, label, userPromptTemplate 为必填' })
    return
  }

  try {
    const template = await prisma.promptTemplate.create({
      data: {
        userId,
        stepKey,
        label,
        description: description ?? null,
        systemPrompt: systemPrompt ?? null,
        userPromptTemplate,
        variableDefs: variableDefs ?? [],
      },
    })
    res.status(201).json(template)
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: `步骤 "${stepKey}" 已有自定义模板，请用 PUT 更新` })
      return
    }
    throw error
  }
})

// ── 更新用户自定义 ────────────────────────────────────
router.put('/prompt-templates/:stepKey', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) {
    res.status(401).json({ error: '需要登录' })
    return
  }

  const stepKey = req.params.stepKey as string
  const { label, description, systemPrompt, userPromptTemplate, variableDefs } = req.body

  const existing = await prisma.promptTemplate.findFirst({
    where: { userId, stepKey },
  })
  if (!existing) {
    res.status(404).json({ error: `未找到步骤 "${stepKey}" 的自定义模板` })
    return
  }

  const updated = await prisma.promptTemplate.update({
    where: { id: existing.id },
    data: {
      ...(label !== undefined && { label }),
      ...(description !== undefined && { description }),
      ...(systemPrompt !== undefined && { systemPrompt }),
      ...(userPromptTemplate !== undefined && { userPromptTemplate }),
      ...(variableDefs !== undefined && { variableDefs }),
      version: { increment: 1 },
    },
  })
  res.json(updated)
})

// ── 删除自定义（恢复系统预设）──────────────────────────
router.delete('/prompt-templates/:stepKey', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) {
    res.status(401).json({ error: '需要登录' })
    return
  }

  const stepKey = req.params.stepKey as string
  const existing = await prisma.promptTemplate.findFirst({
    where: { userId, stepKey },
  })
  if (!existing) {
    res.status(404).json({ error: `未找到步骤 "${stepKey}" 的自定义模板` })
    return
  }

  await prisma.promptTemplate.delete({ where: { id: existing.id } })
  res.status(204).send()
})

// ── 重置为系统预设 ────────────────────────────────────
router.post('/prompt-templates/:stepKey/reset', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) {
    res.status(401).json({ error: '需要登录' })
    return
  }

  const stepKey = req.params.stepKey as string

  // 删除用户自定义
  await prisma.promptTemplate.deleteMany({
    where: { userId, stepKey },
  })

  // 返回系统预设
  const system = await prisma.promptTemplate.findFirst({
    where: { userId: null, stepKey, isActive: true },
  })
  res.json({ ...system, isCustom: false })
})

// ── 重新播种系统预设 ──────────────────────────────────
router.post('/prompt-templates/seed', async (_req: Request, res: Response) => {
  await seedPromptTemplates()
  res.json({ message: '系统预设已重新播种' })
})

export default router
