import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { mockAI, clearMockAI } from '../mockAI.js'
import { StrategyEngine } from '../../services/aiHub/strategyEngine.js'
import { BrandMemoryService } from '../../services/aiHub/brandMemory.js'

describe('StrategyEngine', () => {
  let engine: StrategyEngine
  let brandMemory: BrandMemoryService

  beforeAll(async () => {
    await setupTestDb()
    await cleanupTestDb()
    engine = new StrategyEngine(DEMO_USER_ID)
    brandMemory = new BrandMemoryService(DEMO_USER_ID)
  })

  afterEach(async () => {
    await cleanupTestDb()
    clearMockAI()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  // ---- evaluateHotspot ----
  describe('evaluateHotspot', () => {
    it('mock AI 返回有效 JSON，验证返回结构', async () => {
      // 先建立品牌画像，否则 getContext 返回空字符串会短路
      await brandMemory.upsert('identity', 'niche', '旅游自媒体', 'manual', 1.0)

      const aiResponse = JSON.stringify({
        match_score: 75,
        reasoning: '适合旅游自媒体账号',
        suggested: true,
      })
      mockAI([aiResponse])

      const result = await engine.evaluateHotspot('暑期旅游旺季', '暑假旅游需求暴增')

      expect(result.matchScore).toBe(75)
      expect(result.reasoning).toBe('适合旅游自媒体账号')
      expect(result.suggested).toBe(true)
    })

    it('品牌画像未建立时返回低分', async () => {
      // 不创建品牌画像
      const result = await engine.evaluateHotspot('某热点', '某描述')

      expect(result.matchScore).toBe(0)
      expect(result.reasoning).toBe('品牌画像尚未建立')
      expect(result.suggested).toBe(false)
    })

    it('AI 不可用时返回降级结果', async () => {
      // 建立品牌画像但不设置 mock AI
      await brandMemory.upsert('identity', 'niche', '旅游自媒体', 'manual', 1.0)
      // clearMockAI 设置 NullAIProvider（generate 抛异常），走 catch 降级

      const result = await engine.evaluateHotspot('某热点', '某描述')

      expect(result.matchScore).toBe(0)
      expect(result.reasoning).toBe('分析失败')
      expect(result.suggested).toBe(false)
    })

    it('AI 返回无效 JSON 时降级', async () => {
      await brandMemory.upsert('identity', 'niche', '旅游自媒体', 'manual', 1.0)
      mockAI(['这不是JSON'])

      const result = await engine.evaluateHotspot('某热点', '某描述')

      expect(result.matchScore).toBe(0)
      expect(result.reasoning).toBe('分析失败')
      expect(result.suggested).toBe(false)
    })
  })

  // ---- getRecommendations ----
  describe('getRecommendations', () => {
    it('无客户时返回空数组', async () => {
      const result = await engine.getRecommendations()
      expect(result).toEqual([])
    })

    it('有客户出行意向时生成选题推荐', async () => {
      // 创建多个关注同一目的地的客户
      for (let i = 0; i < 3; i++) {
        await prisma.customer.create({
          data: {
            userId: DEMO_USER_ID,
            name: `客户${i}`,
            stage: 'new_friend',
            travelIntent: { destination: '三亚', people: 2 },
          },
        })
      }

      const result = await engine.getRecommendations()
      expect(result.length).toBeGreaterThanOrEqual(1)

      const topicRec = result.find((r) => r.type === 'topic')
      expect(topicRec).toBeDefined()
      expect(topicRec!.title).toContain('三亚')
      expect(topicRec!.priority).toBe('high')
    })

    it('沉默客户生成跟进建议', async () => {
      // 创建一个超过3天未跟进的客户（lastFollowUpAt 为 null 满足条件）
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      await prisma.customer.create({
        data: {
          userId: DEMO_USER_ID,
          name: '沉默客户',
          stage: 'chatting',
          lastFollowUpAt: oldDate,
        },
      })

      const result = await engine.getRecommendations()
      const followUp = result.find((r) => r.type === 'follow_up')
      expect(followUp).toBeDefined()
      expect(followUp!.priority).toBe('high')
      expect(followUp!.title).toContain('客户需要跟进')
    })
  })

  // ---- crossModuleAction ----
  describe('crossModuleAction', () => {
    it('crm source + question 生成选题推荐', async () => {
      const result = await engine.crossModuleAction('crm', { question: '三亚跟团游多少钱' })

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('topic')
      expect(result[0].title).toContain('三亚跟团游多少钱')
      expect(result[0].reason).toBe('CRM 客户反馈')
      expect(result[0].action).toBe('推荐制作为视频选题')
    })

    it('video_metric source + 高完播率生成改进建议', async () => {
      const result = await engine.crossModuleAction('video_metric', {
        completionRate: 0.75,
        videoId: 'vid_001',
      })

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('content_improve')
      expect(result[0].title).toContain('高完播率')
      expect(result[0].reason).toContain('75%')
    })

    it('video_metric source + 低完播率不生成建议', async () => {
      const result = await engine.crossModuleAction('video_metric', {
        completionRate: 0.3,
        videoId: 'vid_002',
      })

      expect(result).toHaveLength(0)
    })

    it('未知 source 返回空数组', async () => {
      const result = await engine.crossModuleAction('unknown_module', {})
      expect(result).toEqual([])
    })

    it('crm source 缺少 question 字段返回空数组', async () => {
      const result = await engine.crossModuleAction('crm', { other: 'data' })
      expect(result).toEqual([])
    })
  })
})
