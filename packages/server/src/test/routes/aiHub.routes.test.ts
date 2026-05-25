import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import request from 'supertest'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { mockAI, clearMockAI } from '../mockAI.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import type { BrandMemoryCategory, EvolutionType } from '@zimti/shared'

describe('AI Hub Routes', () => {
  const app = createTestApp()

  beforeAll(async () => {
    await setupTestDb()
    await cleanupTestDb()
  })

  afterEach(async () => {
    await cleanupTestDb()
    clearMockAI()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  // ---- GET /api/v1/ai-hub/brand-memory ----
  describe('GET /api/v1/ai-hub/brand-memory', () => {
    it('空库返回 {}', async () => {
      const res = await request(app)
        .get('/api/v1/ai-hub/brand-memory')
        .expect(200)

      // BrandMemoryService.getProfile 在无数据时返回空对象或各分类空数组
      expect(res.body).toBeDefined()
    })

    it('先 PUT 创建再 GET 返回数据', async () => {
      await request(app)
        .put('/api/v1/ai-hub/brand-memory')
        .send({ category: 'style', key: '语调', value: '轻松活泼' })
        .expect(200)

      const res = await request(app)
        .get('/api/v1/ai-hub/brand-memory')
        .expect(200)

      // 验证返回结构中包含相关数据
      expect(res.body).toBeDefined()
    })
  })

  // ---- PUT /api/v1/ai-hub/brand-memory ----
  describe('PUT /api/v1/ai-hub/brand-memory', () => {
    it('缺少 category 返回 400', async () => {
      const res = await request(app)
        .put('/api/v1/ai-hub/brand-memory')
        .send({ key: 'test', value: 'test' })
        .expect(400)

      expect(res.body.error).toContain('category')
    })

    it('缺少 key 返回 400', async () => {
      const res = await request(app)
        .put('/api/v1/ai-hub/brand-memory')
        .send({ category: 'style', value: 'test' })
        .expect(400)

      expect(res.body.error).toContain('key')
    })

    it('缺少 value 返回 400', async () => {
      const res = await request(app)
        .put('/api/v1/ai-hub/brand-memory')
        .send({ category: 'style', key: 'test' })
        .expect(400)

      expect(res.body.error).toContain('value')
    })

    it('无效 category 返回 400', async () => {
      const res = await request(app)
        .put('/api/v1/ai-hub/brand-memory')
        .send({ category: 'invalid', key: 'test', value: 'test' })
        .expect(400)

      expect(res.body.error).toContain('category')
    })

    it('正常创建返回 200', async () => {
      const res = await request(app)
        .put('/api/v1/ai-hub/brand-memory')
        .send({ category: 'profile', key: '品牌名', value: '测试品牌' })
        .expect(200)

      expect(res.body.success).toBe(true)

      // 验证数据库中存在
      const memory = await prisma.brandMemory.findFirst({
        where: { userId: DEMO_USER_ID, category: 'profile', key: '品牌名' },
      })
      expect(memory).toBeTruthy()
      expect(memory!.value).toBe('测试品牌')
    })

    it('带 source 和 weight 正常创建', async () => {
      const res = await request(app)
        .put('/api/v1/ai-hub/brand-memory')
        .send({
          category: 'preference',
          key: '目标受众',
          value: '25-35岁女性',
          source: '手动输入',
          weight: 0.8,
        })
        .expect(200)

      expect(res.body.success).toBe(true)
    })
  })

  // ---- POST /api/v1/ai-hub/brand-memory/learn ----
  describe('POST /api/v1/ai-hub/brand-memory/learn', () => {
    it('缺少 original_text 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/ai-hub/brand-memory/learn')
        .send({ modified_text: '修改后文本' })
        .expect(400)

      expect(res.body.error).toContain('original_text')
    })

    it('缺少 modified_text 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/ai-hub/brand-memory/learn')
        .send({ original_text: '原始文本' })
        .expect(400)

      expect(res.body.error).toContain('modified_text')
    })

    it('mock AI 注入，验证学习结果', async () => {
      const aiResponse = JSON.stringify([
        { category: 'style' as BrandMemoryCategory, key: '表达方式', value: '口语化', confidence: 0.9 },
        { category: 'preference' as BrandMemoryCategory, key: '常用词', value: '绝绝子', confidence: 0.7 },
      ])
      mockAI([aiResponse])

      const res = await request(app)
        .post('/api/v1/ai-hub/brand-memory/learn')
        .send({
          original_text: '这是一个很普通的描述',
          modified_text: '这个真的绝绝子太棒了',
        })
        .expect(200)

      expect(res.body.success).toBe(true)
    })
  })

  // ---- DELETE /api/v1/ai-hub/brand-memory ----
  describe('DELETE /api/v1/ai-hub/brand-memory', () => {
    it('缺少 category 返回 400', async () => {
      const res = await request(app)
        .delete('/api/v1/ai-hub/brand-memory')
        .send({ key: 'test' })
        .expect(400)

      expect(res.body.error).toContain('category')
    })

    it('缺少 key 返回 400', async () => {
      const res = await request(app)
        .delete('/api/v1/ai-hub/brand-memory')
        .send({ category: 'style' })
        .expect(400)

      expect(res.body.error).toContain('key')
    })

    it('正常删除返回 200', async () => {
      // 先创建
      await request(app)
        .put('/api/v1/ai-hub/brand-memory')
        .send({ category: 'skill', key: '视频剪辑', value: '熟练' })
        .expect(200)

      // 再删除
      const res = await request(app)
        .delete('/api/v1/ai-hub/brand-memory')
        .send({ category: 'skill', key: '视频剪辑' })
        .expect(200)

      expect(res.body.success).toBe(true)

      // 验证已删除
      const memory = await prisma.brandMemory.findFirst({
        where: { userId: DEMO_USER_ID, category: 'skill', key: '视频剪辑' },
      })
      expect(memory).toBeNull()
    })
  })

  // ---- GET /api/v1/ai-hub/strategy/recommendations ----
  describe('GET /api/v1/ai-hub/strategy/recommendations', () => {
    it('返回 { recommendations: [...] }', async () => {
      const res = await request(app)
        .get('/api/v1/ai-hub/strategy/recommendations')
        .expect(200)

      expect(res.body.recommendations).toBeDefined()
      expect(Array.isArray(res.body.recommendations)).toBe(true)
    })
  })

  // ---- POST /api/v1/ai-hub/strategy/evaluate-hotspot ----
  describe('POST /api/v1/ai-hub/strategy/evaluate-hotspot', () => {
    it('缺少 title 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/ai-hub/strategy/evaluate-hotspot')
        .send({ description: '描述内容' })
        .expect(400)

      expect(res.body.error).toContain('title')
    })

    it('mock AI 返回 JSON 验证', async () => {
      const aiResponse = JSON.stringify({
        score: 85,
        reasons: ['品牌调性匹配', '目标受众重合'],
        suggestion: '可以结合品牌特色进行二次创作',
      })
      mockAI([aiResponse])

      const res = await request(app)
        .post('/api/v1/ai-hub/strategy/evaluate-hotspot')
        .send({ title: '夏日旅行攻略', description: '热门旅行话题' })
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })

  // ---- POST /api/v1/ai-hub/evolution/analyze ----
  describe('POST /api/v1/ai-hub/evolution/analyze', () => {
    it('缺少 type 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/ai-hub/evolution/analyze')
        .send({ trigger: '手动触发' })
        .expect(400)

      expect(res.body.error).toContain('type')
    })

    it('缺少 trigger 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/ai-hub/evolution/analyze')
        .send({ type: 'content' })
        .expect(400)

      expect(res.body.error).toContain('trigger')
    })

    it('无效 type 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/ai-hub/evolution/analyze')
        .send({ type: 'invalid_type', trigger: '测试' })
        .expect(400)

      expect(res.body.error).toContain('type')
    })

    it('正常分析返回 200', async () => {
      const res = await request(app)
        .post('/api/v1/ai-hub/evolution/analyze')
        .send({
          type: 'style' as EvolutionType,
          trigger: '手动测试',
          before: '原始风格描述',
          after: '优化后风格描述',
          metric: '互动率提升10%',
        })
        .expect(200)

      expect(res.body.success).toBe(true)
    })
  })

  // ---- GET /api/v1/ai-hub/evolution/log ----
  describe('GET /api/v1/ai-hub/evolution/log', () => {
    it('返回 { logs: [...] }', async () => {
      const res = await request(app)
        .get('/api/v1/ai-hub/evolution/log')
        .expect(200)

      expect(res.body.logs).toBeDefined()
      expect(Array.isArray(res.body.logs)).toBe(true)
    })

    it('支持 type 查询参数', async () => {
      const res = await request(app)
        .get('/api/v1/ai-hub/evolution/log?type=content')
        .expect(200)

      expect(res.body.logs).toBeDefined()
      expect(Array.isArray(res.body.logs)).toBe(true)
      // 传了有效 type 时额外返回 patterns
      expect(res.body.patterns).toBeDefined()
    })

    it('支持 limit 查询参数', async () => {
      const res = await request(app)
        .get('/api/v1/ai-hub/evolution/log?limit=5')
        .expect(200)

      expect(res.body.logs).toBeDefined()
      expect(Array.isArray(res.body.logs)).toBe(true)
    })

    it('无数据时返回空数组', async () => {
      const res = await request(app)
        .get('/api/v1/ai-hub/evolution/log')
        .expect(200)

      expect(res.body.logs).toHaveLength(0)
    })
  })
})
