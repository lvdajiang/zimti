/**
 * 熔断器 — 保护 Zimti 不被智派 API 故障拖垮
 *
 * 三态：
 * - CLOSED（正常）: 请求正常发送
 * - OPEN（熔断）: 连续失败超过阈值，直接拒绝请求
 * - HALF_OPEN（探测）: 等待超时后，发送一次探测请求
 *
 * 参数：
 * - failureThreshold: 连续失败多少次触发熔断（默认 5）
 * - resetTimeout: 熔断多久后尝试恢复（默认 60 秒）
 */

import { logger } from '../logger.js'

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly state: CircuitState) {
    super(`熔断器已打开（${state}），拒绝请求`)
    this.name = 'CircuitBreakerOpenError'
  }
}

interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  onStateChange?: (from: CircuitState, to: CircuitState) => void
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private readonly config: CircuitBreakerConfig

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      resetTimeout: config?.resetTimeout ?? 60_000,
      onStateChange: config?.onStateChange,
    }
  }

  /** 检查熔断器是否允许请求通过 */
  isOpen(): boolean {
    if (this.state === 'CLOSED') return false

    if (this.state === 'OPEN') {
      // 检查是否超过恢复时间
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this._transition('HALF_OPEN')
        return false // 允许探测请求
      }
      return true
    }

    // HALF_OPEN 状态允许一个请求通过
    return false
  }

  /** 获取当前状态 */
  getState(): CircuitState {
    return this.state
  }

  /** 记录成功 — 重置计数器 */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this._transition('CLOSED')
      logger.info('熔断器: HALF_OPEN → CLOSED（探测成功，恢复正常）')
    }
    this.failureCount = 0
  }

  /** 记录失败 — 增加计数器，可能触发熔断 */
  recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF_OPEN') {
      // 探测失败 → 立即回到 OPEN
      this._transition('OPEN')
      logger.warn('熔断器: HALF_OPEN → OPEN（探测失败）')
      return
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this._transition('OPEN')
      logger.warn(`熔断器: CLOSED → OPEN（连续 ${this.failureCount} 次失败）`)
    }
  }

  /** 获取状态信息（供 health API 使用） */
  getInfo(): {
    state: CircuitState
    failureCount: number
    lastFailureTime: number
    resetTimeout: number
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      resetTimeout: this.config.resetTimeout,
    }
  }

  /** 强制重置（用于测试或手动恢复） */
  reset(): void {
    this.failureCount = 0
    this._transition('CLOSED')
  }

  private _transition(newState: CircuitState): void {
    const oldState = this.state
    if (oldState === newState) return
    this.state = newState
    this.config.onStateChange?.(oldState, newState)
  }
}

/** 全局智派 API 熔断器 */
export const zhiPaiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60_000,
  onStateChange: (from, to) => {
    logger.info(`熔断器状态变更: ${from} → ${to}`)
  },
})
