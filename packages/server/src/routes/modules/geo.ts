/**
 * GEO 优化路由 — geo.ts
 *
 * 意图问题库 + 内容生成 + 效果监测
 */

import { Router } from 'express'
import { randomUUID } from 'crypto'
import cron from 'node-cron'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { getUserId, str, toInt } from '../../constants.js'
import { markStub } from '../../middleware/stubMarker.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { runTask, getTask } from '../../services/ai/index.js'
import { generateGeoQuestions } from '../../services/ai/generators/geoQuestionGenerate.js'
import { generateGeoContent, batchGenerateGeoContent } from '../../services/ai/generators/geoContentGenerate.js'
import { getBrandContextForPrompt, getGeoKnowledgeContext } from '../../services/ai/brandContext.js'
import { generateBrandKnowledge } from '../../services/ai/generators/brandKnowledgeGenerate.js'
import { distillKeywords } from '../../services/ai/generators/keywordDistillGenerate.js'
import { buildKnowledgeFromWeb } from '../../services/ai/generators/webKnowledgeGenerate.js'
import { KnowledgeBuildPipeline } from '../../services/knowledgeBuilder/index.js'
import { extractFactsFromTranscript } from '../../services/knowledgeBuilder/extractFactsFromTranscript.js'
import { verifyFacts } from '../../services/knowledgeBuilder/verifyFacts.js'
import type { FactType } from '@zimti/shared'
import {
  triggerSchedule,
  refreshSchedule, stopSchedule,
} from '../../services/knowledgeScheduler.js'
import type { KnowledgeBuildMode, KnowledgeBuildStepType, GeoQuestionCategory } from '@zimti/shared'

const router: Router = Router()
router.use(optionalAuth)

// ============================================================
// 意图问题库 CRUD
// ============================================================

// GET /api/v1/geo/questions
router.get('/geo/questions', async (req: Request, res: Response) => {
  const category = str(req.query.category)
  const intentType = str(req.query.intent_type)
  const keyword = str(req.query.keyword)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 20), 100)
  const skip = (p - 1) * ps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (category && category !== 'all') where.category = category
  if (intentType && intentType !== 'all') where.intentType = intentType
  if (keyword) where.question = { contains: keyword, mode: 'insensitive' }

  const [items, total] = await Promise.all([
    prisma.geoQuestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: ps,
      include: { _count: { select: { contents: true } } },
    }),
    prisma.geoQuestion.count({ where }),
  ])

  res.json({
    items: items.map(mapQuestion),
    total,
  })
})

// POST /api/v1/geo/questions
router.post('/geo/questions', async (req: Request, res: Response) => {
  const { question, category, intent_type, tags } = req.body
  if (!question) {
    res.status(400).json({ error: 'question is required' })
    return
  }

  const item = await prisma.geoQuestion.create({
    data: {
      userId: getUserId(req as any),
      question: String(question).slice(0, 500),
      category: String(category ?? 'general'),
      intentType: String(intent_type ?? 'informational'),
      aiGenerated: false,
      source: 'manual',
      tags: Array.isArray(tags) ? tags.map(String) : [],
    },
  })
  res.status(201).json(mapQuestion(item))
})

// PUT /api/v1/geo/questions/:id
router.put('/geo/questions/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const { question, category, intent_type, tags } = req.body

  const existing = await prisma.geoQuestion.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const item = await prisma.geoQuestion.update({
    where: { id },
    data: {
      ...(question !== undefined && { question: String(question).slice(0, 500) }),
      ...(category !== undefined && { category: String(category) }),
      ...(intent_type !== undefined && { intentType: String(intent_type) }),
      ...(tags !== undefined && { tags: Array.isArray(tags) ? tags.map(String) : [] }),
    },
  })
  res.json(mapQuestion(item))
})

// DELETE /api/v1/geo/questions/:id
router.delete('/geo/questions/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const existing = await prisma.geoQuestion.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  await prisma.geoQuestion.delete({ where: { id } })
  res.json({ ok: true })
})

// POST /api/v1/geo/questions/generate — AI 批量生成
router.post('/geo/questions/generate', async (req: Request, res: Response) => {
  const { domain, category, count } = req.body

  try {
    const task = await runTask(
      {
        type: 'geo_question_generate',
        input: { domain, category, count },
      },
      () => generateGeoQuestions({
        domain: domain ? String(domain) : undefined,
        category: category as GeoQuestionCategory | undefined,
        count: count ? Number(count) : 10,
      }),
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST geo/questions/generate]', error)
    res.status(500).json({ error: 'Failed to generate questions' })
  }
})

// GET /api/v1/geo/questions/generate/:taskId/status
router.get('/geo/questions/generate/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output })
})

// POST /api/v1/geo/questions/batch — 批量导入
router.post('/geo/questions/batch', async (req: Request, res: Response) => {
  const { questions } = req.body
  if (!Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: 'questions array is required' })
    return
  }

  const userId = getUserId(req as any)
  const items = await prisma.geoQuestion.createMany({
    data: questions.slice(0, 100).map((q: { question: string; category?: string; intent_type?: string; tags?: string[] }) => ({
      userId,
      question: String(q.question).slice(0, 500),
      category: String(q.category ?? 'general'),
      intentType: String(q.intent_type ?? 'informational'),
      aiGenerated: true,
      source: 'ai_batch',
      tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
    })),
  })

  res.status(201).json({ created: items.count })
})

// ============================================================
// GEO 内容生成 CRUD
// ============================================================

// GET /api/v1/geo/contents
router.get('/geo/contents', async (req: Request, res: Response) => {
  const status = str(req.query.status)
  const questionId = str(req.query.question_id)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 20), 100)
  const skip = (p - 1) * ps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (status && status !== 'all') where.status = status
  if (questionId) where.questionId = questionId

  const [items, total] = await Promise.all([
    prisma.geoContent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: ps,
      include: { question: true },
    }),
    prisma.geoContent.count({ where }),
  ])

  res.json({
    items: items.map(mapContent),
    total,
  })
})

