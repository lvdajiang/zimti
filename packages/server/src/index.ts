import express from 'express'
import cors from 'cors'
import { prisma } from './db.js'
import { errorHandler, notFoundHandler } from './middleware/index.js'
import { stubHeaderMiddleware } from './middleware/stubMarker.js'
import { router } from './routes/index.js'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors())
app.use(express.json())
app.use(stubHeaderMiddleware)

app.use('/api/v1', router)

app.use(notFoundHandler)
app.use(errorHandler)

async function main(): Promise<void> {
  try {
    await prisma.$connect()
    console.log('[DB] Connected')
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
