import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from './setup.js'
import { prisma } from '../db.js'
import { DEMO_USER_ID } from '../constants.js'

describe('Scripts API', () => {
  const app = createTestApp()
  let taskId = ''
  let topicId = 0

  beforeAll(async () => {
    await setupTestDb()
    await cleanupTestDb()
  })

  beforeEach(async () => {
    await cleanupTestDb()
    const task = await prisma.task.create({
      data: { userId: DEMO_USER_ID, title: '脚本测试任务' },
    })
    taskId = task.id
    const topic = await prisma.topicProposal.create({
      data: {
        taskId,
        title: '测试选题',
        contentSkeleton: {},
        voiceRatio: 0.6,
        hotspotIds: [],
        videoIds: [],
      },
    })
    topicId = topic.id
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  describe('POST /api/v1/scripts', () => {
    it('创建脚本成功', async () => {
      const res = await request(app)
        .post('/api/v1/scripts')
        .send({ task_id: taskId, topic_id: topicId, full_text: '测试脚本内容' })
        .expect(200)

      expect(res.body.id).toBeTruthy()
      expect(res.body.task_id).toBe(taskId)
      expect(res.body.full_text).toBe('测试脚本内容')
      expect(res.body.oral_ratio).toBe(0.6)
      expect(res.body.task_id).toBe(taskId)
      expect(res.body.full_text).toBe('测试脚本内容')
    })

    it('缺少参数返回 400', async () => {
      await request(app)
        .post('/api/v1/scripts')
        .send({ full_text: 'test' })
        .expect(400)
    })
  })

  describe('GET /api/v1/scripts/:id', () => {
    it('获取脚本及分镜', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '完整内容' },
      })
      await prisma.storyboardSegment.createMany({
        data: [
          { scriptId: script.id, segmentIndex: 0, segmentType: 'oral', oralText: '口播1', visualDescription: '', duration: 5.0, materialIds: [] },
          { scriptId: script.id, segmentIndex: 1, segmentType: 'visual', visualDescription: '画面描述', duration: 3.0, materialIds: [] },
        ],
      })

      const res = await request(app)
        .get(`/api/v1/scripts/${script.id}`)
        .expect(200)

      expect(res.body.full_text).toBe('完整内容')
      expect(res.body.segments).toHaveLength(2)
      expect(res.body.segments[0].segment_type).toBe('oral')
      expect(res.body.segments[1].segment_type).toBe('visual')
    })

    it('脚本不存在返回 404', async () => {
      await request(app)
        .get('/api/v1/scripts/999999')
        .expect(404)
    })
  })

  describe('PUT /api/v1/scripts/:id', () => {
    it('更新脚本文本和类型', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '' },
      })

      const res = await request(app)
        .put(`/api/v1/scripts/${script.id}`)
        .send({ full_text: '新内容', video_type: 'story', oral_ratio: 0.8 })
        .expect(200)

      expect(res.body.full_text).toBe('新内容')
      expect(res.body.video_type).toBe('story')
      expect(res.body.oral_ratio).toBe(0.8)
    })
  })

  describe('Segments CRUD', () => {
    it('添加片段', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '' },
      })

      const res = await request(app)
        .post(`/api/v1/scripts/${script.id}/segments`)
        .send({ segment_type: 'oral', oral_text: '测试口播', duration: 5.0 })
        .expect(200)

      expect(res.body.segment_type).toBe('oral')
      expect(res.body.segment_index).toBe(0)
      expect(res.body.oral_text).toBe('测试口播')
    })

    it('添加第二个片段 index 自动递增', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '' },
      })
      await prisma.storyboardSegment.create({
        data: { scriptId: script.id, segmentIndex: 0, segmentType: 'oral', visualDescription: '', duration: 3.0, materialIds: [] },
      })

      const res = await request(app)
        .post(`/api/v1/scripts/${script.id}/segments`)
        .send({ segment_type: 'visual', visual_description: '画面' })
        .expect(200)

      expect(res.body.segment_index).toBe(1)
    })

    it('更新片段', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '' },
      })
      const seg = await prisma.storyboardSegment.create({
        data: { scriptId: script.id, segmentIndex: 0, segmentType: 'oral', visualDescription: '', duration: 3.0, materialIds: [] },
      })

      const res = await request(app)
        .put(`/api/v1/scripts/${script.id}/segments/${seg.id}`)
        .send({ oral_text: '更新的文案', duration: 8.0 })
        .expect(200)

      expect(res.body.oral_text).toBe('更新的文案')
      expect(res.body.duration).toBe(8.0)
    })

    it('删除片段并重新排序', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '' },
      })
      await prisma.storyboardSegment.createMany({
        data: [
          { scriptId: script.id, segmentIndex: 0, segmentType: 'oral', visualDescription: '', duration: 3.0, materialIds: [] },
          { scriptId: script.id, segmentIndex: 1, segmentType: 'oral', visualDescription: '', duration: 3.0, materialIds: [] },
          { scriptId: script.id, segmentIndex: 2, segmentType: 'oral', visualDescription: '', duration: 3.0, materialIds: [] },
        ],
      })
      const segs = await prisma.storyboardSegment.findMany({
        where: { scriptId: script.id }, orderBy: { segmentIndex: 'asc' },
      })

      await request(app)
        .delete(`/api/v1/scripts/${script.id}/segments/${segs[1].id}`)
        .expect(200)

      const remaining = await prisma.storyboardSegment.findMany({
        where: { scriptId: script.id }, orderBy: { segmentIndex: 'asc' },
      })
      expect(remaining).toHaveLength(2)
      expect(remaining[0].segmentIndex).toBe(0)
      expect(remaining[1].segmentIndex).toBe(1)
    })

    it('拖拽排序', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '' },
      })
      await prisma.storyboardSegment.createMany({
        data: [
          { scriptId: script.id, segmentIndex: 0, segmentType: 'oral', oralText: 'A', visualDescription: '', duration: 3.0, materialIds: [] },
          { scriptId: script.id, segmentIndex: 1, segmentType: 'oral', oralText: 'B', visualDescription: '', duration: 3.0, materialIds: [] },
          { scriptId: script.id, segmentIndex: 2, segmentType: 'oral', oralText: 'C', visualDescription: '', duration: 3.0, materialIds: [] },
        ],
      })
      const allSegs = await prisma.storyboardSegment.findMany({
        where: { scriptId: script.id }, orderBy: { segmentIndex: 'asc' },
      })
      // 交换 A 和 C 的位置
      const reordered = [allSegs[2].id, allSegs[1].id, allSegs[0].id]

      await request(app)
        .put(`/api/v1/scripts/${script.id}/segments/reorder`)
        .send({ segment_ids: reordered })
        .expect(200)

      const result = await prisma.storyboardSegment.findMany({
        where: { scriptId: script.id }, orderBy: { segmentIndex: 'asc' },
      })
      expect(result).toHaveLength(3)
      expect(result[0].oralText).toBe('C')
      expect(result[2].oralText).toBe('A')
    })
  })

  describe('PUT /api/v1/scripts/:id/status', () => {
    it('确认脚本', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '待确认', status: 'draft' },
      })

      const res = await request(app)
        .put(`/api/v1/scripts/${script.id}/status`)
        .send({ status: 'confirmed' })
        .expect(200)

      expect(res.body.status).toBe('confirmed')
    })

    it('无效状态返回 400', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '' },
      })

      await request(app)
        .put(`/api/v1/scripts/${script.id}/status`)
        .send({ status: 'invalid' })
        .expect(400)
    })
  })

  describe('POST /api/v1/scripts/:scriptId/save-progress', () => {
    it('批量保存片段进度', async () => {
      const script = await prisma.script.create({
        data: { taskId, topicId, fullText: '' },
      })
      const seg1 = await prisma.storyboardSegment.create({
        data: { scriptId: script.id, segmentIndex: 0, segmentType: 'oral', oralText: '', visualDescription: '', duration: 3.0, materialIds: [] },
      })
      const seg2 = await prisma.storyboardSegment.create({
        data: { scriptId: script.id, segmentIndex: 1, segmentType: 'oral', oralText: '', visualDescription: '', duration: 3.0, materialIds: [] },
      })

      await request(app)
        .post(`/api/v1/scripts/${script.id}/save-progress`)
        .send({
          segments: [
            { id: seg1.id, oral_text: '更新1', duration: 5.0 },
            { id: seg2.id, visual_description: '画面更新' },
          ],
        })
        .expect(200)

      const updated1 = await prisma.storyboardSegment.findUnique({ where: { id: seg1.id } })
      const updated2 = await prisma.storyboardSegment.findUnique({ where: { id: seg2.id } })
      expect(updated1?.oralText).toBe('更新1')
      expect(Number(updated1?.duration)).toBe(5.0)
      expect(updated2?.visualDescription).toBe('画面更新')
    })
  })
})

