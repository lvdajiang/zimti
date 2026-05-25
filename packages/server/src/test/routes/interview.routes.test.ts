import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import request from 'supertest'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { mockAI, clearMockAI } from '../mockAI.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'

describe('Interview 路由', () => {
  const app = createTestApp()

  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  afterEach(async () => {
    await cleanupTestDb()
    clearMockAI()
  })

  describe('GET /api/v1/ip-interview/layers', () => {
    it('返回数组长度 4，每层有 type/description/questions_count', async () => {
      const res = await request(app).get('/api/v1/ip-interview/layers')
      expect(res.status).toBe(200)
      expect(res.body.layers).toHaveLength(4)

      for (const layer of res.body.layers) {
        expect(layer).toHaveProperty('type')
        expect(layer).toHaveProperty('description')
        expect(layer).toHaveProperty('layer')
        expect(typeof layer.type).toBe('string')
        expect(typeof layer.description).toBe('string')
      }

      // 验证四层类型
      const types = res.body.layers.map((l: { type: string }) => l.type)
      expect(types).toEqual(['event', 'behavior', 'feeling', 'belief'])
    })
  })

  describe('POST /api/v1/ip-interview/start', () => {
    it('缺 topic 返回 400', async () => {
      const res = await request(app).post('/api/v1/ip-interview/start').send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('topic')
    })

    it('mock AI 注入 3 个问题，返回 session 含 currentQuestions', async () => {
      const aiResponse = JSON.stringify({
        questions: ['请介绍一下你的旅行经历？', '你为什么热爱旅行？', '你独特的旅行方式是什么？'],
      })
      mockAI([aiResponse])

      const res = await request(app)
        .post('/api/v1/ip-interview/start')
        .send({ topic: '旅行博主' })

      expect(res.status).toBe(200)
      expect(res.body.session).toBeDefined()
      expect(res.body.session.topic).toBe('旅行博主')
      expect(res.body.session.currentLayer).toBe(1)
      expect(res.body.session.currentQuestions).toHaveLength(3)
      expect(res.body.session.currentQuestions[0]).toBe('请介绍一下你的旅行经历？')
      expect(res.body.session.answers).toEqual([])
    })
  })

  describe('POST /api/v1/ip-interview/next', () => {
    it('缺参数返回 400', async () => {
      const res = await request(app).post('/api/v1/ip-interview/next').send({})
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('session')
    })

    it('正常调用更新 session', async () => {
      const followUpResponse = JSON.stringify({ question: '你当时去的地方具体是哪里？有什么特别的故事吗？' })
      mockAI([followUpResponse])

      const session = {
        topic: '旅行博主',
        currentLayer: 1,
        answers: [],
        currentQuestions: ['你为什么开始旅行？'],
      }

      const res = await request(app)
        .post('/api/v1/ip-interview/next')
        .send({ session, answer: '我喜欢旅行，去过很多地方。' })

      expect(res.status).toBe(200)
      expect(res.body.session).toBeDefined()
      expect(res.body.nextQuestion).toBeDefined()
      expect(typeof res.body.nextQuestion).toBe('string')
      expect(res.body.isComplete).toBe(false)

      // session 应该包含新的 answer
      expect(res.body.session.answers).toHaveLength(1)
      expect(res.body.session.answers[0].answer).toBe('我喜欢旅行，去过很多地方。')
    })
  })

  describe('POST /api/v1/ip-interview/profile', () => {
    it('mock AI 注入 canvas JSON，验证 brand_memories 新增', async () => {
      const aiResponse = JSON.stringify({
        profile: {
          '定位一句话': '探索世界的旅行者',
          '核心优势': '深度体验+真实记录',
          '独特风格': '沉浸式叙述',
          '目标受众': '向往旅行的城市白领',
          '内容方向': ['旅行攻略', '目的地探店', '酒店测评'],
        },
        canvas: {
          '身份定位': '深度旅行体验师',
          '专业壁垒': '10年旅行经验+专业摄影',
          '情感链接': '真实的旅途情感共鸣',
          '视觉风格': '温暖色调+人文纪实',
          '内容节奏': '每周2篇深度+3条短动态',
          '变现路径': '广告合作+旅行团领队',
        },
      })
      mockAI([aiResponse])

      const session = {
        topic: '旅行博主',
        currentLayer: 5,
        answers: [
          { layer: 1, type: 'event', question: '你做了什么？', answer: '我去过30个国家旅行' },
          { layer: 2, type: 'behavior', question: '你是怎么做的？', answer: '每次深度体验当地文化' },
          { layer: 3, type: 'feeling', question: '你什么感觉？', answer: '旅行让我感到自由' },
          { layer: 4, type: 'belief', question: '你觉得什么重要？', answer: '真实体验最重要' },
        ],
      }

      const res = await request(app)
        .post('/api/v1/ip-interview/profile')
        .send({ session })

      expect(res.status).toBe(200)
      expect(res.body.profile).toBeDefined()
      expect(res.body.canvas).toBeDefined()
      expect(res.body.canvas['身份定位']).toBe('深度旅行体验师')

      // 验证 brand_memories 新增了记录
      const memories = await prisma.brandMemory.findMany({
        where: { userId: DEMO_USER_ID, category: 'profile' },
      })
      expect(memories.length).toBeGreaterThanOrEqual(1)

      const canvasMemory = memories.find((m) => m.key === 'ip_canvas')
      expect(canvasMemory).toBeDefined()
    })
  })

  describe('GET /api/v1/industry-templates', () => {
    it('返回列表', async () => {
      // 先初始化预设
      await prisma.industryTemplate.createMany({
        data: [
          {
            name: '旅行自媒体',
            industry: 'travel',
            description: '旅行体验类自媒体',
            config: JSON.parse(JSON.stringify({ persona_default: {}, content_types: [], pipeline_presets: {} })),
          },
          {
            name: '美食探店',
            industry: 'food',
            description: '美食自媒体',
            config: JSON.parse(JSON.stringify({ persona_default: {}, content_types: [], pipeline_presets: {} })),
          },
        ],
      })

      const res = await request(app).get('/api/v1/industry-templates')
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(2)
      expect(res.body.items[0]).toHaveProperty('id')
      expect(res.body.items[0]).toHaveProperty('name')
      expect(res.body.items[0]).toHaveProperty('industry')
    })
  })

  describe('POST /api/v1/industry-templates/apply', () => {
    it('不存在的 id 返回 404', async () => {
      const res = await request(app)
        .post('/api/v1/industry-templates/apply')
        .send({ id: '00000000-0000-0000-0000-000099999999' })

      expect(res.status).toBe(404)
      expect(res.body.error).toContain('template not found')
    })

    it('存在返回配置', async () => {
      const template = await prisma.industryTemplate.create({
        data: {
          name: '健身运动',
          industry: 'fitness',
          description: '健身自媒体',
          config: {
            persona_default: { tone: '激励陪伴', style: '实操演示', target_audience: '健身小白' },
            content_types: ['健身教程', '饮食指导'],
            pipeline_presets: { viral_remind: true, daily_auto: true, hotspot_rush: false },
          },
        },
      })

      const res = await request(app)
        .post('/api/v1/industry-templates/apply')
        .send({ id: template.id })

      expect(res.status).toBe(200)
      expect(res.body.persona_default).toBeDefined()
      expect(res.body.content_types).toContain('健身教程')
      expect(res.body.pipeline_presets).toBeDefined()
    })
  })

  describe('POST /api/v1/industry-templates/init', () => {
    it('初始化预设模板', async () => {
      const res = await request(app).post('/api/v1/industry-templates/init')
      expect(res.status).toBe(200)
      expect(typeof res.body.created).toBe('number')
      // 4 个预设模板都应该创建成功
      expect(res.body.created).toBe(4)

      // 验证 DB 中确实有 4 条
      const templates = await prisma.industryTemplate.findMany()
      expect(templates).toHaveLength(4)
    })

    it('重复调用不重复创建', async () => {
      // 先手动创建一个已存在的预设
      await prisma.industryTemplate.create({
        data: {
          name: '旅行自媒体',
          industry: 'travel',
          description: '旅行体验类自媒体',
          config: {
            persona_default: { tone: '真诚分享' },
            content_types: ['旅行攻略'],
            pipeline_presets: { viral_remind: true },
          },
        },
      })

      const res = await request(app).post('/api/v1/industry-templates/init')
      expect(res.status).toBe(200)
      // travel 已存在，应该只创建 3 个
      expect(res.body.created).toBe(3)

      // 验证 DB 中只有 4 条（1 手动 + 3 新建）
      const templates = await prisma.industryTemplate.findMany()
      expect(templates).toHaveLength(4)
    })
  })
})
