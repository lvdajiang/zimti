import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { prisma } from '../db.js'
import { DEMO_USER_ID } from '../constants.js'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from './setup.js'

const app = createTestApp()

describe('AI 异步任务', () => {
  beforeEach(async () => {
    await setupTestDb()
    await cleanupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('选题生成创建异步任务', async () => {
    const task = await prisma.task.create({
      data: { userId: DEMO_USER_ID, title: 'AI 测试任务' },
    })

    const res = await request(app)
      .post('/api/v1/topic-proposals/generate')
      .send({ task_id: task.id, count: 3 })
      .expect(200)

    expect(res.body.task_id).toBeDefined()
    expect(res.body.status).toBe('pending')
  })

  it('选题生成状态可轮询', async () => {
    const task = await prisma.task.create({
      data: { userId: DEMO_USER_ID, title: 'AI 状态测试' },
    })

    const createRes = await request(app)
      .post('/api/v1/topic-proposals/generate')
      .send({ task_id: task.id })
      .expect(200)

    const taskId = createRes.body.task_id

    // 等待异步完成
    await new Promise(resolve => setTimeout(resolve, 2000))

    const statusRes = await request(app)
      .get(`/api/v1/topic-proposals/generate/${taskId}/status`)
      .expect(200)

    expect(statusRes.body.task_id).toBe(taskId)
    expect(['pending', 'running', 'success']).toContain(statusRes.body.status)
  })

  it('选题生成 404 查询不存在的任务', async () => {
    await request(app)
      .get('/api/v1/topic-proposals/generate/00000000-0000-0000-0000-000000000000/status')
      .expect(404)
  })

  it('选题合并需要至少 2 个 ID', async () => {
    await request(app)
      .post('/api/v1/topic-proposals/merge')
      .send({ ids: [1] })
      .expect(400)
  })

  it('选题合并成功', async () => {
    const task = await prisma.task.create({
      data: { userId: DEMO_USER_ID, title: '合并测试' },
    })
    const p1 = await prisma.topicProposal.create({
      data: {
        taskId: task.id, title: '选题A',
        contentSkeleton: { hook: '钩子A', main_points: [], visual_direction: '', structure_type: 'knowledge' },
        voiceRatio: 0.6, hotspotIds: [], videoIds: [], status: 'generated',
      },
    })
    const p2 = await prisma.topicProposal.create({
      data: {
        taskId: task.id, title: '选题B',
        contentSkeleton: { hook: '钩子B', main_points: [], visual_direction: '', structure_type: 'knowledge' },
        voiceRatio: 0.6, hotspotIds: [], videoIds: [], status: 'generated',
      },
    })

    const res = await request(app)
      .post('/api/v1/topic-proposals/merge')
      .send({ ids: [p1.id, p2.id] })
      .expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.merged).toBeDefined()
  })

  it('Dashboard AI 分析创建任务', async () => {
    const res = await request(app)
      .post('/api/v1/dashboard/ai-analysis')
      .send({ period: '7d' })
      .expect(200)

    expect(res.body.task_id).toBeDefined()
    expect(res.body.status).toBe('pending')
  })

  it('Dashboard AI 分析状态轮询', async () => {
    const createRes = await request(app)
      .post('/api/v1/dashboard/ai-analysis')
      .send({ period: '30d' })
      .expect(200)

    await new Promise(resolve => setTimeout(resolve, 2000))

    const statusRes = await request(app)
      .get(`/api/v1/dashboard/ai-analysis/${createRes.body.task_id}/status`)
      .expect(200)

    expect(['pending', 'running', 'success']).toContain(statusRes.body.status)
  })
})
