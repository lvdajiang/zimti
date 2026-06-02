import { Router, Response } from 'express'
import multer from 'multer'
import { authMiddleware, type AuthenticatedRequest } from '../../services/auth/authService.js'
import * as analyzer from '../../services/groupChatAnalyzer.js'
import { toInt } from '../../constants.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

// POST /api/v1/group-chat/upload — 上传并分析群聊文件
router.post('/group-chat/upload', authMiddleware, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const file = req.file
    if (!file) {
      res.status(400).json({ error: '请上传文件' })
      return
    }

    // 支持 txt 和 csv 格式
    if (!file.mimetype?.includes('text') && !file.originalname.endsWith('.txt') && !file.originalname.endsWith('.csv')) {
      res.status(400).json({ error: '仅支持 txt 或 csv 格式文件' })
      return
    }

    const content = file.buffer.toString('utf-8')
    if (!content.trim()) {
      res.status(400).json({ error: '文件内容为空' })
      return
    }

    const groupName = req.body.group_name || file.originalname.replace(/\.(txt|csv)$/i, '')

    const result = await analyzer.analyzeGroupChat(
      userId,
      groupName,
      file.originalname,
      content
    )

    res.status(201).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '群聊分析失败'
    res.status(500).json({ error: message })
  }
})

// GET /api/v1/group-chat/analyses — 获取分析报告列表
router.get('/group-chat/analyses', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const page = toInt(req.query.page, 1)
    const limit = toInt(req.query.limit, 20)

    const result = await analyzer.getAnalyses(userId, page, limit)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取分析列表失败'
    res.status(500).json({ error: message })
  }
})

// GET /api/v1/group-chat/analyses/:id — 获取单条分析报告
router.get('/group-chat/analyses/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const result = await analyzer.getAnalysis(userId, req.params.id)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取分析报告失败'
    res.status(500).json({ error: message })
  }
})

export default router