// GET /api/v1/geo/contents/:id
router.get('/geo/contents/:id', async (req: Request, res: Response) => {
  const item = await prisma.geoContent.findFirst({
    where: { id: str(req.params.id), userId: getUserId(req as any) },
    include: { question: true, mentions: true },
  })
  if (!item) { res.status(404).json({ error: 'Not found' }); return }
  res.json(mapContent(item))
})

// POST /api/v1/geo/contents
router.post('/geo/contents', async (req: Request, res: Response) => {
  const { question_id, title, content, keywords } = req.body
  if (!question_id || !title || !content) {
    res.status(400).json({ error: 'question_id, title, content are required' })
    return
  }

  const item = await prisma.geoContent.create({
    data: {
      userId: getUserId(req as any),
      questionId: String(question_id),
      title: String(title).slice(0, 200),
      content: String(content),
      keywords: Array.isArray(keywords) ? keywords.map(String) : [],
      status: 'draft',
    },
  })
  res.status(201).json(mapContent(item))
})

// PUT /api/v1/geo/contents/:id
router.put('/geo/contents/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const { title, content, keywords, status } = req.body

  const existing = await prisma.geoContent.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const item = await prisma.geoContent.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: String(title).slice(0, 200) }),
      ...(content !== undefined && { content: String(content) }),
      ...(keywords !== undefined && { keywords: Array.isArray(keywords) ? keywords.map(String) : [] }),
      ...(status !== undefined && {
        status: String(status),
        ...(status === 'published' && { publishedAt: new Date() }),
      }),
    },
  })
  res.json(mapContent(item))
})

// DELETE /api/v1/geo/contents/:id
router.delete('/geo/contents/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const existing = await prisma.geoContent.findFirst({
    where: { id, userId: getUserId(req as any) },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  await prisma.geoContent.delete({ where: { id } })
  res.json({ ok: true })
})

// POST /api/v1/geo/contents/generate — AI 生成单条
router.post('/geo/contents/generate', async (req: Request, res: Response) => {
  const { question_id } = req.body
  if (!question_id) {
    res.status(400).json({ error: 'question_id is required' })
    return
  }

  const question = await prisma.geoQuestion.findFirst({
    where: { id: String(question_id), userId: getUserId(req as any) },
  })
  if (!question) { res.status(404).json({ error: 'Question not found' }); return }

  try {
    const userId = getUserId(req as any)
    const brandContext = await getBrandContextForPrompt(userId)
    const knowledgeContext = await getGeoKnowledgeContext(userId)
    const fullContext = [brandContext, knowledgeContext].filter(Boolean).join('\n\n')
    const task = await runTask(
      {
        type: 'geo_content_generate',
        input: { question_id, question_text: question.question, category: question.category },
        refId: question_id,
        refType: 'geo_question',
      },
      () => generateGeoContent({
        question_id: question.id,
        question_text: question.question,
        category: question.category,
        brand_context: fullContext,
      }),
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST geo/contents/generate]', error)
    res.status(500).json({ error: 'Failed to generate content' })
  }
})

// GET /api/v1/geo/contents/generate/:taskId/status
router.get('/geo/contents/generate/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output })
})

// POST /api/v1/geo/contents/batch-generate — 批量生成
router.post('/geo/contents/batch-generate', async (req: Request, res: Response) => {
  const { question_ids, domain, brand_context: bodyBrandContext } = req.body
  if (!Array.isArray(question_ids) || question_ids.length === 0) {
    res.status(400).json({ error: 'question_ids array is required' })
    return
  }

  try {
    const userId = getUserId(req as any)
    const autoBrandContext = await getBrandContextForPrompt(userId)
    const knowledgeContext = await getGeoKnowledgeContext(userId)
    const autoFullContext = [autoBrandContext, knowledgeContext].filter(Boolean).join('\n\n')
    const brandContext = bodyBrandContext ? String(bodyBrandContext) : autoFullContext
    const questions = await prisma.geoQuestion.findMany({
      where: { id: { in: question_ids }, userId },
    })

    const task = await runTask(
      {
        type: 'geo_content_batch_generate',
        input: { question_ids, domain, brand_context: brandContext },
      },
      () => batchGenerateGeoContent(
        questions.map(q => ({
          question_id: q.id,
          question_text: q.question,
          category: q.category,
          domain: domain ? String(domain) : undefined,
          brand_context: brandContext || undefined,
        })),
      ),
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST geo/contents/batch-generate]', error)
    res.status(500).json({ error: 'Failed to batch generate content' })
  }
})

// GET /api/v1/geo/contents/batch-generate/:taskId/status
router.get('/geo/contents/batch-generate/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output })
})

// GET /api/v1/geo/contents/:id/schema-preview
router.get('/geo/contents/:id/schema-preview', async (req: Request, res: Response) => {
  const item = await prisma.geoContent.findFirst({
    where: { id: str(req.params.id), userId: getUserId(req as any) },
  })
  if (!item) { res.status(404).json({ error: 'Not found' }); return }

  const schemaMarkup = (item.schemaMarkup as Record<string, unknown>) ?? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{
      '@type': 'Question',
      name: (await prisma.geoQuestion.findUnique({ where: { id: item.questionId } }))?.question ?? '',
      acceptedAnswer: { '@type': 'Answer', text: item.content },
    }],
  }

  res.json({ schema_markup: schemaMarkup })
})

// ============================================================
// GEO 提及监测
// ============================================================

