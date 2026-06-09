/**
 * 桥接重试队列 — 失败操作的指数退避重试
 *
 * 职责：
 * - 将失败的桥接操作加入重试队列
 * - 定时扫描并重试（指数退避）
 * - 超过最大重试次数标记为 dead
 */

import { prisma } from '../db.js'
import { logger } from '../logger.js'

const BASE_DELAY_MS = 30_000  // 30 秒基础延迟
const MAX_DELAY_MS = 3_600_000 // 最大 1 小时

/**
 * 将失败操作加入重试队列
 */
export async function enqueueRetry(params: {
  syncLogId: string
  syncType: string
  direction: string
  payload: unknown
  maxRetries?: number
}): Promise<void> {
  const { syncLogId, syncType, direction, payload, maxRetries = 5 } = params

  await prisma.bridgeRetryQueue.create({
    data: {
      syncLogId,
      syncType,
      direction,
      payload: payload as object,
      maxRetries,
      nextRetryAt: new Date(Date.now() + BASE_DELAY_MS),
    },
  })

  logger.info(`桥接重试队列: ${syncType} 已加入，将在 30 秒后重试`)
}

/**
 * 处理重试队列 — 扫描到期的记录并重试
 * 由定时任务每分钟调用
 */
export async function processRetryQueue(): Promise<{
  retried: number
  succeeded: number
  dead: number
}> {
  const now = new Date()

  // 查找到期的待重试记录
  const pending = await prisma.bridgeRetryQueue.findMany({
    where: {
      status: 'pending',
      nextRetryAt: { lte: now },
    },
    take: 20,
    orderBy: { nextRetryAt: 'asc' },
  })

  let retried = 0
  let succeeded = 0
  let dead = 0

  for (const item of pending) {
    try {
      // 标记为重试中
      await prisma.bridgeRetryQueue.update({
        where: { id: item.id },
        data: { status: 'retrying' },
      })

      // 执行重试（根据 syncType 分派）
      await _executeRetry(item)

      // 成功 → 更新原同步日志
      await prisma.bridgeSyncLog.update({
        where: { id: item.syncLogId },
        data: { status: 'success' },
      })
      await prisma.bridgeRetryQueue.delete({ where: { id: item.id } })
      succeeded++
      logger.info(`桥接重试成功: ${item.syncType} (${item.syncLogId})`)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const newRetryCount = item.retryCount + 1

      if (newRetryCount >= item.maxRetries) {
        // 超过最大次数 → 标记为 dead
        await prisma.bridgeRetryQueue.update({
          where: { id: item.id },
          data: { status: 'dead', retryCount: newRetryCount, lastError: errorMsg },
        })
        await prisma.bridgeSyncLog.update({
          where: { id: item.syncLogId },
          data: { status: 'dead', errorMessage: `重试 ${newRetryCount} 次后仍失败: ${errorMsg}` },
        })
        dead++
        logger.error(`桥接重试死亡: ${item.syncType} (${item.syncLogId}), ${errorMsg}`)
      } else {
        // 继续重试 → 计算下次时间（指数退避）
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, newRetryCount), MAX_DELAY_MS)
        await prisma.bridgeRetryQueue.update({
          where: { id: item.id },
          data: {
            status: 'pending',
            retryCount: newRetryCount,
            nextRetryAt: new Date(Date.now() + delay),
            lastError: errorMsg,
          },
        })
        retried++
        logger.warn(`桥接重试失败(${newRetryCount}/${item.maxRetries}): ${item.syncType}, ${delay / 1000}s 后重试`)
      }
    }
  }

  if (retried + succeeded + dead > 0) {
    logger.info(`桥接重试队列: 重试=${retried}, 成功=${succeeded}, 死亡=${dead}`)
  }

  return { retried, succeeded, dead }
}

/**
 * 执行重试操作
 */
async function _executeRetry(item: {
  syncType: string
  direction: string
  payload: unknown
}): Promise<void> {
  const { syncType, direction, payload } = item
  const data = payload as Record<string, unknown>

  if (direction === 'outbound') {
    // 出站重试：重新调用智派 API
    const { zhiPaiClient } = await import('./client.js')

    switch (syncType) {
      case 'customer_sync': {
        const { zhiPaiClient: client } = await import('./client.js')
        await client.post('/tourists/', data)
        break
      }
      case 'quotation_create': {
        const { zhiPaiClient: client } = await import('./client.js')
        await client.post('/quotations/batch-create', data)
        break
      }
      case 'push_message': {
        const { zhiPaiClient: client } = await import('./client.js')
        await client.post('/fleet/messages/push', data)
        break
      }
      default:
        throw new Error(`未知的出站同步类型: ${syncType}`)
    }
  } else {
    // 入站重试：通过 _reconcileFailedEvents 重新处理，不在此处执行
    logger.info(`桥接重试: 入站事件 ${syncType} 将由对账模块处理`)
    return  // 不执行任何操作，由定时对账任务负责
  }
}

/**
 * 获取死信队列（供管理 API 使用）
 */
export async function getDeadLetterItems(limit = 50, offset = 0) {
  const [items, total] = await Promise.all([
    prisma.bridgeRetryQueue.findMany({
      where: { status: 'dead' },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.bridgeRetryQueue.count({ where: { status: 'dead' } }),
  ])
  return { items, total }
}

/**
 * 手动重试一条死信记录
 */
export async function retryDeadLetter(id: string): Promise<boolean> {
  const item = await prisma.bridgeRetryQueue.findUnique({ where: { id } })
  if (!item || item.status !== 'dead') return false

  // 重置为 pending
  await prisma.bridgeRetryQueue.update({
    where: { id },
    data: {
      status: 'pending',
      retryCount: 0,
      nextRetryAt: new Date(Date.now() + BASE_DELAY_MS),
      lastError: null,
    },
  })
  return true
}
