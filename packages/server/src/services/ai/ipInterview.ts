import { Router } from 'express'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { getAIProvider } from '../ai/provider.js'
import type { Request, Response } from 'express'

// 四层提问框架
const QUESTION_LAYERS = [
  { layer: 1, type: 'event', label: '事件层', description: '你最近做了什么？/ 你有什么经历？' },
  { layer: 2, type: 'behavior', label: '行为层', description: '你是怎么做到的？/ 你当时怎么想的？' },
  { layer: 3, type: 'feeling', label: '感受层', description: '你当时什么感觉？/ 最让你开心/困扰的是什么？' },
  { layer: 4, type: 'belief', label: '信念层', description: '你为什么觉得这很重要？/ 你的核心价值观是什么？' },
] as const

interface InterviewSession {
  topic: string
  currentLayer: number
  answers: Array<{ layer: number; type: string; question: string; answer: string }>
}

// 预设行业模板数据
const PRESET_TEMPLATES: Array<{
  industry: string
  name: string
  description: string
  config: Record<string, unknown>
}> = [
  {
    industry: 'travel',
    name: '旅行自媒体',
    description: '旅行体验类自媒体，以个人IP为核心输出旅行攻略、体验分享',
    config: {
      persona_default: { tone: '真诚分享', style: '体验式叙述', target_audience: '向往旅行的城市白领' },
      content_types: ['旅行攻略', '目的地探店', '旅行vlog', '酒店测评', '美食打卡'],
      pipeline_presets: { viral_remind: true, daily_auto: false, hotspot_rush: true },
    },
  },
  {
    industry: 'food',
    name: '美食探店',
    description: '以美食探索和餐厅推荐为核心的美食自媒体',
    config: {
      persona_default: { tone: '热情分享', style: '沉浸式描述', target_audience: '美食爱好者' },
      content_types: ['探店测评', '美食攻略', '烹饪教程', '食材科普', '餐厅推荐'],
      pipeline_presets: { viral_remind: true, daily_auto: false, hotspot_rush: true },
    },
  },
  {
    industry: 'education',
    name: '知识分享',
    description: '以知识输出和技能教学为核心的教育自媒体',
    config: {
      persona_default: { tone: '专业权威', style: '结构化教学', target_audience: '求知者/学习者' },
      content_types: ['知识科普', '技能教学', '行业分析', '经验分享', '问答互动'],
      pipeline_presets: { viral_remind: true, daily_auto: true, hotspot_rush: false },
    },
  },
  {
    industry: 'fitness',
    name: '健身运动',
    description: '以健身指导和运动生活为核心的健身自媒体',
    config: {
      persona_default: { tone: '激励陪伴', style: '实操演示', target_audience: '健身小白/运动爱好者' },
      content_types: ['健身教程', '饮食指导', '运动打卡', '身材变化', '装备推荐'],
      pipeline_presets: { viral_remind: true, daily_auto: true, hotspot_rush: false },
    },
  },
]

export class IpInterviewService {
  private userId: string

  constructor(userId: string = DEMO_USER_ID) {
    this.userId = userId
  }

  getLayers(): typeof QUESTION_LAYERS {
    return QUESTION_LAYERS
  }

  async startInterview(topic: string): Promise<InterviewSession> {
    const ai = getAIProvider()
    if (!ai) {
      return {
        topic,
        currentLayer: 1,
        answers: [],
      }
    }

    const prompt = `你是一位专业的IP定位访谈师。用户想要做"${topic}"相关的自媒体。

请生成第一层（事件层）的3个开场提问，帮助了解用户的基本经历和背景。
提问要自然、友好，不要像面试官。

返回 JSON：{ "questions": ["问题1", "问题2", "问题3"] }`

    try {
      const result = await ai.generate(prompt, '你是IP定位访谈师。返回纯 JSON。')
      JSON.parse(result) // validate JSON
      return {
        topic,
        currentLayer: 1,
        answers: [],
      }
    } catch {
      return {
        topic,
        currentLayer: 1,
        answers: [],
      }
    }
  }

