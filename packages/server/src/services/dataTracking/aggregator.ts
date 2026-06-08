/**
 * 数据追踪聚合器 — DataSnapshot 聚合查询 + 趋势统计
 *
 * 查询发布记录的数据快照，计算播放量趋势、完播率均值等统计指标。
 */

import { prisma } from '../../db.js'

export interface MetricsTrendPoint {
  snapshot_at: string
  play_count: number
  completion_rate: number
  three_second_bounce_rate: number
  comment_count: number
  private_message_count: number
}

export interface MetricsTrendSummary {
  total_plays: number
  avg_completion_rate: number
  avg_bounce_rate: number
  total_comments: number
  total_messages: number
  plays_trend: number | null
  snapshot_count: number
}

export interface MetricsTrendResponse {
  publish_record_id: string
  platform: string
  snapshots: MetricsTrendPoint[]
  summary: MetricsTrendSummary
}

export async function getMetricsTrend(
  publishRecordId: string,
  days: number = 30,
): Promise<MetricsTrendResponse> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // 查询发布记录信息
  const record = await prisma.publishRecord.findUnique({
    where: { id: publishRecordId },
    select: { platform: true },
  })

  // 查询时间范围内的快照
  const snapshots = await prisma.dataSnapshot.findMany({
    where: {
      publishRecordId,
      snapshotAt: { gte: since },
    },
    orderBy: { snapshotAt: 'asc' },
  })

  // 转换为前端格式
  const points: MetricsTrendPoint[] = snapshots.map(s => ({
    snapshot_at: s.snapshotAt.toISOString(),
    play_count: s.playCount,
    completion_rate: Number(s.completionRate),
    three_second_bounce_rate: Number(s.threeSecondBounceRate),
    comment_count: s.commentCount,
    private_message_count: s.privateMessageCount,
  }))

  // 计算摘要
  const summary = computeSummary(points)

  return {
    publish_record_id: publishRecordId,
    platform: record?.platform ?? 'unknown',
    snapshots: points,
    summary,
  }
}

function computeSummary(
  points: MetricsTrendPoint[],
): MetricsTrendSummary {
  if (points.length === 0) {
    return {
      total_plays: 0,
      avg_completion_rate: 0,
      avg_bounce_rate: 0,
      total_comments: 0,
      total_messages: 0,
      plays_trend: null,
      snapshot_count: 0,
    }
  }

  const total_plays = points.reduce((sum, p) => sum + p.play_count, 0)
  const avg_completion_rate = points.reduce((sum, p) => sum + p.completion_rate, 0) / points.length
  const avg_bounce_rate = points.reduce((sum, p) => sum + p.three_second_bounce_rate, 0) / points.length
  const total_comments = points.reduce((sum, p) => sum + p.comment_count, 0)
  const total_messages = points.reduce((sum, p) => sum + p.private_message_count, 0)

  // 计算趋势：比较前后半段播放量变化
  let plays_trend: number | null = null
  if (points.length >= 2) {
    const mid = Math.floor(points.length / 2)
    const firstHalf = points.slice(0, mid)
    const secondHalf = points.slice(mid)
    const firstAvg = firstHalf.reduce((s, p) => s + p.play_count, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((s, p) => s + p.play_count, 0) / secondHalf.length
    if (firstAvg > 0) {
      plays_trend = Math.round(((secondAvg - firstAvg) / firstAvg) * 100)
    }
  }

  return {
    total_plays,
    avg_completion_rate: Math.round(avg_completion_rate * 100) / 100,
    avg_bounce_rate: Math.round(avg_bounce_rate * 100) / 100,
    total_comments,
    total_messages,
    plays_trend,
    snapshot_count: points.length,
  }
}
