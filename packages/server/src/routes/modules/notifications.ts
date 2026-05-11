import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'

const router: Router = Router()

router.get('/notifications/unread-count', async (_req: Request, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: DEMO_USER_ID, isRead: false },
    })
    res.json({ count })
  } catch (error) {
    console.error('[GET /notifications/unread-count]', error)
    res.status(500).json({ error: 'Failed to get unread count' })
  }
})

export default router
