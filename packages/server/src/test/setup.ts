import express from 'express'
import cors from 'cors'
import { router } from '../routes/index.js'
import { errorHandler, notFoundHandler } from '../middleware/index.js'
import { stubHeaderMiddleware } from '../middleware/stubMarker.js'
import { prisma } from '../db.js'
import { DEMO_USER_ID } from '../constants.js'

export function createTestApp(): express.Application {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(stubHeaderMiddleware)
  app.use('/api/v1', router)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

export async function setupTestDb(): Promise<void> {
  await prisma.$connect()
  await ensureTestUser()
}

async function ensureTestUser(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } })
  if (!existing) {
    await prisma.user.create({ data: { id: DEMO_USER_ID, username: 'test' } })
  }
}

export async function cleanupTestDb(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      pending_items, notifications, experience_logs,
      video_metrics, data_snapshots, render_tasks, ai_tasks,
      video_materials, storyboard_segments,
      publish_records, video_products, scripts,
      materials, content_assets,
      viral_videos, collect_task_logs, collect_tasks,
      benchmark_accounts, keyword_trends, keyword_monitors,
      hotspots, topic_proposals, tasks, persona_configs
    CASCADE
  `)
  // TRUNCATE CASCADE 会删除 users 表中的 demo 用户，需重建
  await ensureTestUser()
}

export async function teardownTestDb(): Promise<void> {
  await prisma.$disconnect()
}
