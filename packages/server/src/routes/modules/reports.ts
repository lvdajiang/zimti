import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID } from '../../constants.js'

const router: Router = Router()

router.get('/reports/weekly', async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const [tasksCompleted, videosPublished, metrics, experienceLog] = await Promise.all([
      prisma.task.count({
        where: { userId: DEMO_USER_ID, status: 'completed', updatedAt: { gte: weekStart, lte: weekEnd } },
      }),
      prisma.publishRecord.count({
        where: { createdAt: { gte: weekStart, lte: weekEnd } },
      }),
      prisma.videoMetric.aggregate({
        where: { date: { gte: weekStart, lte: weekEnd } },
        _sum: { playCount: true, likeCount: true, commentCount: true, collectCount: true },
      }),
      prisma.experienceLog.findFirst({
        where: { userId: DEMO_USER_ID, weekNumber: getWeekNumber(now) },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const totalPlays = Number(metrics._sum?.playCount ?? 0)
    const totalInteractions = Number(metrics._sum?.likeCount ?? 0) + Number(metrics._sum?.commentCount ?? 0) + Number(metrics._sum?.collectCount ?? 0)
    const interactionRate = totalPlays > 0 ? Math.round((totalInteractions / totalPlays) * 100 * 100) / 100 : 0

    res.json({
      week_number: getWeekNumber(now),
      start_date: weekStart.toISOString(),
      end_date: weekEnd.toISOString(),
      summary: {
        tasks_completed: tasksCompleted,
        videos_published: videosPublished,
        total_play_count: totalPlays,
        total_interactions: totalInteractions,
        interaction_rate: interactionRate,
      },
      experience_log: experienceLog ? {
        biggest_surprise: experienceLog.biggestSurprise,
        biggest_mistake: experienceLog.biggestMistake,
        next_hypothesis: experienceLog.nextHypothesis,
      } : null,
    })
  } catch (error) {
    console.error('[GET /reports/weekly]', error)
    res.status(500).json({ error: 'Failed to generate weekly report' })
  }
})

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - startOfYear.getTime()
  return Math.ceil((diff / (7 * 24 * 60 * 60 * 1000)) + 1)
}

export default router
