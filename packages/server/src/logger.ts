import { createWriteStream, existsSync, mkdirSync, statSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const LOG_DIR = join(process.cwd(), 'logs')
const LOG_FILE = join(LOG_DIR, 'server.log')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_BACKUPS = 5
const SERVICE_NAME = 'zimti'

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

/**
 * 获取当前 correlation ID（延迟导入避免循环依赖）
 */
function getCorrelationId(): string | undefined {
  try {
    // 动态导入，避免 bridge → logger → bridge 循环依赖
    const { getCorrelationId: getCid } = require('./bridge/correlation.js') as typeof import('./bridge/correlation.js')
    return getCid()
  } catch {
    return undefined
  }
}

/**
 * 文件日志：JSON 格式（机器可读，便于日志聚合）
 */
function writeJson(level: string, ...args: unknown[]): void {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    message: args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
  }
  const correlationId = getCorrelationId()
  if (correlationId) {
    entry.correlation_id = correlationId
  }
  logStream.write(JSON.stringify(entry) + '\n')
}

/**
 * 控制台日志：可读格式（人类友好）
 */
function writeConsole(level: string, ...args: unknown[]): void {
  const prefix = getCorrelationId() ? `[${getCorrelationId()!.slice(0, 12)}] ` : ''
  const output = `${prefix}${args.join(' ')}`
  switch (level) {
    case 'ERROR': console.error(output); break
    case 'WARN': console.warn(output); break
    default: console.log(output)
  }
}

export const logger = {
  info: (...args: unknown[]) => {
    writeJson('INFO', ...args)
    writeConsole('INFO', ...args)
  },
  warn: (...args: unknown[]) => {
    writeJson('WARN', ...args)
    writeConsole('WARN', ...args)
  },
  error: (...args: unknown[]) => {
    writeJson('ERROR', ...args)
    writeConsole('ERROR', ...args)
  },
}

export function setupLogger(): void {
  // 降低第三方库日志级别
  process.env.DEBUG = ''
}
