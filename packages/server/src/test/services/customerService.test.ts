import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { mockAI, clearMockAI } from '../mockAI.js'
import { CustomerService } from '../../services/crm/customerService.js'

describe('CustomerService', () => {
  let service: CustomerService

  beforeAll(async () => {
    await setupTestDb()
    await cleanupTestDb()
    service = new CustomerService(DEMO_USER_ID)
  })

  afterEach(async () => {
    await cleanupTestDb()
    clearMockAI()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  // ---- list ----
  describe('list', () => {
    it('空库返回 { items: [], total: 0 }', async () => {
      const result = await service.list()
      expect(result).toEqual({ items: [], total: 0 })
    })

    it('创建客户后返回列表', async () => {
      await service.create({ name: '张三' })
      await service.create({ name: '李四' })

      const result = await service.list()
      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
      // 按 updatedAt desc 排序，李四在后创建所以排在前面
      expect(result.items[0].name).toBe('李四')
    })

    it('按 stage 筛选', async () => {
      await service.create({ name: '新客户', stage: 'new_friend' })
      await service.create({ name: '在聊客户', stage: 'chatting' })
      await service.create({ name: '另一个新客户', stage: 'new_friend' })

      const result = await service.list({ stage: 'new_friend' })
      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
      for (const item of result.items) {
        expect(item.stage).toBe('new_friend')
      }
    })
  })

  // ---- create ----
  describe('create', () => {
    it('正常创建客户', async () => {
      const customer = await service.create({ name: '王五', phone: '13800001111' })
      expect(customer.id).toBeTruthy()
      expect(customer.name).toBe('王五')
      expect(customer.phone).toBe('13800001111')
      expect(customer.userId).toBe(DEMO_USER_ID)
    })

    it('默认 stage 为 new_friend', async () => {
      const customer = await service.create({ name: '赵六' })
      expect(customer.stage).toBe('new_friend')
      expect(customer.intentLevel).toBe('medium')
      expect(customer.sourceType).toBe('manual')
    })

    it('tags 参数正常创建标签', async () => {
      const customer = await service.create({ name: '钱七', tags: ['VIP', '回头客'] })

      const tags = await prisma.customerTag.findMany({ where: { customerId: customer.id } })
      expect(tags).toHaveLength(2)
      const tagValues = tags.map((t) => t.tag)
      expect(tagValues).toContain('VIP')
      expect(tagValues).toContain('回头客')
    })

    it('创建时写入 customer_stage_log', async () => {
      const customer = await service.create({ name: '孙八' })

      const logs = await prisma.customerStageLog.findMany({ where: { customerId: customer.id } })
      expect(logs).toHaveLength(1)
      expect(logs[0].fromStage).toBe('')
      expect(logs[0].toStage).toBe('new_friend')
    })
  })

  // ---- update ----
  describe('update', () => {
    it('更新 name', async () => {
      const customer = await service.create({ name: '原名' })
      const updated = await service.update(customer.id, { name: '新名' })
      expect(updated.name).toBe('新名')
    })

    it('更新 phone', async () => {
      const customer = await service.create({ name: '周九' })
      const updated = await service.update(customer.id, { phone: '13900002222' })
      expect(updated.phone).toBe('13900002222')
    })
  })

  // ---- updateStage ----
  describe('updateStage', () => {
    it('阶段流转成功', async () => {
      const customer = await service.create({ name: '阶段流转', stage: 'new_friend' })
      const updated = await service.updateStage(customer.id, 'chatting')
      expect(updated.stage).toBe('chatting')
    })

    it('写入 customer_stage_log', async () => {
      const customer = await service.create({ name: '日志测试', stage: 'new_friend' })
      await service.updateStage(customer.id, 'chatting', '聊得不错')

      const logs = await prisma.customerStageLog.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'asc' },
      })
      // create 时写了一条，updateStage 又写了一条
      expect(logs).toHaveLength(2)
      expect(logs[1].fromStage).toBe('new_friend')
      expect(logs[1].toStage).toBe('chatting')
      expect(logs[1].note).toBe('聊得不错')
    })

    it('相同阶段不写入日志', async () => {
      const customer = await service.create({ name: '同阶段测试', stage: 'chatting' })
      const result = await service.updateStage(customer.id, 'chatting')

      // 返回的 customer 不应有变化
      expect(result.stage).toBe('chatting')
      const logs = await prisma.customerStageLog.findMany({ where: { customerId: customer.id } })
      // 只有 create 时写的一条
      expect(logs).toHaveLength(1)
    })
  })

  // ---- addTags ----
  describe('addTags', () => {
    it('添加标签', async () => {
      const customer = await service.create({ name: '标签测试' })
      await service.addTags(customer.id, ['新标签A', '新标签B'])

      const tags = await prisma.customerTag.findMany({ where: { customerId: customer.id } })
      const tagValues = tags.map((t) => t.tag)
      expect(tagValues).toContain('新标签A')
      expect(tagValues).toContain('新标签B')
    })

    it('重复添加不报错（skipDuplicates）', async () => {
      const customer = await service.create({ name: '去重测试', tags: ['去重标签'] })
      // 再次添加相同标签
      await service.addTags(customer.id, ['去重标签', '另一个标签'])

      const tags = await prisma.customerTag.findMany({ where: { customerId: customer.id } })
      expect(tags).toHaveLength(2)
    })
  })

  // ---- removeTag ----
  describe('removeTag', () => {
    it('删除标签', async () => {
      const customer = await service.create({ name: '删标签测试', tags: ['待删除', '保留'] })
      await service.removeTag(customer.id, '待删除')

      const tags = await prisma.customerTag.findMany({ where: { customerId: customer.id } })
      const tagValues = tags.map((t) => t.tag)
      expect(tagValues).not.toContain('待删除')
      expect(tagValues).toContain('保留')
    })
  })

  // ---- delete ----
  describe('delete', () => {
    it('删除客户', async () => {
      const customer = await service.create({ name: '待删除客户' })
      await service.delete(customer.id)

      // 查询应找不到
      const found = await prisma.customer.findUnique({ where: { id: customer.id } })
      expect(found).toBeNull()
    })
  })

  // ---- parseVoiceInput ----
  describe('parseVoiceInput', () => {
    it('mock AI 返回标准 JSON，验证返回结构', async () => {
      const aiResponse = JSON.stringify({
        name: '张三',
        travel_intent: { people: 3, date: '2026-06-01', destination: '三亚', budget: '5000' },
        tags: ['家庭游', '首次咨询'],
        notes: '3个人想去三亚玩，预算5000',
      })
      mockAI([aiResponse])

      const result = await service.parseVoiceInput('张三说3个人想去三亚，预算五千')

      expect(result.name).toBe('张三')
      expect(result.travelIntent).toEqual({
        people: 3,
        date: '2026-06-01',
        destination: '三亚',
        budget: '5000',
      })
      expect(result.tags).toEqual(['家庭游', '首次咨询'])
      expect(result.notes).toBe('3个人想去三亚玩，预算5000')
    })

    it('AI 无效时降级返回原始文本', async () => {
      // AI 返回无效 JSON
      mockAI(['这不是JSON内容'])

      const result = await service.parseVoiceInput('你好我想咨询一下')

      expect(result.name).toBeUndefined()
      expect(result.travelIntent).toBeUndefined()
      expect(result.notes).toBe('你好我想咨询一下')
    })

    it('AI 不可用时降级返回原始文本', async () => {
      // 不设置 mock AI，getAIProvider() 返回 null
      const result = await service.parseVoiceInput('没有AI的时候')

      expect(result.notes).toBe('没有AI的时候')
    })
  })

  // ---- getSilentCustomers ----
  describe('getSilentCustomers', () => {
    it('空库返回空数组', async () => {
      const result = await service.getSilentCustomers()
      expect(result).toHaveLength(0)
    })

    it('创建旧客户后验证返回', async () => {
      // 创建一个 stage 不在排除列表中、且 lastFollowUpAt 为很久以前的客户
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      await prisma.customer.create({
        data: {
          userId: DEMO_USER_ID,
          name: '沉默客户',
          stage: 'chatting',
          lastFollowUpAt: oldDate,
        },
      })

      const result = await service.getSilentCustomers()
      expect(result.length).toBeGreaterThanOrEqual(1)
      const silent = result.find((c) => c.name === '沉默客户')
      expect(silent).toBeDefined()
    })

    it('ordered/completed/repurchase 阶段不纳入沉默客户', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      await prisma.customer.create({
        data: {
          userId: DEMO_USER_ID,
          name: '已下单客户',
          stage: 'ordered',
          lastFollowUpAt: oldDate,
        },
      })

      const result = await service.getSilentCustomers()
      expect(result.find((c) => c.name === '已下单客户')).toBeUndefined()
    })
  })

  // ---- getFunnelStats ----
  describe('getFunnelStats', () => {
    it('空库返回全 0', async () => {
      const stats = await service.getFunnelStats()
      const stages = ['new_friend', 'chatting', 'deep_consult', 'hesitating', 'ordered', 'traveling', 'completed', 'repurchase']
      for (const stage of stages) {
        expect(stats[stage]).toBe(0)
      }
      expect(Object.keys(stats)).toHaveLength(8)
    })

    it('创建不同阶段客户后统计', async () => {
      await service.create({ name: '客户1', stage: 'new_friend' })
      await service.create({ name: '客户2', stage: 'new_friend' })
      await service.create({ name: '客户3', stage: 'chatting' })
      await service.create({ name: '客户4', stage: 'ordered' })

      const stats = await service.getFunnelStats()
      expect(stats['new_friend']).toBe(2)
      expect(stats['chatting']).toBe(1)
      expect(stats['ordered']).toBe(1)
      expect(stats['deep_consult']).toBe(0)
      expect(stats['hesitating']).toBe(0)
      expect(stats['traveling']).toBe(0)
      expect(stats['completed']).toBe(0)
      expect(stats['repurchase']).toBe(0)
    })
  })
})
