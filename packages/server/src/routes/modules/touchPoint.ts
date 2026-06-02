import { Router } from 'express'
import { getUserId, str, toInt } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import * as tpService from '../../services/touchPointService.js'
import type { Request, Response } from 'express'
import type { TouchPointType } from '@zimti/shared'

const router: Router = Router()
router.use(optionalAuth)

// GET /api/v1/touch-points/today-tasks — 获取今日触达任务
router.get('/touch-points/today-tasks', async (req: Request, res: Response) => {
  try {
    const tasks = await tpService.getTodayTasks(getUserId(req as any))
    res.json({ items: tasks })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/v1/touch-points — 列出所有触达记录
router.get('/touch-points', async (req: Request, res: Response) => {
  try {
    const touchType = str(req.query.touch_type) as TouchPointType | ''
    const customerId = str(req.query.customer_id)
    const result = await tpService.listTouchPoints(
      getUserId(req as any),
      toInt(req.query.page, 1),
      toInt(req.query.page_size, 20),
      touchType || undefined,
      customerId || undefined,
    )
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/v1/touch-points/customer/:customerId — 某客户的触达历史
router.get('/touch-points/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const result = await tpService.getCustomerHistory(
      getUserId(req as any),
      str(req.params.customerId),
      toInt(req.query.page, 1),
      toInt(req.query.page_size, 20),
    )
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/v1/touch-points — 创建触达记录
router.post('/touch-points', async (req: Request, res: Response) => {
  try {
    const { customer_id, touch_type, content_summary, response } = req.body
    if (!customer_id || !touch_type || !content_summary) {
      res.status(400).json({ error: 'customer_id, touch_type, content_summary 为必填项' })
      return
    }

    const touchPoint = await tpService.createTouchPoint(getUserId(req as any), {
      customerId: customer_id,
      touchType: touch_type,
      contentSummary: content_summary,
      response,
    })
    res.status(201).json({ id: touchPoint.id })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('不能为空') || msg.includes('必须是') || msg.includes('不存在')) {
      res.status(400).json({ error: msg })
      return
    }
    res.status(500).json({ error: msg })
  }
})

export default router
