import { Router } from 'express'

const router = Router()

// GET /api/v1/users/me
router.get('/users/me', (_req, res) => {
  res.json({ message: 'users/me — TODO' })
})

export default router
