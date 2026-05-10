import { Router } from 'express'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

// GET /api/v1/notifications/unread-count
router.get('/notifications/unread-count', (_req, res) => {
  markStub(res, '通知系统未接入')
  res.json({ count: 0 })
})

export default router
