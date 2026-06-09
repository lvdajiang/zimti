/**
 * 桥接API — Zimti前端调智派桥接端点
 */

import api from './client'

/** 报价请求参数 */
export interface BridgeQuotationRequest {
  customer_id: string
  destination: string
  days: number
  people_count: number
  grade: string
  tour_date: string
}

/** 报价结果 */
export interface BridgeQuotationResult {
  quotation_id: string
  total_price: number
  total_cost: number
  profit_margin: number
  image_url: string | null
  details_count: number
}

/** 精简版资源 */
export interface BridgeResource {
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

/** 创建报价 */
export async function createQuotation(params: BridgeQuotationRequest): Promise<BridgeQuotationResult> {
  return api.post('/bridge/quotation', params) as Promise<BridgeQuotationResult>
}

/** 查询智派资源 */
export async function searchResources(keyword?: string, type?: string, grade?: string): Promise<{ items: BridgeResource[]; total: number }> {
  return api.get('/bridge/resources', { params: { keyword, type, grade } }) as Promise<{ items: BridgeResource[]; total: number }>
}

/** 查询季节价格 */
export async function getSeasonPrices(resourceId: string): Promise<{ items: unknown[] }> {
  return api.get('/bridge/prices', { params: { resource_id: resourceId } }) as Promise<{ items: unknown[] }>
}
