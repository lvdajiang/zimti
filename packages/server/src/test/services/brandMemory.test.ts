import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { mockAI, clearMockAI } from '../mockAI.js'
import { BrandMemoryService } from '../../services/aiHub/brandMemory.js'

describe('BrandMemoryService', () => {
  let service: BrandMemoryService

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

  beforeEach(() => {
    service = new BrandMemoryService(DEMO_USER_ID)
  })

  describe('getProfile', () => {
    it('空库返回空对象', async () => {
      const result = await service.getProfile()
      expect(result).toEqual({})
    })

    it('upsert 多条后按 category 分组返回', async () => {
      await service.upsert('profile', 'brand_name', '测试品牌')
      await service.upsert('profile', 'industry', '餐饮')
      await service.upsert('style', 'tone', '轻松')

      const result = await service.getProfile()
      expect(result).toEqual({
        profile: {
          brand_name: '测试品牌',
          industry: '餐饮',
        },
        style: {
          tone: '轻松',
        },
      })
    })
  })

  describe('getCategory', () => {
    it('返回指定分类的记忆', async () => {
      await service.upsert('preference', 'color', '蓝色')
      await service.upsert('preference', 'font', '思源黑体')

      const result = await service.getCategory('preference')
      expect(result).toEqual({
        color: '蓝色',
        font: '思源黑体',
      })
    })

    it('不存在返回空对象', async () => {
      const result = await service.getCategory('skill')
      expect(result).toEqual({})
    })
  })

  describe('upsert', () => {
    it('新建成功', async () => {
      await service.upsert('profile', 'name', '初始值')

      const row = await prisma.brandMemory.findUnique({
        where: { userId_category_key: { userId: DEMO_USER_ID, category: 'profile', key: 'name' } },
      })
      expect(row).not.toBeNull()
      expect(row!.value).toEqual('初始值')
      expect(row!.source).toBe('manual')
      expect(row!.weight).toBe(1.0)
    })

    it('相同 category+key 更新值', async () => {
      await service.upsert('profile', 'name', '初始值')
      await service.upsert('profile', 'name', '更新值', 'learned', 0.8)

      const rows = await prisma.brandMemory.findMany({
        where: { userId: DEMO_USER_ID, category: 'profile', key: 'name' },
      })
      expect(rows).toHaveLength(1)
      expect(rows[0].value).toEqual('更新值')
      expect(rows[0].source).toBe('learned')
      expect(rows[0].weight).toBe(0.8)
    })
  })

  describe('delete', () => {
    it('删除存在的记录', async () => {
      await service.upsert('preference', 'theme', '深色')
      const before = await prisma.brandMemory.count({ where: { userId: DEMO_USER_ID } })
      expect(before).toBe(1)

      await service.delete('preference', 'theme')

      const after = await prisma.brandMemory.count({ where: { userId: DEMO_USER_ID } })
      expect(after).toBe(0)
    })
  })

  describe('learnStyle', () => {
    it('AI 返回风格规则后写入 brand_memories', async () => {
      const aiResponse = JSON.stringify({
        replacements: [{ from: '不可错过', to: '绝了' }],
        style_rules: ['简洁表达', '用短句'],
        avoid_expressions: ['过度营销'],
      })
      mockAI([aiResponse])

      await service.learnStyle('这是一个不可错过的机会', '这绝了')

      // 验证 style 分类下有数据
      const styleMemories = await prisma.brandMemory.findMany({
        where: { userId: DEMO_USER_ID, category: 'style' },
      })
      expect(styleMemories.length).toBeGreaterThanOrEqual(1)

      // 验证 word_replacements 被写入
      const wordReplacements = styleMemories.find(m => m.key === 'word_replacements')
      expect(wordReplacements).toBeDefined()
      expect(wordReplacements!.value).toEqual([{ from: '不可错过', to: '绝了' }])

      // 验证 style_rules 被写入
      const styleRules = styleMemories.find(m => m.key === 'style_rules')
      expect(styleRules).toBeDefined()
      expect(styleRules!.value).toContain('简洁表达')
      expect(styleRules!.value).toContain('用短句')

      // 验证 avoid_expressions 写入 preference 分类
      const preferenceMemories = await prisma.brandMemory.findMany({
        where: { userId: DEMO_USER_ID, category: 'preference' },
      })
      const avoidExpr = preferenceMemories.find(m => m.key === 'avoid_expressions')
      expect(avoidExpr).toBeDefined()
      expect(avoidExpr!.value).toContain('过度营销')
    })

    it('AI 无返回时静默不写入', async () => {
      mockAI([JSON.stringify({ replacements: [], style_rules: [], avoid_expressions: [] })])

      await service.learnStyle('原始文本', '修改文本')

      const count = await prisma.brandMemory.count({ where: { userId: DEMO_USER_ID } })
      expect(count).toBe(0)
    })
  })

  describe('getContext', () => {
    it('空库返回空字符串', async () => {
      const result = await service.getContext()
      expect(result).toBe('')
    })

    it('有数据时返回格式化文本', async () => {
      await service.upsert('profile', 'brand_name', '测试品牌')
      await service.upsert('style', 'tone', '友好')

      const result = await service.getContext()
      expect(result).toContain('品牌画像：')
      expect(result).toContain('[profile] brand_name: "测试品牌"')
      expect(result).toContain('[style] tone: "友好"')
    })
  })
})
