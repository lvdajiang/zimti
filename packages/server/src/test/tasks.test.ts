import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import request from 'supertest'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from './setup.js'
import { prisma } from '../db.js'
import { DEMO_USER_ID } from '../constants.js'

describe('Tasks API', () => {
  const app = createTestApp()

  beforeAll(async () => {
    await setupTestDb()
    await cleanupTestDb()
  })

  afterEach(async () => {
    await cleanupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  describe('POST /api/v1/tasks', () => {
    it('创建任务成功', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .send({ title: '测试任务', platform: 'xiaohongshu' })
        .expect(200)

      expect(res.body.id).toBeTruthy()
      expect(res.body.title).toBe('测试任务')
      expect(res.body.status).toBe('todo')
    })

    it('缺少 title 返回 400', async () => {
      await request(app)
        .post('/api/v1/tasks')
        .send({})
        .expect(400)
    })
  })

  describe('GET /api/v1/tasks', () => {
    it('返回任务列表', async () => {
      // 创建测试数据
      await prisma.task.createMany({
        data: [
          { userId: DEMO_USER_ID, title: '任务A', status: 'todo' },
          { userId: DEMO_USER_ID, title: '任务B', status: 'in_progress' },
        ],
      })

      const res = await request(app)
        .get('/api/v1/tasks')
        .expect(200)

      expect(res.body.items).toHaveLength(2)
      expect(res.body.total).toBe(2)
      expect(res.body.items[0].title).toBeDefined()
      expect(res.body.items[0].topic_count).toBeDefined()
      expect(res.body.items[0].script_count).toBeDefined()
    })

    it('按 status 筛选', async () => {
      await prisma.task.createMany({
        data: [
          { userId: DEMO_USER_ID, title: '进行中', status: 'in_progress' },
          { userId: DEMO_USER_ID, title: '待办', status: 'todo' },
        ],
      })

      const res = await request(app)
        .get('/api/v1/tasks?status=in_progress')
        .expect(200)

      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].title).toBe('进行中')
    })

    it('分页正确', async () => {
      await prisma.task.createMany({
        data: Array.from({ length: 5 }, (_, i) => ({
          userId: DEMO_USER_ID,
          title: `分页任务${i}`,
          status: 'todo',
        })),
      })

      const res = await request(app)
        .get('/api/v1/tasks?page=1&page_size=3')
        .expect(200)

      expect(res.body.items).toHaveLength(3)
      expect(res.body.total).toBe(5)
      expect(res.body.page).toBe(1)
      expect(res.body.total_pages).toBe(2)
    })
  })

  describe('PUT /api/v1/tasks/:taskId', () => {
    it('更新任务成功', async () => {
      const task = await prisma.task.create({
        data: { userId: DEMO_USER_ID, title: '原标题', status: 'pending' },
      })

      const res = await request(app)
        .put(`/api/v1/tasks/${task.id}`)
        .send({ title: '新标题', status: 'in_progress', current_step: 2 })
        .expect(200)

      expect(res.body.title).toBe('新标题')
      expect(res.body.status).toBe('in_progress')
      expect(res.body.current_step).toBe(2)
    })
  })

  describe('桩端点标记', () => {
    it('conversion-goal 设置转化目标', async () => {
      const task = await prisma.task.create({
        data: { userId: DEMO_USER_ID, title: '桩测试' },
      })

      const res = await request(app)
        .put(`/api/v1/tasks/${task.id}/conversion-goal`)
        .send({ goal: '提升品牌认知' })
        .expect(200)

      expect(res.body.success).toBe(true)
    })

    it('import-instructions 导入说明', async () => {
      const task = await prisma.task.create({
        data: { userId: DEMO_USER_ID, title: '桩测试' },
      })

      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/import-instructions`)
        .send({ instructions: '视频风格要求：简洁明快' })
        .expect(200)

      expect(res.body.success).toBe(true)
    })
  })
})
