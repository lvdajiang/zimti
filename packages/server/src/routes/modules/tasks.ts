import { Router } from 'express'
import { markStub } from '../../middleware/stubMarker.js'

const router = Router()

router.get('/tasks', (_req, res) => {
  markStub(res, '任务列表未实现')
  res.json({ message: 'tasks/list — TODO' })
})
router.post('/tasks', (_req, res) => {
  markStub(res, '创建任务未实现')
  res.json({ message: 'tasks/create — TODO' })
})
router.put('/tasks/:taskId/conversion-goal', (_req, res) => {
  markStub(res, '转化目标未实现')
  res.json({ message: 'tasks/conversion-goal — TODO' })
})
router.post('/tasks/:taskId/import-instructions', (_req, res) => {
  markStub(res, '导入说明未实现')
  res.json({ message: 'tasks/import-instructions — TODO' })
})
router.post('/tasks/:taskId/import-experience', (_req, res) => {
  markStub(res, '导入经验未实现')
  res.json({ message: 'tasks/import-experience — TODO' })
})

export default router
