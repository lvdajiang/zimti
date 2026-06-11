/**
 * 简单令牌桶限速器
 *
 * 保护平台 API 不被过度请求。默认 3 req/s，B站未认证限制约 5 qps。
 */
let lastRequestTime = 0
const MIN_INTERVAL_MS = 350 // ~3 req/s

export async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now()
  const waitTime = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime))
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }
  lastRequestTime = Date.now()
  return fetch(url, options)
}
