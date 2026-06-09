/**
 * 智派API客户端 — 桥接层认证与请求封装
 *
 * 职责：JWT认证（登录/自动刷新）、HTTP请求封装（Bearer Header、超时、重试、熔断器）
 * 环境变量：ZHIPAI_API_URL, ZHIPAI_USERNAME, ZHIPAI_PASSWORD
 */

import { logger } from '../logger.js'
import { zhiPaiCircuitBreaker, CircuitBreakerOpenError } from './circuitBreaker.js'

/** 智派API响应中的登录结果 */
interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

/** 通用API错误 */
export class ZhiPaiApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`智派API错误(${status}): ${detail}`)
    this.name = 'ZhiPaiApiError'
  }
}

class ZhiPaiClient {
  private token: string | null = null
  private tokenExpiry = 0
  private baseUrl: string
  private username: string
  private password: string
  private enabled: boolean

  constructor() {
    this.baseUrl = process.env.ZHIPAI_API_URL || ''
    this.username = process.env.ZHIPAI_USERNAME || ''
    this.password = process.env.ZHIPAI_PASSWORD || ''
    this.enabled = process.env.ZHIPAI_SYNC_ENABLED !== 'false' && !!this.baseUrl

    if (!this.enabled) {
      logger.info('桥接模块未启用（ZHIPAI_SYNC_ENABLED=false 或 ZHIPAI_API_URL 缺失）')
    }
  }

  /** 桥接是否已启用 */
  isEnabled(): boolean {
    return this.enabled
  }

  /** 确保有有效token，过期则重新登录 */
  async ensureToken(): Promise<string> {
    // 提前60秒刷新，避免边界情况
    if (this.token && Date.now() < this.tokenExpiry - 60_000) {
      return this.token
    }

    if (!this.baseUrl || !this.username) {
      throw new Error('智派桥接未配置（缺少 ZHIPAI_API_URL 或 ZHIPAI_USERNAME）')
    }

    const loginUrl = `${this.baseUrl}/auth/login`
    logger.info(`智派桥接：正在登录 ${this.username} ...`)

    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`智派登录失败(${res.status}): ${text}`)
    }

    const data = (await res.json()) as LoginResponse
    this.token = data.access_token
    this.tokenExpiry = Date.now() + data.expires_in * 1000
    logger.info('智派桥接：登录成功')
    return this.token
  }

  /**
   * 发送请求到智派API
   * 自动附加Bearer Header，失败重试1次
   * 支持幂等键（避免重复请求）
   */
  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options?: { timeout?: number; idempotencyKey?: string },
  ): Promise<T> {
    if (!this.enabled) {
      throw new Error('智派桥接未启用')
    }

    // 幂等键检查：如果之前已成功执行，直接返回缓存结果
    const idempotencyKey = options?.idempotencyKey
    if (idempotencyKey) {
      const { prisma: db } = await import('../db.js')
      const cached = await db.bridgeSyncLog.findUnique({
        where: { idempotencyKey },
      })
      if (cached?.status === 'success' && cached.responseBody) {
        logger.info(`桥接幂等命中: ${idempotencyKey}`)
        return cached.responseBody as T
      }
    }

    // 熔断器检查：OPEN 时直接拒绝
    if (zhiPaiCircuitBreaker.isOpen()) {
      throw new CircuitBreakerOpenError(zhiPaiCircuitBreaker.getState())
    }

    const timeout = options?.timeout ?? 30_000
    const url = `${this.baseUrl}${path}`

    // 附加 Correlation ID header（跨服务追踪）
    const { getCorrelationId } = await import('./correlation.js')
    const correlationId = getCorrelationId()

    // 最多重试1次（token过期后重新登录再试）
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.ensureToken()

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
      if (correlationId) {
        headers['X-Correlation-ID'] = correlationId
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(timeout),
      }

      if (body !== undefined && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body)
      }

      try {
        const res = await fetch(url, fetchOptions)

        // Token过期 → 重新登录后重试
        if (res.status === 401 && attempt === 0) {
          logger.warn('智派桥接：token过期，重新登录')
          this.token = null
          this.tokenExpiry = 0
          continue
        }

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new ZhiPaiApiError(res.status, text)
        }

        // 204 No Content
        if (res.status === 204) return undefined as T

        zhiPaiCircuitBreaker.recordSuccess()
        return (await res.json()) as T
      } catch (err) {
        if (err instanceof ZhiPaiApiError) {
          zhiPaiCircuitBreaker.recordFailure()
          throw err
        }
        if (attempt === 1) throw err
        // 网络错误，重试一次
        logger.warn(`智派桥接：请求失败，重试中... ${err instanceof Error ? err.message : err}`)
      }
    }

    throw new Error('智派桥接：请求失败（已重试）')
  }

  /** GET 请求快捷方法 */
  async get<T = unknown>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    let url = path
    if (params) {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
      if (qs) url += `?${qs}`
    }
    return this.request<T>('GET', url)
  }

  /** POST 请求快捷方法 */
  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  /** PUT 请求快捷方法 */
  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body)
  }
}

/** 全局单例 */
export const zhiPaiClient = new ZhiPaiClient()
