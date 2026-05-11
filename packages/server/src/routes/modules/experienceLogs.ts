import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'

const router: Router = Router()

router.post('/experience-logs', async (req: Request, res: Response) => {
  try {
    const { task_id, week_number, biggest_surprise, biggest_mistake, next_hypothesis, tags } = req.body
    if (!task_id || !week_number || !biggest_surprise || !biggest_mistake || !next_hypothesis) {
      res.status(400).json({ error: 'task_id, week_number, biggest_surprise, biggest_mistake, next_hypothesis are required' })
      return
    }
    const log = await prisma.experienceLog.create({
      data: {
        userId: DEMO_USER_ID,
        taskId: task_id,
        weekNumber: week_number,
        biggestSurprise: biggest_surprise,
        biggestMistake: biggest_mistake,
        nextHypothesis: next_hypothesis,
        tags: tags ?? [],
      },
    })
    res.json({
      id: log.id,
      task_id: log.taskId,
      week_number: log.weekNumber,
      biggest_surprise: log.biggestSurprise,
      biggest_mistake: log.biggestMistake,
      next_hypothesis: log.nextHypothesis,
      tags: log.tags,
      created_at: log.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('[POST /experience-logs]', error)
    res.status(500).json({ error: 'Failed to create experience log' })
  }
})

export default router
