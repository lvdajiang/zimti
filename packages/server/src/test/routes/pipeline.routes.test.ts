import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import request from 'supertest'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { mockAI, clearMockAI } from '../mockAI.js'

describe('Pipeline 路由', () => {
  const app = createTestApp()

  beforeAll(async () => {
    await setupTestDb()
  })

  afterEach(async () => {
    clearMockAI()
    await cleanupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  // ============================================================
  // 1. viral-remind
  // ============================================================

  describe('POST /api/v1/pipeline/viral-remind', () => {
    it('两者都缺返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/pipeline/viral-remind')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/video_url|video_text/i)
    })

    it('只传 video_text 返回 201', async () => {
      // mock AI 响应（viral-remind 异步调用 AI）
      mockAI(['{ "rewritten_text": "改写后的文案内容" }'])

      const res = await request(app)
        .post('/api/v1/pipeline/viral-remind')
        .send({ video_text: '原始文案内容' })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body.status).toBe('pending')
    })

    it('只传 video_url 返回 201', async () => {
      mockAI(['{ "rewritten_text": "改写后的视频文案" }'])

      const res = await request(app)
        .post('/api/v1/pipeline/viral-remind')
        .send({ video_url: 'https://example.com/video.mp4' })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body.status).toBe('pending')
    })

    it('返回 job 对象含 id 和 status', async () => {
      mockAI(['{ "rewritten_text": "文案" }'])

      const res = await request(app)
        .post('/api/v1/pipeline/viral-remind')
        .send({ video_text: '测试文案' })

      expect(res.body).toHaveProperty('id')
      expect(typeof res.body.id).toBe('string')
      expect(res.body).toHaveProperty('status')
      expect(['pending', 'running', 'waiting_confirm']).toContain(res.body.status)
    })
  })

  // ============================================================
  // 2. daily-status
  // ============================================================

  describe('GET /api/v1/pipeline/daily-status', () => {
    it('返回 today_jobs 和 has_run_today', async () => {
      const res = await request(app).get('/api/v1/pipeline/daily-status')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('today_jobs')
      expect(res.body).toHaveProperty('has_run_today')
      expect(Array.isArray(res.body.today_jobs)).toBe(true)
      expect(typeof res.body.has_run_today).toBe('boolean')
    })

    it('初始状态 has_run_today 为 false', async () => {
      const res = await request(app).get('/api/v1/pipeline/daily-status')

      expect(res.status).toBe(200)
      expect(res.body.has_run_today).toBe(false)
      expect(res.body.today_jobs.length).toBe(0)
    })
  })

  // ============================================================
  // 3. hotspot-rush
  // ============================================================

  describe('POST /api/v1/pipeline/hotspot-rush', () => {
    it('缺 hotspot_title 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/pipeline/hotspot-rush')
        .send({ hotspot_desc: '描述' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/hotspot_title/i)
    })

    it('创建 job 返回 201', async () => {
      const res = await request(app)
        .post('/api/v1/pipeline/hotspot-rush')
        .send({ hotspot_title: '热点标题', hotspot_desc: '热点描述' })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body.status).toBe('pending')
    })

    it('只传 title 不传 desc 也能创建', async () => {
      const res = await request(app)
        .post('/api/v1/pipeline/hotspot-rush')
        .send({ hotspot_title: '仅需标题' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('pending')
    })
  })

  // ============================================================
  // 4. customer-question
  // ============================================================

  describe('POST /api/v1/pipeline/customer-question', () => {
    it('缺 question 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/pipeline/customer-question')
        .send({ customer_ids: ['id1'] })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/question/i)
    })

    it('创建 job 返回 201', async () => {
      const res = await request(app)
        .post('/api/v1/pipeline/customer-question')
        .send({ question: '客户问题', customer_ids: ['c1', 'c2'] })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body.status).toBe('pending')
    })

    it('不传 customer_ids 也能创建', async () => {
      const res = await request(app)
        .post('/api/v1/pipeline/customer-question')
        .send({ question: '通用问题' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('pending')
    })
  })

  // ============================================================
  // 5. jobs 列表
  // ============================================================

  describe('GET /api/v1/pipeline/jobs', () => {
    it('创建多个 job 后 GET 返回列表', async () => {
      mockAI(['{ "rewritten_text": "a" }', '{ "rewritten_text": "b" }'])

      await request(app).post('/api/v1/pipeline/hotspot-rush').send({ hotspot_title: '热点1' })
      await request(app).post('/api/v1/pipeline/customer-question').send({ question: '问题1' })

      const res = await request(app).get('/api/v1/pipeline/jobs')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(res.body.total).toBe(2)
      expect(res.body.items.length).toBe(2)
    })

    it('按 mode 筛选', async () => {
      mockAI(['{ "rewritten_text": "a" }'])

      await request(app).post('/api/v1/pipeline/hotspot-rush').send({ hotspot_title: '热点A' })
      await request(app).post('/api/v1/pipeline/customer-question').send({ question: '问题A' })

      const res = await request(app)
        .get('/api/v1/pipeline/jobs')
        .query({ mode: 'hotspot_rush' })

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1)
      expect(res.body.items[0].mode).toBe('hotspot_rush')
    })

    it('按 status 筛选', async () => {
      mockAI(['{ "rewritten_text": "a" }'])

      await request(app).post('/api/v1/pipeline/hotspot-rush').send({ hotspot_title: '热点X' })

      const res = await request(app)
        .get('/api/v1/pipeline/jobs')
        .query({ status: 'pending' })

      expect(res.status).toBe(200)
      // pending 状态的 job（异步可能已经变为 running）
      expect(res.body.items.every((j: { status: string }) => j.status === 'pending')).toBe(true)
    })

    it('分页参数生效', async () => {
      mockAI([
        '{ "rewritten_text": "a" }',
        '{ "rewritten_text": "b" }',
        '{ "rewritten_text": "c" }',
      ])

      await request(app).post('/api/v1/pipeline/hotspot-rush').send({ hotspot_title: '热点1' })
      await request(app).post('/api/v1/pipeline/hotspot-rush').send({ hotspot_title: '热点2' })
      await request(app).post('/api/v1/pipeline/hotspot-rush').send({ hotspot_title: '热点3' })

      const res = await request(app)
        .get('/api/v1/pipeline/jobs')
        .query({ page: 1, page_size: 2 })

      expect(res.status).toBe(200)
      expect(res.body.items.length).toBe(2)
      expect(res.body.total).toBe(3)
    })

    it('空列表返回 total 为 0', async () => {
      const res = await request(app).get('/api/v1/pipeline/jobs')

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(0)
      expect(res.body.items.length).toBe(0)
    })
  })

  // ============================================================
  // 6. job 详情
  // ============================================================

  describe('GET /api/v1/pipeline/jobs/:id', () => {
    it('不存在的 job 返回 404', async () => {
      const res = await request(app).get('/api/v1/pipeline/jobs/00000000-0000-0000-0000-000000000099')

      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/not found/i)
    })

    it('存在的 job 返回 200', async () => {
      mockAI(['{ "rewritten_text": "a" }'])

      const created = await request(app)
        .post('/api/v1/pipeline/hotspot-rush')
        .send({ hotspot_title: '详情测试' })

      const res = await request(app).get(`/api/v1/pipeline/jobs/${created.body.id}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(created.body.id)
      expect(res.body.mode).toBe('hotspot_rush')
      expect(res.body).toHaveProperty('input')
    })

    it('返回完整 job 对象包含所有字段', async () => {
      mockAI(['{ "rewritten_text": "a" }'])

      const created = await request(app)
        .post('/api/v1/pipeline/customer-question')
        .send({ question: '完整字段测试', customer_ids: ['c1'] })

      const res = await request(app).get(`/api/v1/pipeline/jobs/${created.body.id}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('mode')
      expect(res.body).toHaveProperty('status')
      expect(res.body).toHaveProperty('input')
      expect(res.body).toHaveProperty('createdAt')
      expect(res.body).toHaveProperty('updatedAt')
      expect(res.body.input.question).toBe('完整字段测试')
    })
  })
})
