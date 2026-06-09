/**
 * Correlation ID — 跨服务请求追踪
 *
 * 为每个桥接请求生成唯一 ID，通过 HTTP header 传递给智派，
 * 两端日志都包含此 ID，便于追踪完整的请求链路。
 */

import { randomUUID } from 'crypto'

/** 生成桥接 correlation ID */
export function generateCorrelationId(): string {
  return `bridge-${randomUUID()}`
}

/**
 * 在 AsyncLocalStorage 中维护当前请求的 correlation ID
 * 这样 bridge 模块的日志可以自动附加 correlation ID
 */
import { AsyncLocalStorage } from 'async_hooks'

interface BridgeContext {
  correlationId: string
}

export const bridgeContext = new AsyncLocalStorage<BridgeContext>()

/** 在 correlation context 中运行（由 bridge 入口调用） */
export function withCorrelation<T>(fn: () => Promise<T>): Promise<T> {
  const correlationId = generateCorrelationId()
  return bridgeContext.run({ correlationId }, fn)
}

/** 获取当前 correlation ID（可能为空） */
export function getCorrelationId(): string | undefined {
  return bridgeContext.getStore()?.correlationId
}
