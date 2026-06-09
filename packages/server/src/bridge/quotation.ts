/**
 * 报价桥接 — 从Zimti CRM客户创建智派报价单
 *
 * 流程：
 * 1. 查Zimti客户信息
 * 2. 按目的地+钻级匹配智派资源（住宿/餐饮/门票/车辆/导游）
 * 3. 按天组装行程明细 → 调智派 batch-create 创建报价
 * 4. 生成报价PNG图片
 * 5. 返回报价结果
 */

import { zhiPaiClient } from './client.js'
import { prisma } from '../db.js'
import { logger } from '../logger.js'
import { searchTemplateResources } from './productProxy.js'
import type { QuotationRequest, QuotationResult } from './mappings.js'

/** 按天组装行程明细时，每类资源的分配策略 */
const DAILY_RESOURCE_TYPES = [
  { type: '住宿', action: '住宿', perDay: 1 },
  { type: '餐饮', action: '午餐', perDay: 2 },    // 午餐+晚餐
  { type: '门票', action: '游览', perDay: 1 },
] as const

const SINGLE_RESOURCE_TYPES = [
  { type: '车辆', action: '用车', perTrip: true },
  { type: '导游', action: '导游', perTrip: true },
] as const

/**
 * 从CRM客户创建智派报价
 */
export async function createQuotationFromCustomer(params: QuotationRequest): Promise<QuotationResult> {
  // 1. 查客户信息
  const customer = await prisma.customer.findUnique({
    where: { id: params.customer_id },
  })
  if (!customer) {
    throw new Error('客户不存在')
  }

  logger.info(`桥接报价：为客户"${customer.name}"创建${params.destination}${params.days}天${params.people_count}人报价`)

  // 2. 按目的地+钻级匹配智派资源
  const allResources = await searchTemplateResources(
    params.destination,
    undefined,   // 不限类型，搜所有
    params.grade,
  )

  // 按资源类型分组
  const byType: Record<string, typeof allResources> = {}
  for (const r of allResources) {
    if (!byType[r.type]) byType[r.type] = []
    byType[r.type].push(r)
  }

  // 3. 按天组装行程明细
  const details: Array<Record<string, unknown>> = []

  for (let day = 1; day <= params.days; day++) {
    // 每天分配：住宿、餐饮、门票
    for (const { type, action, perDay } of DAILY_RESOURCE_TYPES) {
      const pool = byType[type] || []
      // 循环使用资源（第N天取第N个，超出则循环）
      for (let i = 0; i < perDay; i++) {
        const resource = pool[(day - 1 + i) % Math.max(pool.length, 1)]
        if (resource) {
          details.push({
            day_number: day,
            time: type === '住宿' ? '' : (type === '餐饮' ? (i === 0 ? '12:00' : '18:00') : '09:00'),
            action: type === '餐饮' ? (i === 0 ? '午餐' : '晚餐') : action,
            start_point: day === 1 && type === '门票' ? params.destination : '',
            end_point: type === '住宿' ? params.destination : '',
            resource_id: resource.resource_id,
            resource_name: resource.specification || resource.name,
            resource_type: type,
            adult_unit_price: resource.agreement_price,
            child_unit_price: Math.round(resource.agreement_price * 0.5),
            adult_count: params.people_count,
            child_count: 0,
            adult_negotiated_price: resource.agreement_price,
            child_negotiated_price: Math.round(resource.agreement_price * 0.5),
            amount: resource.agreement_price * params.people_count,
          })
        }
      }
    }
  }

  // 全程分配：车辆、导游
  for (const { type, action } of SINGLE_RESOURCE_TYPES) {
    const pool = byType[type] || []
    const resource = pool[0]  // 取第一个
    if (resource) {
      details.push({
        day_number: 1,
        time: '全天',
        action,
        start_point: params.destination,
        end_point: params.destination,
        resource_id: resource.resource_id,
        resource_name: resource.specification || resource.name,
        resource_type: type,
        adult_unit_price: resource.agreement_price,
        child_unit_price: 0,
        adult_count: params.days,   // 车辆按天计
        child_count: 0,
        adult_negotiated_price: resource.agreement_price,
        child_negotiated_price: 0,
        amount: resource.agreement_price * params.days,
      })
    }
  }

  // 如果没有匹配到任何资源，仍然创建一个空壳报价
  if (details.length === 0) {
    logger.warn(`桥接报价：未找到"${params.destination}"相关资源，创建空壳报价`)
    details.push({
      day_number: 1,
      time: '',
      action: '待安排',
      start_point: params.destination,
      end_point: params.destination,
      resource_id: '',
      resource_name: '待确认',
      resource_type: '其他',
      adult_unit_price: 0,
      child_unit_price: 0,
      adult_count: params.people_count,
      child_count: 0,
      adult_negotiated_price: 0,
      child_negotiated_price: 0,
      amount: 0,
      operation_notes: '资源待匹配，需手动调整',
    })
  }

  // 4. 调智派 batch-create 创建报价
  const productName = `${params.destination}${params.days}天游`
  const batchResult = await zhiPaiClient.post<{ message: string; quotation_id: string; detail_count: number }>(
    '/quotations/batch-create',
    {
      header: {
        product_name: productName,
        group_id: '',
        tour_date: params.tour_date,
        customer_name: customer.name,
        customer_phone: customer.phone || '00000000000',
        salesperson: 'Zimti桥接',
        notes: `来自自媒体CRM | 目的地:${params.destination} | ${params.days}天${params.people_count}人 | ${params.grade}`,
      },
      details,
    },
  )

  const quotationId = batchResult.quotation_id
  logger.info(`桥接报价：智派报价单${quotationId}已创建，${batchResult.detail_count}条明细`)

  // 5. 生成报价PNG图片
  let imageUrl: string | null = null
  try {
    const exportResult = await zhiPaiClient.post<{ download_url?: string; url?: string }>(
      '/export/quick-quotation-image',
      { quotation_id: quotationId },
    )
    imageUrl = exportResult.download_url || exportResult.url || null
  } catch (err) {
    logger.warn(`桥接报价：报价图片生成失败，${err instanceof Error ? err.message : err}`)
  }

  // 6. 查询报价汇总数据
  let totalPrice = 0
  let totalCost = 0
  let profitMargin = 0
  try {
    const quotationDetails = await zhiPaiClient.get<Array<{ total_price?: number; total_cost?: number; profit_margin?: number }>>(
      `/quotations/${quotationId}/details`,
    )
    if (Array.isArray(quotationDetails) && quotationDetails.length > 0) {
      totalPrice = Number(quotationDetails[0].total_price ?? 0)
      totalCost = Number(quotationDetails[0].total_cost ?? 0)
      profitMargin = Number(quotationDetails[0].profit_margin ?? 0)
    }
  } catch {
    // 查询失败不影响主流程
  }

  return {
    quotation_id: quotationId,
    total_price: totalPrice,
    total_cost: totalCost,
    profit_margin: profitMargin,
    image_url: imageUrl,
    details_count: batchResult.detail_count || details.length,
  }
}