// GET /api/v1/geo/mentions
router.get('/geo/mentions', async (req: Request, res: Response) => {
  const searchEngine = str(req.query.search_engine)
  const contentId = str(req.query.content_id)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 20), 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (searchEngine) where.searchEngine = searchEngine
  if (contentId) where.contentId = contentId

  const [items, total] = await Promise.all([
    prisma.geoMention.findMany({
      where,
      orderBy: { checkedAt: 'desc' },
      skip: (p - 1) * ps,
      take: ps,
    }),
    prisma.geoMention.count({ where }),
  ])

  res.json({
    items: items.map(mapMention),
    total,
  })
})

// POST /api/v1/geo/mentions/check — 触发检测
router.post('/geo/mentions/check', async (req: Request, res: Response) => {
  const { content_ids, search_engines } = req.body
  if (!Array.isArray(content_ids) || content_ids.length === 0) {
    res.status(400).json({ error: 'content_ids array is required' })
    return
  }

  // 标注为桩端点：提及检测目前使用模拟数据，未接入真实 AI 搜索 API
  markStub(res, 'GEO 提及检测使用模拟数据，未接入真实 AI 搜索 API')

  try {
    const userId = getUserId(req as any)
    const contents = await prisma.geoContent.findMany({
      where: { id: { in: content_ids }, userId },
      include: { question: true },
    })

    const engines = Array.isArray(search_engines) && search_engines.length > 0
      ? search_engines
      : ['doubao', 'deepseek', 'kimi']

    const task = await runTask(
      {
        type: 'geo_mention_check',
        input: { content_ids, search_engines: engines },
      },
      async () => {
        // 模拟检查：为每个内容+引擎组合创建提及记录
        const results = []
        for (const content of contents) {
          for (const engine of engines) {
            const existing = await prisma.geoMention.findFirst({
              where: { contentId: content.id, searchEngine: engine },
              orderBy: { checkedAt: 'desc' },
            })
            // 模拟：随机更新提及状态（实际应调用各 AI 搜索 API）
            const mentioned = existing?.mentioned ?? false
            results.push({
              content_id: content.id,
              search_engine: engine,
              mentioned,
              checked_at: new Date().toISOString(),
            })
          }
        }
        return results
      },
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST geo/mentions/check]', error)
    res.status(500).json({ error: 'Failed to check mentions' })
  }
})

// GET /api/v1/geo/mentions/check/:taskId/status
router.get('/geo/mentions/check/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output })
})

// GET /api/v1/geo/dashboard — 聚合统计
router.get('/geo/dashboard', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)

  const [
    questionCount,
    contentCount,
    publishedCount,
    mentionStats,
    mentionedAgg,
    topContents,
  ] = await Promise.all([
    prisma.geoQuestion.count({ where: { userId } }),
    prisma.geoContent.count({ where: { userId } }),
    prisma.geoContent.count({ where: { userId, status: 'published' } }),
    prisma.geoMention.groupBy({
      by: ['searchEngine'],
      where: { userId },
      _count: { id: true },
      _sum: { mentionRank: true },
    }),
    // 按 engine 统计 mentioned=true 的数量
    prisma.geoMention.groupBy({
      by: ['searchEngine'],
      where: { userId, mentioned: true },
      _count: { id: true },
    }),
    prisma.geoContent.findMany({
      where: { userId, status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        question: { select: { question: true } },
        _count: { select: { mentions: true } },
      },
    }),
  ])

  res.json({
    overview: {
      total_questions: questionCount,
      total_contents: contentCount,
      published_contents: publishedCount,
    },
    mention_by_engine: mentionStats.map(s => ({
      engine: s.searchEngine,
      total_checks: typeof s._count === 'object' ? s._count.id ?? 0 : 0,
      mentioned_count: mentionedAgg.find(m => m.searchEngine === s.searchEngine)?._count?.id ?? 0,
      avg_rank: s._sum?.mentionRank ?? null,
    })),
    top_contents: topContents.map(c => ({
      id: c.id,
      title: c.title,
      question: c.question?.question ?? '',
      eeat_score: c.eeatScore,
      mention_count: c._count.mentions,
    })),
  })
})

// ============================================================
// Helpers
// ============================================================

interface QuestionRow {
  id: string; userId: string; question: string; category: string;
  intentType: string; aiGenerated: boolean; source: string;
  tags: string[]; createdAt: Date; updatedAt: Date;
  _count?: { contents: number }
}

function mapQuestion(r: QuestionRow) {
  return {
    id: r.id,
    user_id: r.userId,
    question: r.question,
    category: r.category,
    intent_type: r.intentType,
    ai_generated: r.aiGenerated,
    source: r.source,
    tags: r.tags,
    content_count: r._count?.contents ?? 0,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }
}

interface ContentRow {
  id: string; userId: string; questionId: string;
  title: string; content: string; schemaMarkup: unknown;
  keywords: string[]; status: string; eeatScore: number | null;
  publishedAt: Date | null; createdAt: Date; updatedAt: Date;
  question?: { question: string } | null;
}

function mapContent(r: ContentRow) {
  return {
    id: r.id,
    user_id: r.userId,
    question_id: r.questionId,
    question_text: r.question?.question ?? null,
    title: r.title,
    content: r.content,
    schema_markup: r.schemaMarkup as Record<string, unknown> | null,
    keywords: r.keywords,
    status: r.status,
    eeat_score: r.eeatScore,
    published_at: r.publishedAt?.toISOString() ?? null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }
}

interface MentionRow {
  id: string; userId: string; contentId: string;
  searchEngine: string; query: string; mentioned: boolean;
  mentionRank: number | null; mentionSnippet: string | null;
  checkedAt: Date; createdAt: Date;
}

function mapMention(r: MentionRow) {
  return {
    id: r.id,
    user_id: r.userId,
    content_id: r.contentId,
    search_engine: r.searchEngine,
    query: r.query,
    mentioned: r.mentioned,
    mention_rank: r.mentionRank,
    mention_snippet: r.mentionSnippet,
    checked_at: r.checkedAt.toISOString(),
    created_at: r.createdAt.toISOString(),
  }
}

