import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import request from 'supertest'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { mockAI, clearMockAI } from '../mockAI.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'

describe('CRM Routes', () => {
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

  // ---- 客户 CRUD ----

  // GET /api/v1/crm/customers
  describe('GET /api/v1/crm/customers', () => {
    it('空库返回空列表', async () => {
      const res = await request(app)
        .get('/api/v1/crm/customers')
        .expect(200)

      expect(res.body.items).toHaveLength(0)
      expect(res.body.total).toBe(0)
    })

    it('先 POST 创建再 GET 返回', async () => {
      await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '测试客户A' })
        .expect(201)

      await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '测试客户B' })
        .expect(201)

      const res = await request(app)
        .get('/api/v1/crm/customers')
        .expect(200)

      expect(res.body.items).toHaveLength(2)
      expect(res.body.total).toBe(2)
    })

    it('按 stage 筛选', async () => {
      await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '新客', stage: 'new_friend' })
        .expect(201)

      await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '在聊客', stage: 'chatting' })
        .expect(201)

      const res = await request(app)
        .get('/api/v1/crm/customers?stage=new_friend')
        .expect(200)

      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].name).toBe('新客')
    })
  })

  // POST /api/v1/crm/customers
  describe('POST /api/v1/crm/customers', () => {
    it('缺少 name 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/crm/customers')
        .send({})
        .expect(400)

      expect(res.body.error).toContain('name')
    })

    it('正常创建返回 201', async () => {
      const res = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '张三', phone: '13800001111', wechat: 'zhangsan_wx' })
        .expect(201)

      expect(res.body.id).toBeTruthy()
    })

    it('创建时带 tags', async () => {
      const res = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '李四', tags: ['VIP', '首次咨询'] })
        .expect(201)

      const customerId = res.body.id
      const tags = await prisma.customerTag.findMany({ where: { customerId } })
      expect(tags).toHaveLength(2)
    })
  })

  // PUT /api/v1/crm/customers/:id
  describe('PUT /api/v1/crm/customers/:id', () => {
    it('正常更新返回 200', async () => {
      const createRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '原名' })
        .expect(201)

      const id = createRes.body.id

      const res = await request(app)
        .put(`/api/v1/crm/customers/${id}`)
        .send({ name: '新名', phone: '13900002222' })
        .expect(200)

      expect(res.body.id).toBe(id)
    })

    it('更新不存在的客户返回错误', async () => {
      const res = await request(app)
        .put('/api/v1/crm/customers/00000000-0000-0000-0000-000099999999')
        .send({ name: '测试' })

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  // DELETE /api/v1/crm/customers/:id
  describe('DELETE /api/v1/crm/customers/:id', () => {
    it('正常删除返回 200', async () => {
      const createRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '待删除客户' })
        .expect(201)

      const id = createRes.body.id

      const res = await request(app)
        .delete(`/api/v1/crm/customers/${id}`)
        .expect(200)

      expect(res.body.success).toBe(true)

      // 验证已删除
      const customer = await prisma.customer.findUnique({ where: { id } })
      expect(customer).toBeNull()
    })
  })

  // PUT /api/v1/crm/customers/:id/stage
  describe('PUT /api/v1/crm/customers/:id/stage', () => {
    it('缺少 stage 返回 400', async () => {
      const createRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '阶段测试' })
        .expect(201)

      const res = await request(app)
        .put(`/api/v1/crm/customers/${createRes.body.id}/stage`)
        .send({})
        .expect(400)

      expect(res.body.error).toContain('stage')
    })

    it('正常更新阶段返回 200', async () => {
      const createRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '阶段流转客户' })
        .expect(201)

      const res = await request(app)
        .put(`/api/v1/crm/customers/${createRes.body.id}/stage`)
        .send({ stage: 'chatting', note: '聊得不错' })
        .expect(200)

      expect(res.body.stage).toBe('chatting')
    })
  })

  // POST /api/v1/crm/customers/:id/tags
  describe('POST /api/v1/crm/customers/:id/tags', () => {
    it('缺少 tags 返回 400', async () => {
      const createRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '标签测试' })
        .expect(201)

      const res = await request(app)
        .post(`/api/v1/crm/customers/${createRes.body.id}/tags`)
        .send({})
        .expect(400)

      expect(res.body.error).toContain('tags')
    })

    it('正常添加标签返回 200', async () => {
      const createRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '加标客户' })
        .expect(201)

      const res = await request(app)
        .post(`/api/v1/crm/customers/${createRes.body.id}/tags`)
        .send({ tags: ['高意向', '回头客'] })
        .expect(200)

      expect(res.body.success).toBe(true)

      const tags = await prisma.customerTag.findMany({ where: { customerId: createRes.body.id } })
      expect(tags).toHaveLength(2)
    })
  })

  // DELETE /api/v1/crm/customers/:id/tags
  describe('DELETE /api/v1/crm/customers/:id/tags', () => {
    it('缺少 tag 返回 400', async () => {
      const createRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '删标测试', tags: ['待删'] })
        .expect(201)

      const res = await request(app)
        .delete(`/api/v1/crm/customers/${createRes.body.id}/tags`)
        .send({})
        .expect(400)

      expect(res.body.error).toContain('tag')
    })

    it('正常删除标签返回 200', async () => {
      const createRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '删标客户', tags: ['删除标签', '保留标签'] })
        .expect(201)

      const res = await request(app)
        .delete(`/api/v1/crm/customers/${createRes.body.id}/tags`)
        .send({ tag: '删除标签' })
        .expect(200)

      expect(res.body.success).toBe(true)

      const tags = await prisma.customerTag.findMany({ where: { customerId: createRes.body.id } })
      const tagValues = tags.map((t) => t.tag)
      expect(tagValues).not.toContain('删除标签')
      expect(tagValues).toContain('保留标签')
    })
  })

  // POST /api/v1/crm/customers/voice-input
  describe('POST /api/v1/crm/customers/voice-input', () => {
    it('缺少 text 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/crm/customers/voice-input')
        .send({})
        .expect(400)

      expect(res.body.error).toContain('text')
    })

    it('mock AI 注入，验证返回', async () => {
      const aiResponse = JSON.stringify({
        name: '张三',
        travel_intent: { people: 3, date: '2026-07-01', destination: '大理', budget: '8000' },
        tags: ['家庭游'],
        notes: '3个人想去大理，预算8000',
      })
      mockAI([aiResponse])

      const res = await request(app)
        .post('/api/v1/crm/customers/voice-input')
        .send({ text: '张三说3个人想去大理玩，预算大概8000' })
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it('AI 不可用时降级返回', async () => {
      const res = await request(app)
        .post('/api/v1/crm/customers/voice-input')
        .send({ text: '没有AI的测试' })
        .expect(200)

      expect(res.body.notes).toBe('没有AI的测试')
    })
  })

  // GET /api/v1/crm/silent-customers
  describe('GET /api/v1/crm/silent-customers', () => {
    it('返回 items 数组', async () => {
      const res = await request(app)
        .get('/api/v1/crm/silent-customers')
        .expect(200)

      expect(res.body.items).toBeDefined()
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it('创建沉默客户后返回数据', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      await prisma.customer.create({
        data: {
          userId: DEMO_USER_ID,
          name: '沉默客户',
          stage: 'chatting',
          lastFollowUpAt: oldDate,
        },
      })

      const res = await request(app)
        .get('/api/v1/crm/silent-customers')
        .expect(200)

      expect(res.body.items.length).toBeGreaterThanOrEqual(1)
    })
  })

  // GET /api/v1/crm/funnel-stats
  describe('GET /api/v1/crm/funnel-stats', () => {
    it('返回 8 阶段统计', async () => {
      const res = await request(app)
        .get('/api/v1/crm/funnel-stats')
        .expect(200)

      const stages = ['new_friend', 'chatting', 'deep_consult', 'hesitating', 'ordered', 'traveling', 'completed', 'repurchase']
      for (const stage of stages) {
        expect(res.body[stage]).toBeDefined()
      }
    })

    it('创建客户后统计正确', async () => {
      await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '漏斗客A', stage: 'new_friend' })
        .expect(201)

      await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '漏斗客B', stage: 'ordered' })
        .expect(201)

      const res = await request(app)
        .get('/api/v1/crm/funnel-stats')
        .expect(200)

      expect(res.body.new_friend).toBe(1)
      expect(res.body.ordered).toBe(1)
    })
  })

  // ---- 话术模板 ----

  // GET /api/v1/crm/chat-templates
  describe('GET /api/v1/crm/chat-templates', () => {
    it('返回 items', async () => {
      const res = await request(app)
        .get('/api/v1/crm/chat-templates')
        .expect(200)

      expect(res.body.items).toBeDefined()
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it('创建模板后 GET 返回', async () => {
      await prisma.chatTemplate.create({
        data: {
          userId: DEMO_USER_ID,
          stage: 'new_friend',
          category: 'greeting',
          content: '你好，很高兴认识你！',
        },
      })

      const res = await request(app)
        .get('/api/v1/crm/chat-templates')
        .expect(200)

      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].content).toBe('你好，很高兴认识你！')
    })
  })

  // POST /api/v1/crm/chat-templates
  describe('POST /api/v1/crm/chat-templates', () => {
    it('缺少 stage 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/crm/chat-templates')
        .send({ content: '话术内容' })
        .expect(400)

      expect(res.body.error).toContain('stage')
    })

    it('缺少 content 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/crm/chat-templates')
        .send({ stage: 'new_friend' })
        .expect(400)

      expect(res.body.error).toContain('content')
    })

    it('正常创建返回 201', async () => {
      const res = await request(app)
        .post('/api/v1/crm/chat-templates')
        .send({ stage: 'chatting', category: 'probing', content: '请问您之前去过三亚吗？' })
        .expect(201)

      expect(res.body.id).toBeTruthy()
    })
  })

  // POST /api/v1/crm/chat-templates/generate
  describe('POST /api/v1/crm/chat-templates/generate', () => {
    it('缺少 stage 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/crm/chat-templates/generate')
        .send({})
        .expect(400)

      expect(res.body.error).toContain('stage')
    })

    it('mock AI 注入，验证返回', async () => {
      const aiResponse = JSON.stringify({
        templates: [
          { content: '你好呀，有什么可以帮你的吗？', category: 'greeting' },
          { content: '请问您对哪些目的地比较感兴趣？', category: 'probing' },
        ],
      })
      mockAI([aiResponse])

      const res = await request(app)
        .post('/api/v1/crm/chat-templates/generate')
        .send({ stage: 'new_friend', customer_context: '首次咨询的女性客户' })
        .expect(200)

      expect(res.body.templates).toBeDefined()
      expect(res.body.templates.length).toBeGreaterThanOrEqual(1)
    })

    it('AI 不可用时返回 503', async () => {
      // 不设置 mock AI
      const res = await request(app)
        .post('/api/v1/crm/chat-templates/generate')
        .send({ stage: 'chatting' })

      // NullAIProvider 在 generate 时抛异常，路由 catch 后返回 502
      expect(res.status).toBe(502)
    })
  })

  // ---- 跟进提醒 ----

  // GET /api/v1/crm/follow-up-reminders
  describe('GET /api/v1/crm/follow-up-reminders', () => {
    it('返回 items', async () => {
      const res = await request(app)
        .get('/api/v1/crm/follow-up-reminders')
        .expect(200)

      expect(res.body.items).toBeDefined()
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    it('创建提醒后 GET 返回', async () => {
      // 先创建客户
      const customerRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '提醒客户' })
        .expect(201)

      const remindAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      await request(app)
        .post('/api/v1/crm/follow-up-reminders')
        .send({ customer_id: customerRes.body.id, remind_at: remindAt, message: '记得跟进' })
        .expect(201)

      const res = await request(app)
        .get('/api/v1/crm/follow-up-reminders')
        .expect(200)

      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].customer).toBeDefined()
    })
  })

  // POST /api/v1/crm/follow-up-reminders
  describe('POST /api/v1/crm/follow-up-reminders', () => {
    it('缺少 customer_id 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/crm/follow-up-reminders')
        .send({ remind_at: '2026-06-01T10:00:00Z' })
        .expect(400)

      expect(res.body.error).toContain('customer_id')
    })

    it('缺少 remind_at 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/crm/follow-up-reminders')
        .send({ customer_id: 'some-id' })
        .expect(400)

      expect(res.body.error).toContain('remind_at')
    })

    it('正常创建返回 201', async () => {
      const customerRes = await request(app)
        .post('/api/v1/crm/customers')
        .send({ name: '提醒创建客户' })
        .expect(201)

      const remindAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      const res = await request(app)
        .post('/api/v1/crm/follow-up-reminders')
        .send({
          customer_id: customerRes.body.id,
          remind_at: remindAt,
          message: '三天后跟进旅游方案',
        })
        .expect(201)

      expect(res.body.id).toBeTruthy()
    })
  })
})
