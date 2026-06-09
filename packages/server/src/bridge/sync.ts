/**
 * 客户同步 — Zimti CRM客户 → 智派游客记录
 *
 * 触发时机：Zimti CRM创建客户后异步调用
 * 失败策略：只记日志不回滚（桥接失败不影响CRM主流程）
 */

import { zhiPaiClient } from './client.js'
import { customerToTourist } from './mappings.js'
import { prisma } from '../db.js'
import { logger } from '../logger.js'

interface CustomerData {
  id: string
  name: string
  phone: string | null
  wechat: string | null
  sourceType: string
  sourceRefId: string | null
  intentLevel: string
  stage: string
  travelIntent: unknown
  notes: string | null
}

/**
 * 将Zimti客户同步到智派游客表
 *
 * 1. 映射字段 → 调智派 POST /api/v1/tourists/
 * 2. 成功后回写 customer.sourceRefId = "zhipai:游客ID"
 * 3. 失败只记日志，不回滚CRM创建
 */
export async function syncCustomerToZhiPai(customer: CustomerData): Promise<void> {
  if (!zhiPaiClient.isEnabled()) {
    logger.info('桥接未启用，跳过客户同步')
    return
  }

  try {
    // 已同步过则跳过
    if (customer.sourceRefId?.startsWith('zhipai:')) {
      logger.info(`客户 ${customer.id} 已同步到智派(${customer.sourceRefId})，跳过`)
      return
    }

    const touristData = customerToTourist(customer as Parameters<typeof customerToTourist>[0])

    logger.info(`桥接同步：客户"${customer.name}"(${customer.id}) → 智派游客`)

    // 调智派 POST /api/v1/tourists/ 单条创建
    const result = await zhiPaiClient.post<{ tourist_id: string; name: string }>(
      '/tourists/',
      {
        name: touristData.name,
        phone: touristData.phone,
        gender: touristData.gender,
        age: touristData.age,
        tourist_type: touristData.tourist_type,
        group_id: touristData.group_id || undefined,
        source: touristData.source,
        arrival_time: touristData.arrival_time || undefined,
      },
    )

    // 回写智派游客编号到Zimti客户的sourceRefId
    if (result?.tourist_id) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { sourceRefId: `zhipai:${result.tourist_id}` },
      })
      logger.info(`桥接同步成功：客户${customer.id} → 智派游客${result.tourist_id}`)
    } else {
      logger.info(`桥接同步成功：客户${customer.id} 已推送到智派`)
    }

  } catch (err) {
    // 桥接失败只记日志，不影响CRM主流程
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`桥接同步失败：客户${customer.id} "${customer.name}" → ${msg}`)
  }
}
