import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { join } from 'node:path'
import { prisma } from './db.js'
import { DEMO_USER_ID } from './constants.js'
import { errorHandler, notFoundHandler } from './middleware/index.js'
import { stubHeaderMiddleware } from './middleware/stubMarker.js'
import { router } from './routes/index.js'
import { setAIProvider } from './services/ai/index.js'
import { GLMProvider } from './services/ai/glmProvider.js'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors())
app.use(express.json())
app.use(stubHeaderMiddleware)
app.use('/uploads', express.static(join(process.cwd(), 'uploads')))

app.use('/api/v1', router)

app.use(notFoundHandler)
app.use(errorHandler)

function initAIProvider(): void {
  const apiKey = process.env.GLM_API_KEY
  const baseURL = process.env.GLM_BASE_URL
  const model = process.env.GLM_MODEL
  if (apiKey && baseURL) {
    setAIProvider(new GLMProvider(apiKey, baseURL, model))
    console.log(`[AI] GLM Provider initialized (model: ${model ?? 'default'})`)
  } else {
    console.warn('[AI] GLM_API_KEY/GLM_BASE_URL not set, using MockAIProvider')
  }
}

async function ensureDemoUser(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } })
  if (!existing) {
    await prisma.user.create({ data: { id: DEMO_USER_ID, username: 'demo' } })
    console.log('[DB] Created demo user')
  }
}

async function main(): Promise<void> {
  initAIProvider()

  try {
    await prisma.$connect()
    console.log('[DB] Connected')
    await ensureDemoUser()
  } catch {
    console.warn('[DB] Connection failed — running without database')
  }

  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error('[Fatal]', err)
  process.exit(1)
})
