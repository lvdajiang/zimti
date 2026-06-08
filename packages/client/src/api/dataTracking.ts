/**
 * 数据追踪 API — DataSnapshot + VideoMetric 前端封装
 */

import api from './client'
import type { MetricsTrendResponse } from '@zimti/shared'

/** 创建单条数据快照 */
export async function createSnapshot(data: {
  publish_record_id: string
  snapshot_at: string
  play_count: number
  completion_rate: number
  three_second_bounce_rate: number
  comment_count: number
  private_message_count: number
}) {
  const res = await api.post('/data-tracking/snapshots', data)
  return res as unknown as Record<string, unknown>
}

/** 批量创建快照 */
export async function createBatchSnapshots(
  snapshots: Array<{
    publish_record_id: string
    snapshot_at: string
    play_count: number
    completion_rate: number
    three_second_bounce_rate: number
    comment_count: number
    private_message_count: number
  }>,
) {
  const res = await api.post('/data-tracking/snapshots/batch', { snapshots })
  return res as unknown as { created: number }
}

/** 查询快照列表 */
export async function fetchSnapshots(params?: {
  publish_record_id?: string
  page?: number
  page_size?: number
}) {
  const query = new URLSearchParams()
  if (params?.publish_record_id) query.set('publish_record_id', params.publish_record_id)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  const res = await api.get(`/data-tracking/snapshots?${query.toString()}`)
  return res as unknown as { items: unknown[]; total: number }
}

/** 获取趋势数据 */
export async function fetchMetricsTrend(
  publishRecordId: string,
  days: number = 30,
): Promise<MetricsTrendResponse> {
  const res = await api.get(
    `/data-tracking/publish-records/${publishRecordId}/metrics-trend?days=${days}`,
  )
  return res as unknown as MetricsTrendResponse
}

/** 创建视频指标 */
export async function createVideoMetric(data: {
  video_id: string
  date: string
  play_count: number
  like_count: number
  comment_count: number
  collect_count: number
  interaction_rate?: number
}) {
  const res = await api.post('/data-tracking/video-metrics', data)
  return res as unknown as Record<string, unknown>
}
