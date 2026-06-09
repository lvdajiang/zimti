/**
 * 产品/资源只读代理 — 转发智派API查询，返回精简数据
 *
 * 用途：Zimti生成内容时查询智派真实产品/资源数据
 */

import { zhiPaiClient } from './client.js'

/** 精简版资源信息（返回给Zimti前端） */
export interface SimpleResource {
  resource_id: string
  name: string
  entity_name: string
  type: string
  grade: string
  specification: string
  agreement_price: number
  retail_price: number | null
  unit: string
  season: string
  status: string
}

/** 精简版季节价格 */
export interface SimpleSeasonPrice {
  id: number
  season_name: string
  season_type: string
  start_date: string | null
  end_date: string | null
  price: number
}

/** 精简版产品信息 */
export interface SimpleProduct {
  product_id: string
  product_name: string
  days: number
  suggested_price: number | null
  positioning: string
  itinerary: Array<{
    day: number
    start_point: string
    end_point: string
    action: string
    description: string
  }>
}

/**
 * 搜索智派资源
 * 转发 GET /api/v1/resources/ 并精简返回
 */
export async function searchResources(
  keyword?: string,
  type?: string,
  grade?: string,
  limit = 50,
): Promise<{ items: SimpleResource[]; total: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = { limit }
  if (keyword) params.keyword = keyword
  if (type) params.resource_type = type
  if (grade) params.resource_grade = grade

  const result = await zhiPaiClient.get<{ items?: unknown[]; total?: number } | unknown[]>(
    '/resources/',
    params,
  )

  // 智派返回的是带 X-Total-Count header 的列表，body 是数组
  const items = Array.isArray(result) ? result : (result as { items?: unknown[] }).items || []
  const total = Array.isArray(result) ? result.length : ((result as { total?: number }).total ?? items.length)

  // 精简字段
  const simplified: SimpleResource[] = items.map((r: unknown) => {
    const res = r as Record<string, unknown>
    return {
      resource_id: String(res.resource_id ?? ''),
      name: String(res.entity_name ?? res.specification ?? ''),
      entity_name: String(res.entity_name ?? ''),
      type: String(res.resource_type ?? ''),
      grade: String(res.resource_grade ?? ''),
      specification: String(res.specification ?? ''),
      agreement_price: Number(res.agreement_price ?? 0),
      retail_price: res.retail_price != null ? Number(res.retail_price) : null,
      unit: String(res.unit ?? ''),
      season: String(res.season ?? ''),
      status: String(res.status ?? ''),
    }
  })

  return { items: simplified, total }
}

/**
 * 获取资源的季节价格
 * 转发 GET /api/v1/resources/{resourceId}/season-prices
 */
export async function getSeasonPrices(resourceId: string): Promise<SimpleSeasonPrice[]> {
  const result = await zhiPaiClient.get<unknown[]>(
    `/resources/${resourceId}/season-prices`,
  )

  if (!Array.isArray(result)) return []

  return result.map((r: unknown) => {
    const p = r as Record<string, unknown>
    return {
      id: Number(p.id ?? 0),
      season_name: String(p.season_name ?? ''),
      season_type: String(p.season_type ?? ''),
      start_date: p.start_date ? String(p.start_date) : null,
      end_date: p.end_date ? String(p.end_date) : null,
      price: Number(p.price ?? 0),
    }
  })
}

/**
 * 搜索智派产品模板
 * 转发 GET /api/v1/resources/search-template
 */
export async function searchTemplateResources(
  keyword: string,
  type?: string,
  grade?: string,
): Promise<SimpleResource[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = { keyword }
  if (type) params.resource_type = type
  if (grade) params.resource_grade = grade

  const result = await zhiPaiClient.get<unknown[]>(
    '/resources/search-template',
    params,
  )

  if (!Array.isArray(result)) return []

  return result.map((r: unknown) => {
    const res = r as Record<string, unknown>
    return {
      resource_id: String(res.resource_id ?? ''),
      name: String(res.entity_name ?? res.specification ?? ''),
      entity_name: String(res.entity_name ?? ''),
      type: String(res.resource_type ?? ''),
      grade: String(res.resource_grade ?? ''),
      specification: String(res.specification ?? ''),
      agreement_price: Number(res.agreement_price ?? 0),
      retail_price: res.retail_price != null ? Number(res.retail_price) : null,
      unit: String(res.unit ?? ''),
      season: String(res.season ?? ''),
      status: String(res.status ?? ''),
    }
  })
}
