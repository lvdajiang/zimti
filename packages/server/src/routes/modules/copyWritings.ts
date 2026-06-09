/**
 * 文案 CRUD + AI 操作 API
 *
 * GET    /copy-writings                   列表
 * GET    /copy-writings/:id               详情
 * POST   /copy-writings                   创建
 * POST   /copy-writings/generate          AI 生成初稿
 * POST   /copy-writings/:id/rewrite       AI 改写
 * PUT    /copy-writings/:id               更新内容
 * POST   /copy-writings/:id/check         违禁词检测
 * POST   /copy-writings/:id/replace       一键替换违禁词
 * POST   /copy-writings/:id/finalize      确认定稿
 * POST   /copy-writings/:id/to-script     转为脚本
 */

import { Router } from 'express'
import { prisma } from '../../db.js'
import { getUserId } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { generateCopyDraft, refineCopy } from '../../services/ai/generators/copyDraftGenerate.js'
import { checkProhibitedWords, applyProhibitedReplacements } from '../../services/prohibitedCheck/index.js'
import type { Request, Response } from 'express'

const router: Router = Router()
router.use(optionalAuth)

// ── 列表 ──────────────────────────────────────────────
router.get('/copy-writings', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const topicId = req.query.topic_id ? Number(req.query.topic_id) : undefined
  const status = req.query.status as string | undefined

  const where: any = { userId }
  if (topicId) where.topicId = topicId
  if (status) where.status = status

  const list = await prisma.copyWriting.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(list)
})

// ── 详情 ──────────────────────────────────────────────
router.get('/copy-writings/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const id = req.params.id as string

  const copy = await prisma.copyWriting.findFirst({ where: { id, userId } })
  if (!copy) {
    res.status(404).json({ error: '文案不存在' })
    return
  }

  // 加载版本历史
  const versions = await prisma.copyWriting.findMany({
    where: {
      OR: [
        { id },
        { parentId: id },
      ],
    },
    orderBy: { version: 'asc' },
  })

  res.json({ ...copy, versions })
})

// ── 创建 ──────────────────────────────────────────────
router.post('/copy-writings', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) { res.status(401).json({ error: '需要登录' }); return }

  const { topic_id, title, content, hotspot_ids } = req.body
  if (!title) { res.status(400).json({ error: 'title 为必填' }); return }

  const copy = await prisma.copyWriting.create({
    data: {
      userId,
      topicId: topic_id ?? null,
      hotspotIds: hotspot_ids ?? [],
      title,
      content: content ?? '',
      structure: {},
      status: 'draft',
    },
  })
  res.status(201).json(copy)
})

// ── AI 生成初稿 ───────────────────────────────────────
router.post('/copy-writings/generate', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) { res.status(401).json({ error: '需要登录' }); return }

  const { topic_id, task_id, brand_context, platform } = req.body

  const draft = await generateCopyDraft({
    topic_id,
    task_id,
    brand_context,
    platform,
  })

  const copy = await prisma.copyWriting.create({
    data: {
      userId,
      topicId: topic_id ?? null,
      hotspotIds: [],
      title: draft.title,
      content: draft.content,
      structure: draft.structure,
      status: 'draft',
    },
  })
  res.status(201).json(copy)
})

// ── AI 改写 ───────────────────────────────────────────
router.post('/copy-writings/:id/rewrite', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) { res.status(401).json({ error: '需要登录' }); return }

  const id = req.params.id as string
  const { instruction, selected_text, brand_context } = req.body

  const existing = await prisma.copyWriting.findFirst({ where: { id, userId } })
  if (!existing) { res.status(404).json({ error: '文案不存在' }); return }

  // 如果选中了部分文字，只改写选中部分
  const textToRefine = selected_text || existing.content
  const refined = await refineCopy(textToRefine, instruction || '润色', brand_context)

  // 如果是部分改写，把改写结果替换回原文
  const newContent = selected_text
    ? existing.content.replace(selected_text, refined)
    : refined

  // 创建新版本
  const newCopy = await prisma.copyWriting.create({
    data: {
      userId,
      topicId: existing.topicId,
      hotspotIds: existing.hotspotIds,
      title: existing.title,
      content: newContent,
      structure: existing.structure as any,
      version: existing.version + 1,
      parentId: existing.id,
      status: 'draft',
    },
  })
  res.json(newCopy)
})

// ── 更新内容 ──────────────────────────────────────────
router.put('/copy-writings/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) { res.status(401).json({ error: '需要登录' }); return }

  const id = req.params.id as string
  const { title, content, structure } = req.body

  const existing = await prisma.copyWriting.findFirst({ where: { id, userId } })
  if (!existing) { res.status(404).json({ error: '文案不存在' }); return }

  const updated = await prisma.copyWriting.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(structure !== undefined && { structure }),
    },
  })
  res.json(updated)
})

// ── 违禁词检测 ─────────────────────────────────────────
router.post('/copy-writings/:id/check', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) { res.status(401).json({ error: '需要登录' }); return }

  const id = req.params.id as string
  const { platforms } = req.body

  const existing = await prisma.copyWriting.findFirst({ where: { id, userId } })
  if (!existing) { res.status(404).json({ error: '文案不存在' }); return }

  const report = await checkProhibitedWords(existing.content, platforms)

  // 保存报告到文案记录
  await prisma.copyWriting.update({
    where: { id },
    data: {
      prohibitedReport: report as any,
      status: 'checking',
    },
  })

  res.json(report)
})

// ── 一键替换违禁词 ────────────────────────────────────
router.post('/copy-writings/:id/replace', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) { res.status(401).json({ error: '需要登录' }); return }

  const id = req.params.id as string
  const { items } = req.body // 要替换的违禁词列表

  const existing = await prisma.copyWriting.findFirst({ where: { id, userId } })
  if (!existing) { res.status(404).json({ error: '文案不存在' }); return }

  const newContent = applyProhibitedReplacements(existing.content, items)

  const updated = await prisma.copyWriting.update({
    where: { id },
    data: { content: newContent },
  })
  res.json(updated)
})

// ── 确认定稿 ──────────────────────────────────────────
router.post('/copy-writings/:id/finalize', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) { res.status(401).json({ error: '需要登录' }); return }

  const id = req.params.id as string
  const existing = await prisma.copyWriting.findFirst({ where: { id, userId } })
  if (!existing) { res.status(404).json({ error: '文案不存在' }); return }

  const updated = await prisma.copyWriting.update({
    where: { id },
    data: { status: 'finalized' },
  })
  res.json(updated)
})

// ── 转为脚本 ──────────────────────────────────────────
router.post('/copy-writings/:id/to-script', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  if (!userId) { res.status(401).json({ error: '需要登录' }); return }

  const id = req.params.id as string
  const existing = await prisma.copyWriting.findFirst({ where: { id, userId } })
  if (!existing) { res.status(404).json({ error: '文案不存在' }); return }
  if (existing.status !== 'finalized') { res.status(400).json({ error: '文案未定稿，请先确认定稿' }); return }

  // 创建脚本
  const script = await prisma.script.create({
    data: {
      topicId: existing.topicId ?? 0,
      taskId: '',  // 需要从上下文获取
      fullText: existing.content,
      copyWritingId: existing.id,
      status: 'draft',
    },
  })
  res.status(201).json(script)
})

export default router
