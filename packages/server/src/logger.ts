import { createWriteStream, existsSync, mkdirSync, statSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const LOG_DIR = join(process.cwd(), 'logs')
const LOG_FILE = join(LOG_DIR, 'server.log')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_BACKUPS = 5

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })

function rotateIfNeeded(): void {
  if (!existsSync(LOG_FILE)) return
  try {
    const stat = statSync(LOG_FILE)
    if (stat.size < MAX_SIZE) return
    for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
      const src = join(LOG_DIR, `server.log.${i}`)
      const dst = join(LOG_DIR, `server.log.${i + 1}`)
      if (existsSync(src)) renameSync(src, dst)
    }
    renameSync(LOG_FILE, join(LOG_DIR, 'server.log.1'))
  } catch {
    // 轮转失败不影响主流程
  }
}

rotateIfNeeded()

const logStream = createWriteStream(LOG_FILE, { flags: 'a', encoding: 'utf-8' })

function write(level: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString()
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
  const line = `${timestamp} [${level}] ${msg}\n`
  logStream.write(line)
}

export const logger = {
  info: (...args: unknown[]) => {
    write('INFO', ...args)
    console.log(...args)
  },
  warn: (...args: unknown[]) => {
    write('WARN', ...args)
    console.warn(...args)
  },
  error: (...args: unknown[]) => {
    write('ERROR', ...args)
    console.error(...args)
  },
}

export function setupLogger(): void {
  // 降低第三方库日志级别
  process.env.DEBUG = ''
}
