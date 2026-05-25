import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import request from 'supertest'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { mockAI, clearMockAI } from '../mockAI.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'

describe('Private Domain 路由', () => {
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

  describe('GET /api/v1/private-domain/moments/daily', () => {
    it('mock AI 注入 6 条朋友圈内容，返回 items 数组长度为 6', async () => {
      const aiResponse = JSON.stringify({
        items: [
          { content_type: 'professional', content: '专业干货1', image_suggestion: '配图1' },
          { content_type: 'professional', content: '专业干货2', image_suggestion: '配图2' },
          { content_type: 'professional', content: '专业干货3', image_suggestion: '配图3' },
          { content_type: 'life', content: '生活内容1', image_suggestion: '配图4' },
          { content_type: 'life', content: '生活内容2', image_suggestion: '配图5' },
          { content_type: 'conversion', content: '转化内容1', image_suggestion: '配图6' },
        ],
      })
      mockAI([aiResponse])

      const res = await request(app).get('/api/v1/private-domain/moments/daily')
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(6)
      expect(res.body.items[0].content).toBe('专业干货1')
      expect(res.body.items[3].contentType).toBe('life')
      expect(res.body.items[5].contentType).toBe('conversion')

      // 验证数据已写入 DB
      const dbRows = await prisma.momentsContent.findMany({
        where: { userId: DEMO_USER_ID },
      })
      expect(dbRows).toHaveLength(6)
    })

    it('第二次调用已有数据直接返回（不重新生成）', async () => {
      // 预先插入数据模拟已有记录
      await prisma.momentsContent.createMany({
        data: Array.from({ length: 3 }, (_, i) => ({
          userId: DEMO_USER_ID,
          contentType: 'professional',
          content: `预存内容${i + 1}`,
          createdAt: new Date(),
        })),
      })

      // 不设置 mock AI，如果触发 AI 调用会抛异常
      clearMockAI()

      const res = await request(app).get('/api/v1/private-domain/moments/daily')
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(3)
      expect(res.body.items[0].content).toBe('预存内容1')
    })
  })

  describe('POST /api/v1/private-domain/moments/:id/sent', () => {
    it('正常标记 sentAt', async () => {
      const item = await prisma.momentsContent.create({
        data: {
          userId: DEMO_USER_ID,
          contentType: 'professional',
          content: '待发送内容',
        },
      })

      const res = await request(app).post(`/api/v1/private-domain/moments/${item.id}/sent`)
      expect(res.status).toBe(200)
      expect(res.body.id).toBe(item.id)
      expect(res.body.sent_at).toBeDefined()

      // 验证 DB 已更新
      const updated = await prisma.momentsContent.findUnique({ where: { id: item.id } })
      expect(updated!.sentAt).not.toBeNull()
    })

    it('不存在的 id 返回错误', async () => {
      const res = await request(app)
        .post('/api/v1/private-domain/moments/00000000-0000-0000-0000-000099999999/sent')

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/v1/private-domain/moments/:id/engagement', () => {
    it('正常保存 likes/comments 数据', async () => {
      const item = await prisma.momentsContent.create({
        data: {
          userId: DEMO_USER_ID,
          contentType: 'life',
          content: '互动测试内容',
        },
      })

      const res = await request(app)
        .post(`/api/v1/private-domain/moments/${item.id}/engagement`)
        .send({ likes: 42, comments: 8 })

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(item.id)

      // 验证 DB 中 engagementData 已保存
      const updated = await prisma.momentsContent.findUnique({ where: { id: item.id } })
      expect(updated!.engagementData).toEqual({
        likes: 42,
        comments: 8,
        screenshot: null,
      })
    })
  })

  describe('GET /api/v1/private-domain/group-content', () => {
    it('返回 items 数组', async () => {
      await prisma.groupContent.createMany({
        data: [
          { userId: DEMO_USER_ID, groupType: 'intent', title: '意向标题', content: '意向内容' },
          { userId: DEMO_USER_ID, groupType: 'loyalty', title: '老客标题', content: '老客内容' },
        ],
      })

      const res = await request(app).get('/api/v1/private-domain/group-content')
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(2)
    })

    it('按 group_type 筛选', async () => {
      await prisma.groupContent.createMany({
        data: [
          { userId: DEMO_USER_ID, groupType: 'intent', title: '意向', content: '内容A' },
          { userId: DEMO_USER_ID, groupType: 'loyalty', title: '老客', content: '内容B' },
        ],
      })

      const res = await request(app)
        .get('/api/v1/private-domain/group-content')
        .query({ group_type: 'loyalty' })

      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].groupType).toBe('loyalty')
    })
  })

  describe('POST /api/v1/private-domain/group-content', () => {
    it('无效 group_type 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/private-domain/group-content')
        .send({ group_type: 'invalid_type' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('group_type must be one of')
    })

    it('mock AI 返回 JSON 创建成功 201', async () => {
      const aiResponse = JSON.stringify({
        title: '今日旅行攻略推荐',
        content: '大家好，今天给大家推荐一个绝美的小众目的地...',
      })
      mockAI([aiResponse])

      const res = await request(app)
        .post('/api/v1/private-domain/group-content')
        .send({ group_type: 'traveling' })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()

      // 验证 DB 中已创建记录
      const created = await prisma.groupContent.findUnique({ where: { id: res.body.id } })
      expect(created).not.toBeNull()
      expect(created!.groupType).toBe('traveling')
      expect(created!.title).toBe('今日旅行攻略推荐')
    })
  })
})
