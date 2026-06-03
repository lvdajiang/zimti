/**
 * GEO 优化路由 — geo.ts
 *
 * 意图问题库 + 内容生成 + 效果监测
 */

import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { getUserId, str, toInt } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { runTask, getTask } from '../../services/ai/index.js'
import { generateGeoQuestions } from '../../services/ai/generators/geoQuestionGenerate.js'
import { generateGeoContent, batchGenerateGeoContent } from '../../services/ai/generators/geoContentGenerate.js'
import type { GeoQuestionCategory } from '@zimti/shared'

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
  const { question_ids, domain, brand_context } = req.body
  if (!Array.isArray(question_ids) || question_ids.length === 0) {
    res.status(400).json({ error: 'question_ids array is required' })
    return
  }

  try {
    const userId = getUserId(req as any)
    const questions = await prisma.geoQuestion.findMany({
      where: { id: { in: question_ids }, userId },
    })

    const task = await runTask(
      {
        type: 'geo_content_batch_generate',
        input: { question_ids, domain, brand_context },
      },
      () => batchGenerateGeoContent(
        questions.map(q => ({
          question_id: q.id,
          question_text: q.question,
          category: q.category,
          domain: domain ? String(domain) : undefined,
          brand_context: brand_context ? String(brand_context) : undefined,
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

export default router
