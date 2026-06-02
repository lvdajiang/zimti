import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import { randomBytes, scryptSync } from 'crypto'
import { router } from '../routes/index.js'
import { errorHandler, notFoundHandler } from '../middleware/index.js'
import { stubHeaderMiddleware } from '../middleware/stubMarker.js'
import { prisma } from '../db.js'
import { DEMO_USER_ID } from '../constants.js'

const SCRYPT_KEYLEN = 64
function hashTestPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${derived}`
}

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
    await prisma.user.create({
      data: { id: DEMO_USER_ID, username: 'test', passwordHash: hashTestPassword('demo123') },
    })
  }
}

export async function cleanupTestDb(): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
          users,
          pending_items, notifications, experience_logs,
          video_metrics, data_snapshots, render_tasks, ai_tasks,
          video_materials, storyboard_segments,
          publish_records, video_products, scripts,
          materials, content_assets,
          viral_videos, collect_task_logs, collect_tasks,
          benchmark_accounts, keyword_trends, keyword_monitors,
          hotspots, topic_proposals, tasks, persona_configs,
          customer_tags, customer_stage_logs, follow_up_reminders,
          chat_templates, customers,
          moments_contents, group_contents,
          pipeline_jobs, pipeline_templates, industry_templates,
          brand_memories, evolution_logs,
          subscriptions, entities, resources,
          knowledge_items, ai_studio_projects, ai_studio_assets
        CASCADE
      `)
      await ensureTestUser()
      return
    } catch (err: any) {
      if (attempt === 2 || !err?.message?.includes('40P01')) throw err
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
    }
  }
}

export async function teardownTestDb(): Promise<void> {
  await prisma.$disconnect()
}
