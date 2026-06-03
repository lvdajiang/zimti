import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { prisma } from '../../db.js'

describe('Entities 路由', () => {
  const app = createTestApp()

  beforeAll(async () => {
    await setupTestDb()
  })

  afterEach(async () => {
    await cleanupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  // ============================================================
  // 1. CRUD
  // ============================================================

  describe('CRUD', () => {
    it('POST 创建实体返回 201', async () => {
      const res = await request(app)
        .post('/api/v1/entities')
        .send({ name: '测试酒店', entity_type: 'hotel', city: '杭州' })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
    })

    it('POST 缺 name 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/entities')
        .send({ entity_type: 'hotel' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/name/i)
    })

    it('POST 缺 entity_type 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/entities')
        .send({ name: '测试' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/entity_type/i)
    })

    it('GET 列表返回实体数组', async () => {
      // 先创建两个实体
      await request(app).post('/api/v1/entities').send({ name: '酒店A', entity_type: 'hotel' })
      await request(app).post('/api/v1/entities').send({ name: '餐厅B', entity_type: 'restaurant' })

      const res = await request(app).get('/api/v1/entities')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('items')
      expect(res.body).toHaveProperty('total')
      expect(res.body.total).toBe(2)
      expect(res.body.items.length).toBe(2)
    })

    it('PUT 更新实体', async () => {
      const created = await request(app)
        .post('/api/v1/entities')
        .send({ name: '原始名称', entity_type: 'hotel' })

      const res = await request(app)
        .put(`/api/v1/entities/${created.body.id}`)
        .send({ name: '更新名称', city: '上海' })

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(created.body.id)

      // 验证更新生效
      const getRes = await request(app).get('/api/v1/entities')
      const updated = getRes.body.items.find((e: { id: string }) => e.id === created.body.id)
      expect(updated.name).toBe('更新名称')
      expect(updated.city).toBe('上海')
    })

    it('DELETE 删除实体', async () => {
      const created = await request(app)
        .post('/api/v1/entities')
        .send({ name: '待删除', entity_type: 'hotel' })

      const delRes = await request(app).delete(`/api/v1/entities/${created.body.id}`)
      expect(delRes.status).toBe(200)
      expect(delRes.body.success).toBe(true)

      // 验证已删除
      const getRes = await request(app).get('/api/v1/entities')
      expect(getRes.body.items.find((e: { id: string }) => e.id === created.body.id)).toBeUndefined()
    })
  })

  // ============================================================
  // 2. 筛选
  // ============================================================

  describe('筛选', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/entities').send({ name: '杭州大酒店', aliases: '杭州酒店', entity_type: 'hotel', city: '杭州' })
      await request(app).post('/api/v1/entities').send({ name: '上海小馆', entity_type: 'restaurant', city: '上海' })
      await request(app).post('/api/v1/entities').send({ name: '西湖景区', aliases: '杭州西湖', entity_type: 'scenic', city: '杭州' })
    })

    it('按 entity_type 筛选', async () => {
      const res = await request(app)
        .get('/api/v1/entities')
        .query({ entity_type: 'hotel' })

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1)
      expect(res.body.items[0].entity_type).toBe('hotel')
    })

    it('按 keyword 搜索（匹配 name/aliases/address）', async () => {
      const res = await request(app)
        .get('/api/v1/entities')
        .query({ keyword: '杭州' })

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(2) // 杭州大酒店 + 西湖景区
    })

    it('按 city 筛选', async () => {
      const res = await request(app)
        .get('/api/v1/entities')
        .query({ city: '杭州' })

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(2)
    })

    it('组合筛选 entity_type + city', async () => {
      const res = await request(app)
        .get('/api/v1/entities')
        .query({ entity_type: 'hotel', city: '杭州' })

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1)
      expect(res.body.items[0].name).toBe('杭州大酒店')
    })

    it('分页参数生效', async () => {
      const res = await request(app)
        .get('/api/v1/entities')
        .query({ page: 1, page_size: 2 })

      expect(res.status).toBe(200)
      expect(res.body.items.length).toBe(2)
      expect(res.body.total).toBe(3)
    })
  })

  // ============================================================
  // 3. 合并
  // ============================================================

  describe('merge', () => {
    it('缺 source_ids 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/entities/merge')
        .send({ target_id: 'some-id' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/source_ids/i)
    })

    it('缺 target_id 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/entities/merge')
        .send({ source_ids: ['id1'] })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/target_id/i)
    })

    it('target 不存在返回 404', async () => {
      const res = await request(app)
        .post('/api/v1/entities/merge')
        .send({ source_ids: ['00000000-0000-0000-0000-000000000099'], target_id: '00000000-0000-0000-0000-000000000099' })

      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/not found/i)
    })

    it('成功合并：别名合并 + source 删除', async () => {
      // 创建 target 和两个 source
      const target = await request(app)
        .post('/api/v1/entities')
        .send({ name: '主酒店', entity_type: 'hotel', aliases: '主别名' })
      const src1 = await request(app)
        .post('/api/v1/entities')
        .send({ name: '分店A', entity_type: 'hotel', city: '杭州' })
      const src2 = await request(app)
        .post('/api/v1/entities')
        .send({ name: '分店B', entity_type: 'hotel', aliases: '分店B别名', phone: '123456' })

      const res = await request(app)
        .post('/api/v1/entities/merge')
        .send({ source_ids: [src1.body.id, src2.body.id], target_id: target.body.id })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.merged_count).toBe(2)

      // 验证 source 已删除
      const listRes = await request(app).get('/api/v1/entities')
      const remainingIds = listRes.body.items.map((e: { id: string }) => e.id)
      expect(remainingIds).not.toContain(src1.body.id)
      expect(remainingIds).not.toContain(src2.body.id)

      // 验证 target 别名包含 source 名字
      const entity = await prisma.entity.findUnique({ where: { id: target.body.id } })
      expect(entity!.aliases).toContain('分店A')
      expect(entity!.aliases).toContain('分店B')
      expect(entity!.aliases).toContain('分店B别名')

      // 验证空白字段补充
      expect(entity!.city).toBe('杭州')
      expect(entity!.phone).toBe('123456')
    })

    it('合并时迁移 source 下的资源到 target', async () => {
      const target = await request(app)
        .post('/api/v1/entities')
        .send({ name: '主酒店', entity_type: 'hotel' })
      const src = await request(app)
        .post('/api/v1/entities')
        .send({ name: '分店', entity_type: 'hotel' })

      // 在 source 下创建资源
      await request(app)
        .post(`/api/v1/entities/${src.body.id}/resources`)
        .send({ name: '会议室', resource_type: 'meeting_room' })

      // 合并
      await request(app)
        .post('/api/v1/entities/merge')
        .send({ source_ids: [src.body.id], target_id: target.body.id })

      // 验证资源迁移到 target
      const resRes = await request(app).get(`/api/v1/entities/${target.body.id}/resources`)
      expect(resRes.status).toBe(200)
      expect(resRes.body.items.length).toBe(1)
      expect(resRes.body.items[0].entity_id).toBe(target.body.id)
    })
  })

  // ============================================================
  // 4. amap-search
  // ============================================================

  describe('amap-search', () => {
    it('缺 keyword 返回 400', async () => {
      const res = await request(app)
        .get('/api/v1/entities/amap-search')
        .query({ city: '杭州' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/keyword/i)
    })

    it('测试环境无 AMAP_API_KEY 返回 503', async () => {
      // 备份并清除环境变量
      const originalKey = process.env.AMAP_API_KEY
      delete process.env.AMAP_API_KEY

      const res = await request(app)
        .get('/api/v1/entities/amap-search')
        .query({ keyword: '酒店', city: '杭州' })

      expect(res.status).toBe(503)

      // 恢复环境变量
      if (originalKey) process.env.AMAP_API_KEY = originalKey
    })
  })

  // ============================================================
  // 5. from-amap
  // ============================================================

  describe('from-amap', () => {
    it('缺 name 返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/entities/from-amap')
        .send({ address: '杭州市', entity_type: 'hotel' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/name/i)
    })

    it('同名同地址返回 409', async () => {
      // 先创建实体
      await request(app)
        .post('/api/v1/entities')
        .send({ name: '测试酒店', entity_type: 'hotel', address: '杭州市西湖区' })

      // 同名同地址再创建
      const res = await request(app)
        .post('/api/v1/entities/from-amap')
        .send({ name: '测试酒店', address: '杭州市西湖区', entity_type: 'hotel' })

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/已存在/)
      expect(res.body).toHaveProperty('id')
    })

    it('成功创建返回 201', async () => {
      const res = await request(app)
        .post('/api/v1/entities/from-amap')
        .send({
          name: '高德酒店',
          address: '杭州市滨江区',
          city: '杭州',
          region: '浙江省',
          phone: '0571-12345678',
          longitude: '120.2',
          latitude: '30.3',
          entity_type: 'hotel',
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
    })

    it('自动推断 entity_type（根据 amap_type）', async () => {
      const res = await request(app)
        .post('/api/v1/entities/from-amap')
        .send({
          name: '高德餐厅',
          amap_type: '餐饮;中餐厅;火锅',
        })

      expect(res.status).toBe(201)
      const entity = await prisma.entity.findUnique({ where: { id: res.body.id } })
      expect(entity!.entityType).toBe('restaurant')
    })
  })

  // ============================================================
  // 6. resources（嵌套资源 CRUD）
  // ============================================================

  describe('resources', () => {
    it('entity 不存在返回 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000099'

      const getRes = await request(app).get(`/api/v1/entities/${fakeId}/resources`)
      expect(getRes.status).toBe(404)
      expect(getRes.body.error).toMatch(/entity not found/i)

      const postRes = await request(app)
        .post(`/api/v1/entities/${fakeId}/resources`)
        .send({ name: '资源', resource_type: 'room' })
      expect(postRes.status).toBe(404)
    })

    it('嵌套 CRUD 完整流程', async () => {
      // 创建实体
      const entity = await request(app)
        .post('/api/v1/entities')
        .send({ name: '测试酒店', entity_type: 'hotel' })
      const entityId = entity.body.id

      // 创建资源
      const created = await request(app)
        .post(`/api/v1/entities/${entityId}/resources`)
        .send({ name: '豪华大床房', resource_type: 'room', unit: '间', unit_price: 599, remark: '含早' })

      expect(created.status).toBe(201)
      expect(created.body).toHaveProperty('id')
      const resourceId = created.body.id

      // 列表
      const listRes = await request(app).get(`/api/v1/entities/${entityId}/resources`)
      expect(listRes.status).toBe(200)
      expect(listRes.body.items.length).toBe(1)
      expect(listRes.body.items[0].name).toBe('豪华大床房')
      expect(listRes.body.items[0].resource_type).toBe('room')
      expect(listRes.body.items[0].unit).toBe('间')
      expect(listRes.body.items[0].unit_price).toBe('599')

      // 更新
      const updateRes = await request(app)
        .put(`/api/v1/entities/resources/${resourceId}`)
        .send({ name: '商务大床房', unit_price: 399 })

      expect(updateRes.status).toBe(200)

      // 验证更新
      const updatedList = await request(app).get(`/api/v1/entities/${entityId}/resources`)
      expect(updatedList.body.items[0].name).toBe('商务大床房')
      expect(updatedList.body.items[0].unit_price).toBe('399')

      // 删除
      const delRes = await request(app).delete(`/api/v1/entities/resources/${resourceId}`)
      expect(delRes.status).toBe(200)
      expect(delRes.body.success).toBe(true)

      // 验证已删除
      const afterDel = await request(app).get(`/api/v1/entities/${entityId}/resources`)
      expect(afterDel.body.items.length).toBe(0)
    })

    it('创建资源缺 name 返回 400', async () => {
      const entity = await request(app)
        .post('/api/v1/entities')
        .send({ name: '测试酒店', entity_type: 'hotel' })

      const res = await request(app)
        .post(`/api/v1/entities/${entity.body.id}/resources`)
        .send({ resource_type: 'room' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/name/i)
    })

    it('创建资源缺 resource_type 返回 400', async () => {
      const entity = await request(app)
        .post('/api/v1/entities')
        .send({ name: '测试酒店', entity_type: 'hotel' })

      const res = await request(app)
        .post(`/api/v1/entities/${entity.body.id}/resources`)
        .send({ name: '大床房' })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/resource_type/i)
    })

    it('实体 resource_count 正确更新', async () => {
      const entity = await request(app)
        .post('/api/v1/entities')
        .send({ name: '测试酒店', entity_type: 'hotel' })
      const entityId = entity.body.id

      await request(app)
        .post(`/api/v1/entities/${entityId}/resources`)
        .send({ name: '资源A', resource_type: 'room' })
      await request(app)
        .post(`/api/v1/entities/${entityId}/resources`)
        .send({ name: '资源B', resource_type: 'room' })

      const listRes = await request(app).get('/api/v1/entities')
      const hotel = listRes.body.items.find((e: { id: string }) => e.id === entityId)
      expect(hotel.resource_count).toBe(2)
    })
  })
})