// ============================================================
// 企业知识库 CRUD + AI 生成
// ============================================================

// GET /api/v1/geo/knowledge
router.get('/geo/knowledge', async (req: Request, res: Response) => {
  const category = str(req.query.category)
  const keyword = str(req.query.keyword)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 20), 100)
  const skip = (p - 1) * ps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (category && category !== 'all') where.category = category
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: 'insensitive' } },
      { content: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.brandKnowledge.findMany({ where, orderBy: { sortOrder: 'desc' }, skip, take: ps }),
    prisma.brandKnowledge.count({ where }),
  ])
  res.json({ items: items.map(mapKnowledge), total })
})

// POST /api/v1/geo/knowledge
router.post('/geo/knowledge', async (req: Request, res: Response) => {
  const { title, content, category, tags, source } = req.body
  if (!title || !content || !category) {
    res.status(400).json({ error: 'title, content, category are required' })
    return
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const item = await prisma.brandKnowledge.create({
    data: {
      userId,
      title: String(title),
      content: String(content),
      category: String(category),
      source: source ? String(source) : 'manual',
      tags: Array.isArray(tags) ? tags : [],
    },
  })
  res.status(201).json(mapKnowledge(item))
})

// PUT /api/v1/geo/knowledge/:id
router.put('/geo/knowledge/:id', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const id = str(req.params.id)
  const existing = await prisma.brandKnowledge.findFirst({ where: { id, userId } })
  if (!existing) { res.status(404).json({ error: 'Knowledge not found' }); return }
  const { title, content, category, tags, is_active, sort_order } = req.body
  const item = await prisma.brandKnowledge.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: String(title) }),
      ...(content !== undefined && { content: String(content) }),
      ...(category !== undefined && { category: String(category) }),
      ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : [] }),
      ...(is_active !== undefined && { isActive: Boolean(is_active) }),
      ...(sort_order !== undefined && { sortOrder: toInt(sort_order, 0) }),
    },
  })
  res.json(mapKnowledge(item))
})

// DELETE /api/v1/geo/knowledge/:id
router.delete('/geo/knowledge/:id', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const id = str(req.params.id)
  const existing = await prisma.brandKnowledge.findFirst({ where: { id, userId } })
  if (!existing) { res.status(404).json({ error: 'Knowledge not found' }); return }
  await prisma.brandKnowledge.delete({ where: { id } })
  res.json({ success: true })
})

// POST /api/v1/geo/knowledge/generate
router.post('/geo/knowledge/generate', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const { domain, category, count } = req.body

  try {
    const existing = await prisma.brandKnowledge.findMany({
      where: { userId },
      select: { title: true },
    })
    const task = await runTask(
      { type: 'geo_knowledge_generate', input: { domain, category, count } },
      () => generateBrandKnowledge({
        domain: domain ? String(domain) : undefined,
        category: category || undefined,
        count: count ? toInt(count, 5) : 5,
        existing_titles: existing.map(e => e.title),
      }),
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST geo/knowledge/generate]', error)
    res.status(500).json({ error: 'Failed to generate knowledge' })
  }
})

// GET /api/v1/geo/knowledge/generate/:taskId/status
router.get('/geo/knowledge/generate/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output })
})

// POST /api/v1/geo/knowledge/search-and-build
// 全网搜索 + AI 提取 → 写入知识库
router.post('/geo/knowledge/search-and-build', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const { topic, category, count } = req.body

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    res.status(400).json({ error: 'topic 为必填字段' })
    return
  }

  try {
    // 查询已有知识标题用于去重
    const existing = await prisma.brandKnowledge.findMany({
      where: { userId },
      select: { title: true },
    })

    const task = await runTask(
      { type: 'geo_knowledge_web_build', input: { topic, category, count } },
      async () => {
        const result = await buildKnowledgeFromWeb({
          topic: String(topic).trim(),
          category: category || undefined,
          count: count ? toInt(count, 5) : 5,
          existingTitles: existing.map(e => e.title),
        })

        // 批量写入 BrandKnowledge
        const createdItems = []
        for (const item of result.knowledgeItems) {
          try {
            const record = await prisma.brandKnowledge.create({
              data: {
                userId,
                title: item.title,
                content: item.content,
                category: item.category,
                source: `web_search:${item.source_url}`.slice(0, 30),
                tags: item.tags,
                isActive: true,
                sortOrder: 0,
              },
            })
            createdItems.push(record)
          } catch (err) {
            console.warn(`[WebKnowledgeBuild] 写入失败 "${item.title}":`, err)
          }
        }

        return {
          search_results_count: result.searchResults.length,
          knowledge_items: result.knowledgeItems.map(k => ({
            title: k.title,
            content: k.content,
            category: k.category,
            tags: k.tags,
            source_url: k.source_url,
            confidence: k.confidence,
          })),
          created_count: createdItems.length,
        }
      },
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST geo/knowledge/search-and-build]', error)
    res.status(500).json({ error: 'Failed to build knowledge from web search' })
  }
})

// GET /api/v1/geo/knowledge/search-and-build/:taskId/status
router.get('/geo/knowledge/search-and-build/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output, error: task.error })
})

// ============================================================
// 知识库构建引擎
// ============================================================

