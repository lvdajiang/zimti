import { Router } from 'express'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

router.post('/experience-logs', (_req, res) => {
  markStub(res, '经验日志创建未实现')
  res.json({ message: 'experience-logs/create — TODO' })
})

export default router
