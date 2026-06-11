import { prisma } from '../../db.js'
import { getCollector } from './registry.js'
import { DEMO_USER_ID } from '../../constants.js'

interface CollectResult {
  total: number
  succeeded: number
  failed: number
  errors: Array<{ recordId: string; platform: string; platformVideoId: string; error: string }>
}

/**
 * 采集所有启用了 auto_collect 的发布记录的最新数据
 */
export async function collectAllEnabled(): Promise<CollectResult> {
  const enabled = await prisma.publishRecord.findMany({
    where: {
      autoCollect: true,
      status: 'published',
      platformVideoId: { not: null },
    },
    orderBy: { lastCollectedAt: 'asc' },
    take: 100,
    select: { id: true, platform: true, platformVideoId: true },
  })

  return collectRecords(enabled)
}

/**
 * 采集指定 PublishRecord 列表的数据
 */
export async function collectRecords(
  records: Array<{ id: string; platform: string; platformVideoId: string | null }>,
): Promise<CollectResult> {
  let succeeded = 0
  let failed = 0
  const errors: CollectResult['errors'] = []
  let total = 0

  for (const record of records) {
    if (!record.platformVideoId) continue

    const collector = getCollector(record.platform)
    if (!collector) {
      console.warn(`[DataCollect] 不支持的平台: ${record.platform}`)
      continue
    }

    total++
    try {
      const stats = await collector.fetchVideoStats(record.platformVideoId)

      await prisma.dataSnapshot.create({
        data: {
          userId: DEMO_USER_ID,
          publishRecordId: record.id,
          snapshotAt: new Date(),
          playCount: stats.playCount,
          completionRate: stats.completionRate ?? 0,
          threeSecondBounceRate: stats.threeSecondBounceRate ?? 0,
          commentCount: stats.commentCount ?? 0,
          privateMessageCount: stats.privateMessageCount ?? 0,
        },
      })

      await prisma.publishRecord.update({
        where: { id: record.id },
        data: { lastCollectedAt: new Date() },
      })

      succeeded++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      errors.push({
        recordId: record.id,
        platform: record.platform,
        platformVideoId: record.platformVideoId,
        error: errorMsg,
      })
      failed++
      console.error(`[DataCollect] 采集失败 ${record.platform}/${record.platformVideoId}:`, errorMsg)
    }
  }

  return { total, succeeded, failed, errors }
}