// POST /api/v1/geo/knowledge/build — 启动构建（先运行评估，暂停等待确认）
router.post('/geo/knowledge/build', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const { topic, mode, category, distillBatchIds } = req.body

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    res.status(400).json({ error: 'topic 为必填字段' })
    return
  }

  const buildMode = (mode === 'step' ? 'step' : 'auto') as KnowledgeBuildMode
  const topicStr = String(topic).trim()

  try {
    // 查询可用的蒸馏关键词
    let distilledKeywords: Array<{ keyword: string; intentType: string; totalScore: number; competition: string }> = []

    if (Array.isArray(distillBatchIds) && distillBatchIds.length > 0) {
      // 用户指定了批次
      distilledKeywords = await prisma.keywordDistillation.findMany({
        where: { userId, batchId: { in: distillBatchIds }, status: 'pending' },
        orderBy: { totalScore: 'desc' },
        take: 30,
        select: { keyword: true, intentType: true, totalScore: true, competition: true },
      })
    } else {
      // 自动按 domain 匹配
      distilledKeywords = await prisma.keywordDistillation.findMany({
        where: { userId, domain: { contains: topicStr }, status: 'pending' },
        orderBy: { totalScore: 'desc' },
        take: 30,
        select: { keyword: true, intentType: true, totalScore: true, competition: true },
      })
    }

    console.log(`[POST geo/knowledge/build] 找到 ${distilledKeywords.length} 个蒸馏关键词`)

    // 创建 Job 记录
    const job = await prisma.knowledgeBuildJob.create({
      data: {
        userId,
        topic: topicStr,
        mode: buildMode,
        status: 'pending',
        input: {
          topic: topicStr,
          mode: buildMode,
          category: category || null,
          distilledKeywordCount: distilledKeywords.length,
        },
      },
    })

    const pipeline = new KnowledgeBuildPipeline({
      jobId: job.id,
      userId,
      topic: topicStr,
      mode: buildMode,
      distilledKeywords: distilledKeywords.length > 0 ? distilledKeywords : undefined,
    })

    // 异步执行：先运行 evaluation 步骤，然后暂停等待确认
    setImmediate(async () => {
      try {
        await pipeline.runUntil('evaluation')
      } catch (err) {
        console.error('[POST geo/knowledge/build] Pipeline 评估步骤失败:', err)
      }
    })

    res.json({ job_id: job.id, status: job.status, mode: job.mode })
  } catch (error) {
    console.error('[POST geo/knowledge/build]', error)
    res.status(500).json({ error: 'Failed to start knowledge build' })
  }
})

// POST /api/v1/geo/knowledge/build/:jobId/confirm-plan — 确认评估方案，继续执行
router.post('/geo/knowledge/build/:jobId/confirm-plan', async (req: Request, res: Response) => {
  const jobId = str(req.params.jobId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const { adjustedDimensions } = req.body  // 可选：用户调整后的维度

  try {
    // 如果用户调整了维度，更新 evaluation 步骤的 output
    if (Array.isArray(adjustedDimensions) && adjustedDimensions.length > 0) {
      const evalStep = await prisma.knowledgeBuildStep.findFirst({
        where: { jobId, stepType: 'evaluation' },
      })
      if (evalStep?.output && typeof evalStep.output === 'object') {
        const plan = evalStep.output as Record<string, unknown>
        plan.dimensions = adjustedDimensions
        await prisma.knowledgeBuildStep.update({
          where: { id: evalStep.id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { output: plan as any },
        })
      }
    }

    const job = await prisma.knowledgeBuildJob.findUnique({ where: { id: jobId } })
    if (!job) { res.status(404).json({ error: '构建任务未找到' }); return }

    const buildMode = job.mode as KnowledgeBuildMode
    const pipeline = new KnowledgeBuildPipeline({ jobId, userId, topic: job.topic, mode: buildMode })

    // 异步执行剩余步骤
    setImmediate(async () => {
      try {
        if (buildMode === 'step') {
          // 分步模式：从 dimension_split 开始，执行一步后暂停
          await pipeline.continueFrom('dimension_split')
        } else {
          // 自动模式：从 dimension_split 开始，执行全部剩余步骤
          await pipeline.continueFrom('dimension_split')
        }
      } catch (err) {
        console.error('[POST geo/knowledge/build/confirm-plan] Pipeline 执行失败:', err)
      }
    })

    // 短暂等待让 pipeline 更新状态
    await new Promise(r => setTimeout(r, 50))
    const updatedJob = await prisma.knowledgeBuildJob.findUnique({ where: { id: jobId } })
    res.json({ job_id: jobId, status: updatedJob?.status || 'running', mode: buildMode })
  } catch (error) {
    console.error('[POST geo/knowledge/build/confirm-plan]', error)
    res.status(500).json({ error: 'Failed to confirm plan' })
  }
})

// GET /api/v1/geo/knowledge/build/:jobId — 获取构建任务+所有步骤
router.get('/geo/knowledge/build/:jobId', async (req: Request, res: Response) => {
  const jobId = str(req.params.jobId)

  const pipeline = new KnowledgeBuildPipeline({ jobId, userId: '', topic: '', mode: 'auto' })
  const status = await pipeline.getJobStatus()

  if (!status) {
    res.status(404).json({ error: '构建任务未找到' })
    return
  }

  res.json(status)
})

// POST /api/v1/geo/knowledge/build/:jobId/step/:stepType — step模式执行单步
router.post('/geo/knowledge/build/:jobId/step/:stepType', async (req: Request, res: Response) => {
  const jobId = str(req.params.jobId)
  const stepType = req.params.stepType as KnowledgeBuildStepType

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)

  try {
    const pipeline = new KnowledgeBuildPipeline({ jobId, userId, topic: '', mode: 'step' })
    await pipeline.continueFrom(stepType)
    const status = await pipeline.getJobStatus()
    res.json(status)
  } catch (error) {
    console.error(`[POST geo/knowledge/build/${jobId}/step]`, error)
    res.status(500).json({ error: 'Failed to execute step' })
  }
})

// DELETE /api/v1/geo/knowledge/build/:jobId — 取消构建任务
router.delete('/geo/knowledge/build/:jobId', async (req: Request, res: Response) => {
  const jobId = str(req.params.jobId)

  await prisma.knowledgeBuildJob.update({
    where: { id: jobId },
    data: { status: 'cancelled', completedAt: new Date() },
  })

  res.json({ ok: true })
})

// --- 定时任务 ---

// GET /api/v1/geo/knowledge/schedules — 列出定时任务
router.get('/geo/knowledge/schedules', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)

  const schedules = await prisma.knowledgeBuildSchedule.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  res.json({ schedules })
})

