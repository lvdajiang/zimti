import { Router } from 'express'
import { getUserId, str } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import {
  createReferral,
  generateReferralCode,
  listReferrals,
  getReferralStats,
  updateReferralStatus,
  createReward,
  listRewards,
  updateRewardStatus,
} from '../../services/referralService.js'
import type { Request, Response } from 'express'

const router: Router = Router()
router.use(optionalAuth)

// GET /api/v1/referral — 推荐列表
router.get('/referral', async (req: Request, res: Response) => {
  const result = await listReferrals(getUserId(req as any), {
    status: str(req.query.status) || undefined,
    sourceType: str(req.query.source_type) || undefined,
  })
  res.json(result)
})

// POST /api/v1/referral — 创建推荐记录
router.post('/referral', async (req: Request, res: Response) => {
  const { referrer_customer_id, referee_customer_id, source_type, note } = req.body
  if (!referrer_customer_id || !source_type) {
    res.status(400).json({ error: 'referrer_customer_id and source_type are required' })
    return
  }
  const referral = await createReferral(getUserId(req as any), {
    referrerCustomerId: referrer_customer_id,
    refereeCustomerId: referee_customer_id,
    sourceType: source_type,
    note,
  })
  res.status(201).json({ id: referral.id })
})

// PUT /api/v1/referral/:id — 更新推荐状态
router.put('/referral/:id', async (req: Request, res: Response) => {
  const { status } = req.body
  if (!status) { res.status(400).json({ error: 'status is required' }); return }
  const referral = await updateReferralStatus(getUserId(req as any), str(req.params.id), status)
  res.json({ id: referral.id, status: referral.status })
})

// GET /api/v1/referral/stats — 推荐统计
router.get('/referral/stats', async (req: Request, res: Response) => {
  const stats = await getReferralStats(getUserId(req as any))
  res.json(stats)
})

// POST /api/v1/referral/generate-code/:customerId — 生成推荐码
router.post('/referral/generate-code/:customerId', async (req: Request, res: Response) => {
  const result = await generateReferralCode(getUserId(req as any), str(req.params.customerId))
  res.json(result)
})

// GET /api/v1/referral/rewards — 奖励列表
router.get('/referral/rewards', async (req: Request, res: Response) => {
  const items = await listRewards(getUserId(req as any))
  res.json({ items })
})

// POST /api/v1/referral/rewards — 创建奖励
router.post('/referral/rewards', async (req: Request, res: Response) => {
  const { referral_id, reward_type, reward_value } = req.body
  if (!referral_id || !reward_type || reward_value == null) {
    res.status(400).json({ error: 'referral_id, reward_type and reward_value are required' })
    return
  }
  const reward = await createReward(getUserId(req as any), {
    referralId: referral_id,
    rewardType: reward_type,
    rewardValue: Number(reward_value),
  })
  res.status(201).json({ id: reward.id })
})

// PUT /api/v1/referral/rewards/:id — 更新奖励状态
router.put('/referral/rewards/:id', async (req: Request, res: Response) => {
  const { status } = req.body
  if (!status) { res.status(400).json({ error: 'status is required' }); return }
  const reward = await updateRewardStatus(getUserId(req as any), str(req.params.id), status)
  res.json({ id: reward.id, status: reward.status })
})

export default router
