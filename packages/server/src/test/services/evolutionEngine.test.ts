import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { mockAI, clearMockAI } from '../mockAI.js'
import { EvolutionEngine } from '../../services/aiHub/evolutionEngine.js'
import type { EvolutionType } from '@zimti/shared'

describe('EvolutionEngine', () => {
  let engine: EvolutionEngine

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
    engine = new EvolutionEngine(DEMO_USER_ID)
  })

  describe('recordAndLearn', () => {
    const types: EvolutionType[] = ['content', 'style', 'skill', 'rhythm']

    it.each(types)('所有类型都写入 evolution_logs 表 (type=%s)', async (type) => {
      await engine.recordAndLearn({
        type,
        trigger: 'test_trigger',
        before: 'before',
        after: 'after',
      })

      const log = await prisma.evolutionLog.findFirst({
        where: { userId: DEMO_USER_ID, type },
      })
      expect(log).not.toBeNull()
      expect(log!.trigger).toBe('test_trigger')
      expect((log!.detail as Record<string, unknown>).before).toBe('before')
      expect((log!.detail as Record<string, unknown>).after).toBe('after')
    })

    it('content + metric > 0.6 时保存为成功模式到 brand_memories', async () => {
      await engine.recordAndLearn({
        type: 'content',
        trigger: 'publish',
        before: null,
        after: '高表现内容文本',
        metric: 0.85,
      })

      // 验证 evolution_logs 写入
      const log = await prisma.evolutionLog.findFirst({
        where: { userId: DEMO_USER_ID, type: 'content' },
      })
      expect(log).not.toBeNull()

      // 验证 brand_memories 写入成功模式
      const skillMemories = await prisma.brandMemory.findMany({
        where: { userId: DEMO_USER_ID, category: 'skill' },
      })
      const successPatterns = skillMemories.find(m => m.key === 'content_success_patterns')
      expect(successPatterns).toBeDefined()
      const patterns = successPatterns!.value as unknown[]
      expect(patterns).toContain('高表现内容文本')
    })

    it('metric <= 0.6 时不保存到 brand_memories', async () => {
      await engine.recordAndLearn({
        type: 'content',
        trigger: 'publish',
        before: null,
        after: '低表现内容',
        metric: 0.5,
      })

      const log = await prisma.evolutionLog.findFirst({
        where: { userId: DEMO_USER_ID, type: 'content' },
      })
      expect(log).not.toBeNull()

      const brandMemoryCount = await prisma.brandMemory.count({
        where: { userId: DEMO_USER_ID, category: 'skill' },
      })
      expect(brandMemoryCount).toBe(0)
    })

    it('无 metric 时不保存到 brand_memories', async () => {
      await engine.recordAndLearn({
        type: 'content',
        trigger: 'publish',
        before: null,
        after: '无度量内容',
      })

      const log = await prisma.evolutionLog.findFirst({
        where: { userId: DEMO_USER_ID, type: 'content' },
      })
      expect(log).not.toBeNull()

      const brandMemoryCount = await prisma.brandMemory.count({
        where: { userId: DEMO_USER_ID },
      })
      expect(brandMemoryCount).toBe(0)
    })

    it('style + user_edit 触发 learnStyle 并注入 AI', async () => {
      const aiResponse = JSON.stringify({
        replacements: [{ from: 'A', to: 'B' }],
        style_rules: ['规则1'],
        avoid_expressions: ['避免X'],
      })
      mockAI([aiResponse])

      await engine.recordAndLearn({
        type: 'style',
        trigger: 'user_edit',
        before: '包含A的文本',
        after: '包含B的文本',
      })

      // 验证 evolution_logs 写入
      const log = await prisma.evolutionLog.findFirst({
        where: { userId: DEMO_USER_ID, type: 'style' },
      })
      expect(log).not.toBeNull()

      // 验证 AI 调用后写入了 brand_memories
      const styleCount = await prisma.brandMemory.count({
        where: { userId: DEMO_USER_ID, category: 'style' },
      })
      expect(styleCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('analyzePatterns', () => {
    it('空日志返回空数组', async () => {
      const result = await engine.analyzePatterns()
      expect(result).toEqual([])
    })

    it('多条日志聚合计算 frequency 和 impact', async () => {
      await engine.recordAndLearn({ type: 'content', trigger: 'publish', before: null, after: 'A', metric: 0.8 })
      await engine.recordAndLearn({ type: 'content', trigger: 'publish', before: null, after: 'B', metric: 0.6 })
      await engine.recordAndLearn({ type: 'style', trigger: 'user_edit', before: 'X', after: 'Y' })

      const result = await engine.analyzePatterns()
      expect(result.length).toBe(2)

      const contentPattern = result.find(p => p.pattern === 'content:publish')
      expect(contentPattern).toBeDefined()
      expect(contentPattern!.frequency).toBe(2)
      expect(contentPattern!.impact).toBeCloseTo(0.7) // (0.8 + 0.6) / 2

      const stylePattern = result.find(p => p.pattern === 'style:user_edit')
      expect(stylePattern).toBeDefined()
      expect(stylePattern!.frequency).toBe(1)
    })

    it('按 type 过滤', async () => {
      await engine.recordAndLearn({ type: 'content', trigger: 'publish', before: null, after: 'A', metric: 0.8 })
      await engine.recordAndLearn({ type: 'style', trigger: 'user_edit', before: 'X', after: 'Y' })

      const result = await engine.analyzePatterns('content')
      expect(result).toHaveLength(1)
      expect(result[0].pattern).toBe('content:publish')
    })
  })

  describe('getRecentLogs', () => {
    it('返回最近 N 条', async () => {
      await engine.recordAndLearn({ type: 'content', trigger: 'publish', before: null, after: '第1条' })
      await engine.recordAndLearn({ type: 'style', trigger: 'edit', before: 'A', after: 'B' })
      await engine.recordAndLearn({ type: 'skill', trigger: 'use', before: 'tool', after: null })

      const logs = await engine.getRecentLogs(2)
      expect(logs).toHaveLength(2)

      // 最新的排前面：skill 应该是第一条
      expect(logs[0].type).toBe('skill')
      expect(logs[1].type).toBe('style')
    })

    it('默认 limit 返回记录', async () => {
      await engine.recordAndLearn({ type: 'content', trigger: 'publish', before: null, after: 'A' })

      const logs = await engine.getRecentLogs()
      expect(logs.length).toBeGreaterThanOrEqual(1)
      expect(logs[0].id).toBeDefined()
      expect(logs[0].type).toBe('content')
      expect(logs[0].trigger).toBe('publish')
      expect(logs[0].createdAt).toBeDefined()
    })
  })
})
