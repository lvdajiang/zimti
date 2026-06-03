import { Router, Response } from 'express'
import { authMiddleware, type AuthenticatedRequest } from '../../services/auth/authService.js'
import { initDemoData } from '../../services/dataSeeder.js'

const router: Router = Router()

// POST /api/v1/data/seed — 手动触发种子数据初始化
router.post('/data/seed', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: '未认证' })
    return
  }

  const result = await initDemoData(req.user.userId)
  res.json({ message: '种子数据初始化完成', ...result })
})

export default router
