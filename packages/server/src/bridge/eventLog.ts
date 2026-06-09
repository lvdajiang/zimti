/**
 * 桥接事件日志 — Webhook 接收记录 + 去重
 *
 * 职责：记录每个 webhook 事件，通过 eventId 去重，防止重复处理
 */

import { prisma } from '../db.js'
import { logger } from '../logger.js'

/**
 * 记录并检查 webhook 事件是否已处理
 * @returns true = 新事件应处理, false = 重复事件应跳过
 */
export async function recordWebhookEvent(params: {
  eventId?: string
  eventType: string
  refId: string
  payload: unknown
  signature?: string
}): Promise<{ shouldProcess: boolean; logId: string }> {
  const { eventId, eventType, refId, payload, signature } = params

  // 如果有 eventId，检查是否已存在
  if (eventId) {
    const existing = await prisma.webhookEvent.findUnique({
      where: { eventId },
    })
    if (existing) {
      logger.info(`桥接Webhook去重: ${eventType} eventId=${eventId} 已处理(${existing.status})`)
      return { shouldProcess: false, logId: existing.id }
    }
  }

  // 创建新记录
  const event = await prisma.webhookEvent.create({
    data: {
      eventId: eventId || null,
      eventType,
      refId,
      payload: payload as object,
      signature: signature || null,
      status: 'received',
    },
  })

  return { shouldProcess: true, logId: event.id }
}

/**
 * 标记事件处理成功
 */
export async function markEventProcessed(logId: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id: logId },
    data: { status: 'processed', processedAt: new Date() },
  })
}

/**
 * 标记事件处理失败
 */
export async function markEventFailed(logId: string, error: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id: logId },
    data: { status: 'failed', errorMessage: error },
  })
}

/**
 * 查询最近失败的事件（用于对账重处理）
 */
export async function getRecentFailedEvents(hours = 24): Promise<Array<{
  id: string
  eventType: string
  refId: string
  payload: unknown
  errorMessage: string | null
  createdAt: Date
}>> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
  return prisma.webhookEvent.findMany({
    where: {
      status: 'failed',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}