  async nextQuestion(
    session: InterviewSession,
    userAnswer: string,
  ): Promise<{
    session: InterviewSession
    nextQuestion: string | null
    isComplete: boolean
  }> {
    session.answers.push({
      layer: session.currentLayer,
      type: QUESTION_LAYERS[session.currentLayer - 1].type,
      question: '',  // 由调用者补充
      answer: userAnswer,
    })

    // 判断是否需要深挖（回答太短或太笼统）
    const isShallow = userAnswer.length < 20 || /^(不知道|没啥|还行|正常|一般|嗯)[，。！？]*$/.test(userAnswer)

    if (isShallow && session.answers.filter((a) => a.layer === session.currentLayer).length < 2) {
      const ai = getAIProvider()
      let followUp = `能具体说说吗？比如有什么细节让你印象深刻的？`
      if (ai) {
        try {
          const prompt = `用户在做"${session.topic}"相关的IP访谈，当前在第${session.currentLayer}层(${QUESTION_LAYERS[session.currentLayer - 1].label})。
用户刚才的回答很简短："${userAnswer}"
请生成一个追问，引导用户给出更具体的回答。

返回 JSON：{ "follow_up": "追问内容" }`
          const result = await ai.generate(prompt, '你是IP定位访谈师。返回纯 JSON。')
          const parsed = JSON.parse(result)
          followUp = parsed.follow_up || followUp
        } catch { /* use default follow-up */ }
      }
      return { session, nextQuestion: followUp, isComplete: false }
    }

    // 进入下一层
    session.currentLayer++

    // 全部4层完成
    if (session.currentLayer > 4) {
      return { session, nextQuestion: null, isComplete: true }
    }

    const ai = getAIProvider()
    let nextQ = `请谈谈${QUESTION_LAYERS[session.currentLayer - 1].description}`
    if (ai) {
      try {
        const layerInfo = QUESTION_LAYERS[session.currentLayer - 1]
        const previousSummary = session.answers
          .map((a) => `[${QUESTION_LAYERS[a.layer - 1].label}] ${a.answer}`)
          .join('\n')

        const prompt = `你是一位专业的IP定位访谈师。用户正在做"${session.topic}"的IP访谈。
之前用户回答摘要：
${previousSummary}

现在进入第${session.currentLayer}层(${layerInfo.label})：${layerInfo.description}
请生成一个过渡自然、不突兀的问题。

返回 JSON：{ "question": "你的问题" }`
        const result = await ai.generate(prompt, '你是IP定位访谈师。返回纯 JSON。')
        const parsed = JSON.parse(result)
        nextQ = parsed.question || nextQ
      } catch { /* use default question */ }
    }

    return { session, nextQuestion: nextQ, isComplete: false }
  }

  async generateProfile(session: InterviewSession): Promise<{
    profile: Record<string, unknown>
    canvas: Record<string, string>
  }> {
    const ai = getAIProvider()
    if (!ai) {
      return {
        profile: { topic: session.topic },
        canvas: {},
      }
    }

    const answersSummary = session.answers
      .map((a) => `[${QUESTION_LAYERS[a.layer - 1].label}] ${a.answer}`)
      .join('\n')

    const prompt = `根据以下IP访谈记录，生成IP定位画布。

访谈主题：${session.topic}

访谈记录：
${answersSummary}

请生成IP定位画布，返回 JSON：
{
  "profile": {
    "定位一句话": "...",
    "核心优势": "...",
    "独特风格": "...",
    "目标受众": "...",
    "内容方向": ["...", "..."]
  },
  "canvas": {
    "身份定位": "...",
    "专业壁垒": "...",
    "情感链接": "...",
    "视觉风格": "...",
    "内容节奏": "...",
    "变现路径": "..."
  }
}`

    try {
      const result = await ai.generate(prompt, '你是IP定位专家。返回纯 JSON。')
      const parsed = JSON.parse(result)

      // 将结果保存到品牌记忆
      const { BrandMemoryService } = await import('../aiHub/brandMemory.js')
      const brandMemory = new BrandMemoryService(this.userId)
      await brandMemory.batchUpsert([
        { category: 'profile', key: 'ip_positioning', value: parsed.profile },
        { category: 'profile', key: 'ip_canvas', value: parsed.canvas },
      ])

      return { profile: parsed.profile, canvas: parsed.canvas }
    } catch {
      return {
        profile: { topic: session.topic },
        canvas: {},
      }
    }
  }
}