// POST /api/v1/geo/knowledge/schedules — 创建定时任务
router.post('/geo/knowledge/schedules', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const { topic, category, count, cronExpr } = req.body

  if (!topic || !cronExpr) {
    res.status(400).json({ error: 'topic 和 cronExpr 为必填' })
    return
  }

  // 验证 cron 表达式
  if (!cron.validate(cronExpr)) {
    res.status(400).json({ error: 'cron 表达式无效' })
    return
  }

  const schedule = await prisma.knowledgeBuildSchedule.create({
    data: {
      userId,
      topic: String(topic).trim(),
      category: category || null,
      count: count ? toInt(count, 5) : 5,
      cronExpr: String(cronExpr),
    },
  })

  refreshSchedule(schedule.id, userId, schedule.topic, schedule.cronExpr)
  res.json(schedule)
})

// PUT /api/v1/geo/knowledge/schedules/:id — 更新定时任务
router.put('/geo/knowledge/schedules/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const { topic, category, count, cronExpr, isActive } = req.body

  const existing = await prisma.knowledgeBuildSchedule.findUnique({ where: { id } })
  if (!existing) { res.status(404).json({ error: '定时任务未找到' }); return }

  const data: Record<string, unknown> = {}
  if (topic !== undefined) data.topic = String(topic).trim()
  if (category !== undefined) data.category = category || null
  if (count !== undefined) data.count = toInt(count, 5)
  if (cronExpr !== undefined) {
    if (!cron.validate(cronExpr)) {
      res.status(400).json({ error: 'cron 表达式无效' })
      return
    }
    data.cronExpr = String(cronExpr)
  }
  if (isActive !== undefined) data.isActive = Boolean(isActive)

  const updated = await prisma.knowledgeBuildSchedule.update({ where: { id }, data })

  // 重新注册或停止
  if (updated.isActive) {
    refreshSchedule(updated.id, userId, updated.topic, updated.cronExpr)
  } else {
    stopSchedule(updated.id)
  }

  res.json(updated)
})

// DELETE /api/v1/geo/knowledge/schedules/:id — 删除定时任务
router.delete('/geo/knowledge/schedules/:id', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  stopSchedule(id)
  await prisma.knowledgeBuildSchedule.delete({ where: { id } })
  res.json({ ok: true })
})

// POST /api/v1/geo/knowledge/schedules/:id/run — 手动触发一次
router.post('/geo/knowledge/schedules/:id/run', async (req: Request, res: Response) => {
  const jobId = await triggerSchedule(str(req.params.id))
  if (!jobId) { res.status(404).json({ error: '定时任务未找到' }); return }
  res.json({ job_id: jobId })
})

// ============================================================
// 关键词蒸馏
// ============================================================

// GET /api/v1/geo/distill/by-domain — 按主题查询可用蒸馏关键词
router.get('/geo/distill/by-domain', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const domain = str(req.query.domain)

  if (!domain) {
    res.json({ keywords: [], batches: [] })
    return
  }

  const keywords = await prisma.keywordDistillation.findMany({
    where: { userId, domain: { contains: domain }, status: 'pending' },
    orderBy: { totalScore: 'desc' },
    take: 30,
    select: {
      id: true,
      keyword: true,
      intentType: true,
      totalScore: true,
      competition: true,
      batchId: true,
    },
  })

  const batches = await prisma.keywordDistillation.groupBy({
    by: ['batchId'],
    where: { userId, domain: { contains: domain }, status: 'pending' },
    _count: true,
  })

  res.json({ keywords, batches })
})

// GET /api/v1/geo/distill/batches
router.get('/geo/distill/batches', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)

  // 单次查询：按 batchId + status 分组聚合，避免 N+1
  const grouped = await prisma.keywordDistillation.groupBy({
    by: ['batchId', 'domain'],
    where: { userId },
    _count: true,
    _min: { createdAt: true },
    orderBy: { _min: { createdAt: 'desc' } },
  })

  // 再查每个 batchId 下按 status 的分布
  const statusGroups = await prisma.keywordDistillation.groupBy({
    by: ['batchId', 'status'],
    where: { userId },
    _count: true,
  })

  // 内存聚合
  const batchMap = new Map<string, { domain: string | null; created_at: string; counts: Record<string, number> }>()
  for (const g of grouped) {
    if (!batchMap.has(g.batchId)) {
      batchMap.set(g.batchId, {
        domain: g.domain,
        created_at: g._min.createdAt?.toISOString() ?? new Date().toISOString(),
        counts: {},
      })
    }
  }
  for (const sg of statusGroups) {
    const entry = batchMap.get(sg.batchId)
    if (entry) entry.counts[sg.status] = sg._count
  }

  const result = Array.from(batchMap.entries()).map(([batchId, data]) => ({
    batch_id: batchId,
    domain: data.domain,
    created_at: data.created_at,
    counts: data.counts,
  }))
  res.json({ batches: result })
})

// GET /api/v1/geo/distill
router.get('/geo/distill', async (req: Request, res: Response) => {
  const batchId = str(req.query.batch_id)
  const status = str(req.query.status)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 50), 200)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: getUserId(req as any) }
  if (batchId) where.batchId = batchId
  if (status && status !== 'all') where.status = status

  const [items, total] = await Promise.all([
    prisma.keywordDistillation.findMany({ where, orderBy: { totalScore: 'desc' }, skip: (p - 1) * ps, take: ps }),
    prisma.keywordDistillation.count({ where }),
  ])
  res.json({ items: items.map(mapDistill), total })
})

