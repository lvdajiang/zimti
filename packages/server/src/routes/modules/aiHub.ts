import { Router } from 'express'
import { DEMO_USER_ID, str, toInt } from '../../constants.js'
import { BrandMemoryService } from '../../services/aiHub/brandMemory.js'
import { StrategyEngine } from '../../services/aiHub/strategyEngine.js'
import { EvolutionEngine } from '../../services/aiHub/evolutionEngine.js'
import type { Request, Response } from 'express'
import type { BrandMemoryCategory, EvolutionType } from '@zimti/shared'

const router: Router = Router()

const VALID_CATEGORIES: BrandMemoryCategory[] = ['profile', 'style', 'preference', 'skill']
const VALID_EVOLUTION_TYPES: EvolutionType[] = ['content', 'style', 'skill', 'rhythm']

// GET /api/v1/ai-hub/brand-memory — 获取品牌画像
router.get('/ai-hub/brand-memory', async (_req: Request, res: Response) => {
  const service = new BrandMemoryService(DEMO_USER_ID)
  const profile = await service.getProfile()
  res.json(profile)
})

// PUT /api/v1/ai-hub/brand-memory — 更新品牌记忆
router.put('/ai-hub/brand-memory', async (req: Request, res: Response) => {
  const { category, key, value, source, weight } = req.body
  if (!category || !key || value === undefined) {
    res.status(400).json({ error: 'category, key, value are required' })
    return
  }
  if (!VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` })
    return
  }
  const service = new BrandMemoryService(DEMO_USER_ID)
  await service.upsert(category, key, value, source, weight)
  res.json({ success: true })
})

// POST /api/v1/ai-hub/brand-memory/learn — 触发风格学习
router.post('/ai-hub/brand-memory/learn', async (req: Request, res: Response) => {
  const { original_text, modified_text } = req.body
  if (!original_text || !modified_text) {
    res.status(400).json({ error: 'original_text and modified_text are required' })
    return
  }
  const service = new BrandMemoryService(DEMO_USER_ID)
  await service.learnStyle(String(original_text), String(modified_text))
  res.json({ success: true })
})

// DELETE /api/v1/ai-hub/brand-memory — 删除单条记忆
router.delete('/ai-hub/brand-memory', async (req: Request, res: Response) => {
  const { category, key } = req.body
  if (!category || !key) {
    res.status(400).json({ error: 'category and key are required' })
    return
  }
  const service = new BrandMemoryService(DEMO_USER_ID)
  await service.delete(category as BrandMemoryCategory, key)
  res.json({ success: true })
})

// GET /api/v1/ai-hub/strategy/recommendations — 获取策略推荐
router.get('/ai-hub/strategy/recommendations', async (_req: Request, res: Response) => {
  const engine = new StrategyEngine(DEMO_USER_ID)
  const recommendations = await engine.getRecommendations()
  res.json({ recommendations })
})

// POST /api/v1/ai-hub/strategy/evaluate-hotspot — 评估热点匹配度
router.post('/ai-hub/strategy/evaluate-hotspot', async (req: Request, res: Response) => {
  const { title, description } = req.body
  if (!title) {
    res.status(400).json({ error: 'title is required' })
    return
  }
  const engine = new StrategyEngine(DEMO_USER_ID)
  const result = await engine.evaluateHotspot(String(title), String(description ?? ''))
  res.json(result)
})

// POST /ai-hub/evolution/analyze — 触发进化分析
router.post('/ai-hub/evolution/analyze', async (req: Request, res: Response) => {
  const { type, trigger, before, after, metric } = req.body
  if (!type || !trigger) {
    res.status(400).json({ error: 'type and trigger are required' })
    return
  }
  if (!VALID_EVOLUTION_TYPES.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${VALID_EVOLUTION_TYPES.join(', ')}` })
    return
  }
  const engine = new EvolutionEngine(DEMO_USER_ID)
  await engine.recordAndLearn({ type, trigger, before, after, metric })
  res.json({ success: true })
})

// GET /api/v1/ai-hub/evolution/log — 查看进化日志
router.get('/ai-hub/evolution/log', async (req: Request, res: Response) => {
  const limit = Math.min(toInt(req.query.limit, 20), 100)
  const type = str(req.query.type) as EvolutionType | ''

  const engine = new EvolutionEngine(DEMO_USER_ID)
  if (type && VALID_EVOLUTION_TYPES.includes(type)) {
    const patterns = await engine.analyzePatterns(type)
    const logs = await engine.getRecentLogs(limit)
    res.json({ logs, patterns })
  } else {
    const logs = await engine.getRecentLogs(limit)
    res.json({ logs })
  }
})

export default router