export class IndustryTemplateService {
  constructor() {}

  async list(industry?: string): Promise<Array<{
    id: string
    name: string
    industry: string
    description: string | null
    config: unknown
  }>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}
    if (industry) where.industry = industry

    return prisma.industryTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getById(id: string): Promise<{
    id: string
    name: string
    industry: string
    description: string | null
    config: unknown
  } | null> {
    return prisma.industryTemplate.findUnique({ where: { id } })
  }

  async apply(id: string): Promise<{
    persona_default: Record<string, unknown>
    content_types: string[]
    pipeline_presets: Record<string, boolean>
  } | null> {
    const template = await prisma.industryTemplate.findUnique({ where: { id } })
    if (!template) return null

    const config = template.config as Record<string, unknown> | null
    if (!config) return null

    return {
      persona_default: (config.persona_default as Record<string, unknown>) || {},
      content_types: (config.content_types as string[]) || [],
      pipeline_presets: (config.pipeline_presets as Record<string, boolean>) || {},
    }
  }

  async initPresets(): Promise<number> {
    let count = 0
    for (const preset of PRESET_TEMPLATES) {
      const existing = await prisma.industryTemplate.findFirst({
        where: { industry: preset.industry },
      })
      if (!existing) {
        await prisma.industryTemplate.create({
          data: {
            name: preset.name,
            industry: preset.industry,
            description: preset.description,
            config: JSON.parse(JSON.stringify(preset.config)),
          },
        })
        count++
      }
    }
    return count
  }
}

// --- 路由 ---

export function createInterviewRouter(): Router {
  const router = Router()
  const interviewService = new IpInterviewService()
  const templateService = new IndustryTemplateService()

  // GET /api/v1/ip-interview/layers — 获取四层提问框架
  router.get('/ip-interview/layers', (_req: Request, res: Response) => {
    res.json({ layers: QUESTION_LAYERS })
  })

  // POST /api/v1/ip-interview/start — 开始访谈
  router.post('/ip-interview/start', async (req: Request, res: Response) => {
    const { topic } = req.body
    if (!topic) { res.status(400).json({ error: 'topic is required' }); return }
    const session = await interviewService.startInterview(topic)
    res.json({ session })
  })

  // POST /api/v1/ip-interview/next — 下一层提问
  router.post('/ip-interview/next', async (req: Request, res: Response) => {
    const { session, answer } = req.body
    if (!session || !answer) { res.status(400).json({ error: 'session and answer are required' }); return }
    const result = await interviewService.nextQuestion(session, answer)
    res.json(result)
  })

  // POST /api/v1/ip-interview/profile — 生成IP定位画布
  router.post('/ip-interview/profile', async (req: Request, res: Response) => {
    const { session } = req.body
    if (!session) { res.status(400).json({ error: 'session is required' }); return }
    const profile = await interviewService.generateProfile(session)
    res.json(profile)
  })

  // GET /api/v1/industry-templates — 行业模板列表
  router.get('/industry-templates', async (req: Request, res: Response) => {
    const industry = String(req.query.industry || '')
    const items = await templateService.list(industry || undefined)
    res.json({ items })
  })

  // POST /api/v1/industry-templates/apply — 应用模板
  router.post('/industry-templates/apply', async (req: Request, res: Response) => {
    const { id } = req.body
    if (!id) { res.status(400).json({ error: 'id is required' }); return }
    const config = await templateService.apply(id)
    if (!config) { res.status(404).json({ error: 'template not found' }); return }
    res.json(config)
  })

  // POST /api/v1/industry-templates/init — 初始化预设模板
  router.post('/industry-templates/init', async (_req: Request, res: Response) => {
    const count = await templateService.initPresets()
    res.json({ created: count })
  })

  return router
}