// POST /api/v1/geo/distill/start
router.post('/geo/distill/start', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const { keywords, domain } = req.body
  if (!Array.isArray(keywords) || keywords.length === 0) {
    res.status(400).json({ error: 'keywords array is required' })
    return
  }

  try {
    const brandContext = await getBrandContextForPrompt(userId)
    const knowledgeContext = await getGeoKnowledgeContext(userId)
    const fullContext = [brandContext, knowledgeContext].filter(Boolean).join('\n\n')
    const distillDomain = domain ? String(domain) : '新疆旅游'

    const task = await runTask(
      { type: 'geo_keyword_distill', input: { keywords, domain: distillDomain } },
      async () => {
        const result = await distillKeywords({
          keywords: keywords.map(String),
          domain: distillDomain,
          brand_context: fullContext || undefined,
        })
        // 批量写入数据库
        const batchId = randomUUID()
        await prisma.keywordDistillation.createMany({
          data: result.results.map(r => ({
            userId,
            batchId,
            keyword: r.keyword,
            intentType: r.intent_type,
            competition: r.competition,
            brandRelevance: r.brand_relevance,
            contentOpportunity: r.content_opportunity,
            totalScore: r.total_score,
            recommendation: r.recommendation,
            domain: distillDomain,
          })),
        })
        return { batch_id: batchId, count: result.results.length }
      },
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST geo/distill/start]', error)
    res.status(500).json({ error: 'Failed to start distillation' })
  }
})

// GET /api/v1/geo/distill/start/:taskId/status
router.get('/geo/distill/start/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output })
})

// POST /api/v1/geo/distill/import — 导入选中词到问题库
router.post('/geo/distill/import', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids array is required' })
    return
  }

  const items = await prisma.keywordDistillation.findMany({
    where: { id: { in: ids }, userId, status: 'pending' },
  })
  if (items.length === 0) {
    res.json({ imported: 0 })
    return
  }

  // 创建 GeoQuestion 记录
  await prisma.geoQuestion.createMany({
    data: items.map(item => ({
      userId,
      question: item.keyword,
      category: 'general',
      intentType: item.intentType,
      aiGenerated: true,
      source: 'distill',
      tags: [item.competition],
    })),
  })

  // 标记为已导入
  await prisma.keywordDistillation.updateMany({
    where: { id: { in: ids }, userId },
    data: { status: 'imported' },
  })

  res.json({ imported: items.length })
})

// PUT /api/v1/geo/distill/:id — 更新状态
router.put('/geo/distill/:id', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const id = str(req.params.id)
  const { status } = req.body
  if (!status) { res.status(400).json({ error: 'status is required' }); return }

  const existing = await prisma.keywordDistillation.findFirst({ where: { id, userId } })
  if (!existing) { res.status(404).json({ error: 'Distill result not found' }); return }

  const item = await prisma.keywordDistillation.update({
    where: { id },
    data: { status: String(status) },
  })
  res.json(mapDistill(item))
})

// DELETE /api/v1/geo/distill/batch/:batchId
router.delete('/geo/distill/batch/:batchId', async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = getUserId(req as any)
  const batchId = str(req.params.batchId)
  await prisma.keywordDistillation.deleteMany({ where: { userId, batchId } })
  res.json({ success: true })
})

// ============================================================
// 数据映射辅助函数
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapKnowledge(r: any) {
  return {
    id: r.id,
    user_id: r.userId,
    title: r.title,
    content: r.content,
    category: r.category,
    source: r.source,
    tags: r.tags,
    is_active: r.isActive,
    sort_order: r.sortOrder,
    content_type: r.contentType || null,
    fact_type: r.factType || null,
    verification_status: r.verificationStatus || null,
    metadata: r.metadata || null,
    created_at: r.createdAt?.toISOString?.() ?? r.created_at,
    updated_at: r.updatedAt?.toISOString?.() ?? r.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDistill(r: any) {
  return {
    id: r.id,
    user_id: r.userId,
    batch_id: r.batchId,
    keyword: r.keyword,
    intent_type: r.intentType,
    competition: r.competition,
    brand_relevance: r.brandRelevance,
    content_opportunity: r.contentOpportunity,
    total_score: r.totalScore,
    recommendation: r.recommendation,
    status: r.status,
    domain: r.domain,
    created_at: r.createdAt?.toISOString?.() ?? r.created_at,
    updated_at: r.updatedAt?.toISOString?.() ?? r.updated_at,
  }
}

// ============================================================
// 原子事实提取
// ============================================================

// POST /api/v1/geo/facts/extract — 从文案提取原子事实
router.post('/geo/facts/extract', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const { transcript, topic, verify: doVerify } = req.body

  if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 50) {
    res.status(400).json({ error: 'transcript 为必填字段，至少50字' })
    return
  }

  try {
    const task = await runTask(
      { type: 'fact_extract', input: { topic, verify: !!doVerify } },
      async () => {
        const result = await extractFactsFromTranscript({
          transcript: String(transcript).trim(),
          topic: topic ? String(topic) : undefined,
          maxFacts: 80,
        })

        let facts = result.facts

        // 可选：验证后直接写入 BrandKnowledge
        if (doVerify && facts.length > 0) {
          facts = await verifyFacts(facts)
        }

        // 写入 BrandKnowledge（contentType='fact'）
        const createdIds: string[] = []
        for (const fact of facts) {
          try {
            const record = await prisma.brandKnowledge.create({
              data: {
                userId,
                title: fact.content.slice(0, 200),
                content: fact.content,
                category: 'industry',
                source: 'fact_extract',
                credibility: fact.confidence,
                tags: fact.tags,
                isActive: !('verificationStatus' in fact && (fact as any).verificationStatus === 'rejected'),
                contentType: 'fact',
                factType: fact.factType,
                verificationStatus: doVerify ? (('verificationStatus' in fact) ? (fact as any).verificationStatus : 'unverified') : null,
                metadata: {
                  sourceUrls: fact.sourceUrls,
                  confidence: fact.confidence,
                  factContext: fact.factContext,
                  extractSource: 'transcript',
                },
              },
            })
            createdIds.push(record.id)
          } catch (err) {
            console.warn(`[FactExtract] 写入失败:`, err instanceof Error ? err.message : err)
          }
        }

        return {
          topic: result.topic,
          total_extracted: result.totalCount,
          saved_count: createdIds.length,
          facts: facts.map(f => ({
            content: f.content,
            fact_type: f.factType,
            confidence: f.confidence,
            fact_context: f.factContext,
            tags: f.tags,
            needs_verification: f.needsVerification,
            verification_status: 'verificationStatus' in f ? (f as any).verificationStatus : null,
            verification_note: 'verificationNote' in f ? (f as any).verificationNote : null,
          })),
        }
      },
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST geo/facts/extract]', error)
    res.status(500).json({ error: '事实提取失败' })
  }
})

