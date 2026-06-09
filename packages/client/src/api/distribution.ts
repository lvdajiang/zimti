/**
 * 全渠道分发 API
 */

import api from './client'
import type { Platform, DistributionStatus, DistributionRecord, DistributionTemplateRecord } from '@zimti/shared'

// --- 分发记录 ---

export async function fetchDistributionRecords(params?: {
  platform?: string
  status?: string
  source_type?: string
  page?: number
  page_size?: number
}): Promise<{ items: DistributionRecord[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.platform && params.platform !== 'all') query.set('platform', params.platform)
  if (params?.status && params.status !== 'all') query.set('status', params.status)
  if (params?.source_type) query.set('source_type', params.source_type)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/distribution/records?${query}`) as unknown as Promise<{ items: DistributionRecord[]; total: number }>
}

export async function createDistributionRecord(data: {
  source_content_id: string
  source_type: string
  platform: Platform
  adapted_title?: string
  adapted_content?: string
  adapted_tags?: string[]
}): Promise<DistributionRecord> {
  return api.post('/distribution/records', data) as unknown as Promise<DistributionRecord>
}

export async function updateDistributionRecord(id: string, data: {
  adapted_title?: string
  adapted_content?: string
  adapted_tags?: string[]
  status?: DistributionStatus
}): Promise<DistributionRecord> {
  return api.put(`/distribution/records/${id}`, data) as unknown as Promise<DistributionRecord>
}

export async function deleteDistributionRecord(id: string): Promise<{ ok: boolean }> {
  return api.delete(`/distribution/records/${id}`) as unknown as Promise<{ ok: boolean }>
}

// --- AI 内容适配 ---

export async function adaptContent(data: {
  source_title: string
  source_content: string
  source_tags?: string[]
  target_platform: Platform
  brand_context?: string
}): Promise<{ task_id: string; status: string }> {
  return api.post('/distribution/adapt', data) as unknown as Promise<{ task_id: string; status: string }>
}

export async function getAdaptStatus(taskId: string): Promise<{ task_id: string; status: string; output: unknown }> {
  return api.get(`/distribution/adapt/${taskId}/status`) as unknown as Promise<{ task_id: string; status: string; output: unknown }>
}

export async function batchAdaptContent(data: {
  source_title: string
  source_content: string
  source_tags?: string[]
  platforms: Platform[]
  brand_context?: string
  source_content_id?: string
  source_type?: string
}): Promise<{ task_id: string; status: string }> {
  return api.post('/distribution/batch-adapt', data) as unknown as Promise<{ task_id: string; status: string }>
}

export async function getBatchAdaptStatus(taskId: string): Promise<{ task_id: string; status: string; output: unknown }> {
  return api.get(`/distribution/batch-adapt/${taskId}/status`) as unknown as Promise<{ task_id: string; status: string; output: unknown }>
}

// --- 分发模板 ---

export async function fetchDistributionTemplates(params?: {
  platform?: string
}): Promise<{ items: DistributionTemplateRecord[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.platform) query.set('platform', params.platform)
  return api.get(`/distribution/templates?${query}`) as unknown as Promise<{ items: DistributionTemplateRecord[]; total: number }>
}

export async function createDistributionTemplate(data: {
  platform: Platform
  name: string
  content_template?: string
  max_length?: number
  tag_limit?: number
  hashtag_format?: string
  optimal_times?: string[]
}): Promise<DistributionTemplateRecord> {
  return api.post('/distribution/templates', data) as unknown as Promise<DistributionTemplateRecord>
}

// --- 日历 + 排期 + 发布 ---

export async function fetchDistributionCalendar(params?: {
  from?: string
  to?: string
}): Promise<{ items: DistributionRecord[] }> {
  const query = new URLSearchParams()
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)
  return api.get(`/distribution/calendar?${query}`) as unknown as Promise<{ items: DistributionRecord[] }>
}

export async function scheduleDistribution(id: string, scheduled_at: string): Promise<DistributionRecord> {
  return api.post(`/distribution/records/${id}/schedule`, { scheduled_at }) as unknown as Promise<DistributionRecord>
}

export async function publishDistribution(id: string, publish_url?: string): Promise<DistributionRecord> {
  return api.post(`/distribution/records/${id}/publish`, { publish_url }) as unknown as Promise<DistributionRecord>
}

// --- 分析 ---

export async function fetchDistributionAnalytics(): Promise<{
  by_platform: Array<{ platform: string; count: number }>
  by_status: Array<{ status: string; count: number }>
  recent_published: DistributionRecord[]
}> {
  return api.get('/distribution/analytics') as unknown as Promise<{
    by_platform: Array<{ platform: string; count: number }>
    by_status: Array<{ status: string; count: number }>
    recent_published: DistributionRecord[]
  }>
}

// --- 平台配置 ---

export async function fetchPlatformConfigs(): Promise<{
  configs: Array<{ platform: Platform; name: string; maxLength: number; tagLimit: number; optimalTimes: string[] }>
}> {
  return api.get('/distribution/platform-configs') as unknown as Promise<{ configs: Array<{ platform: Platform; name: string; maxLength: number; tagLimit: number; optimalTimes: string[] }> }>
}
