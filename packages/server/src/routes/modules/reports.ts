import { Router } from 'express'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

router.get('/reports/weekly', (_req, res) => {
  markStub(res, '周报生成未实现')
  res.json({ message: 'reports/weekly — TODO' })
})

export default router