// GET /api/v1/geo/facts/extract/:taskId/status
router.get('/geo/facts/extract/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output, error: task.error })
})

// POST /api/v1/geo/facts/verify — 批量验证已有事实
router.post('/geo/facts/verify', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const { fact_ids } = req.body

  if (!Array.isArray(fact_ids) || fact_ids.length === 0) {
    res.status(400).json({ error: 'fact_ids 为必填数组' })
    return
  }

  const facts = await prisma.brandKnowledge.findMany({
    where: { id: { in: fact_ids }, userId, contentType: 'fact' },
  })

  if (facts.length === 0) {
    res.json({ task_id: null, verified: 0 })
    return
  }

  try {
    const task = await runTask(
      { type: 'fact_verify', input: { fact_ids } },
      async () => {
        const atomicFacts = facts.map(f => ({
          content: f.content,
          factType: (f.factType as FactType) || 'definition',
          confidence: f.credibility,
          factContext: (f.metadata as any)?.factContext || '',
          sourceUrls: (f.metadata as any)?.sourceUrls || [],
          tags: f.tags,
          needsVerification: true,
        }))

        const verified = await verifyFacts(atomicFacts)

        let verifiedCount = 0
        for (let i = 0; i < facts.length; i++) {
          const v = verified.find(vf => vf.content === facts[i].content)
          if (v) {
            await prisma.brandKnowledge.update({
              where: { id: facts[i].id },
              data: {
                verificationStatus: v.verificationStatus,
                credibility: v.confidence,
                isActive: v.verificationStatus !== 'rejected',
                metadata: {
                  ...(typeof facts[i].metadata === 'object' && facts[i].metadata ? facts[i].metadata as Record<string, unknown> : {}),
                  sourceUrls: v.sourceUrls,
                  verifiedAt: new Date().toISOString(),
                  verifiedBy: 'ai',
                },
              },
            })
            if (v.verificationStatus === 'verified') verifiedCount++
          }
        }
        return { verified: verifiedCount, total: facts.length }
      },
    )
    res.json({ task_id: task.id, status: task.status })
  } catch (error) {
    console.error('[POST geo/facts/verify]', error)
    res.status(500).json({ error: '验证失败' })
  }
})

// GET /api/v1/geo/facts/verify/:taskId/status
router.get('/geo/facts/verify/:taskId/status', async (req: Request, res: Response) => {
  const task = await getTask(str(req.params.taskId))
  if (!task) { res.status(404).json({ error: 'Task not found' }); return }
  res.json({ task_id: task.id, status: task.status, output: task.output, error: task.error })
})

// GET /api/v1/geo/facts — 查询事实列表
router.get('/geo/facts', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const factType = str(req.query.fact_type)
  const verificationStatus = str(req.query.verification_status)
  const keyword = str(req.query.keyword)
  const p = toInt(req.query.page, 1)
  const ps = Math.min(toInt(req.query.page_size, 50), 200)
  const skip = (p - 1) * ps

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId, contentType: 'fact' }
  if (factType && factType !== 'all') where.factType = factType
  if (verificationStatus && verificationStatus !== 'all') where.verificationStatus = verificationStatus
  if (keyword) {
    where.OR = [
      { content: { contains: keyword, mode: 'insensitive' } },
      { title: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.brandKnowledge.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: ps }),
    prisma.brandKnowledge.count({ where }),
  ])

  res.json({
    items: items.map(f => ({
      id: f.id,
      content: f.content,
      title: f.title,
      fact_type: f.factType,
      verification_status: f.verificationStatus,
      credibility: f.credibility,
      tags: f.tags,
      metadata: f.metadata,
      is_active: f.isActive,
      created_at: f.createdAt.toISOString(),
    })),
    total,
  })
})

// PUT /api/v1/geo/facts/:id — 编辑事实
router.put('/geo/facts/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const id = str(req.params.id)
  const { content, factType, verificationStatus, tags, is_active } = req.body

  const existing = await prisma.brandKnowledge.findFirst({
    where: { id, userId, contentType: 'fact' },
  })
  if (!existing) { res.status(404).json({ error: 'Fact not found' }); return }

  const item = await prisma.brandKnowledge.update({
    where: { id },
    data: {
      ...(content !== undefined && { content: String(content), title: String(content).slice(0, 200) }),
      ...(factType !== undefined && { factType: String(factType) }),
      ...(verificationStatus !== undefined && { verificationStatus: String(verificationStatus) }),
      ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : [] }),
      ...(is_active !== undefined && { isActive: Boolean(is_active) }),
    },
  })
  res.json({ id: item.id, ok: true })
})

export default router
