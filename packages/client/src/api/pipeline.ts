import api from './client'
import type { PipelineMode, PipelineJobStatus } from '@zimti/shared'

// --- 类型定义 ---

export interface PipelineJob {
  id: string
  mode: PipelineMode
  status: PipelineJobStatus
  input: unknown
  output: unknown
  error: string | null
  created_at: string
  updated_at: string
}

export interface DailyStatus {
  today_jobs: PipelineJob[]
  has_run_today: boolean
}

// --- 流水线触发 ---

export async function createViralRemindJob(data: {
  video_url?: string
  video_text?: string
}): Promise<{ id: string; status: string }> {
  return api.post('/pipeline/viral-remind', data) as unknown as Promise<{ id: string; status: string }>
}

export async function createHotspotRushJob(data: {
  hotspot_title: string
  hotspot_desc?: string
}): Promise<{ id: string; status: string }> {
  return api.post('/pipeline/hotspot-rush', data) as unknown as Promise<{ id: string; status: string }>
}

export async function createCustomerQuestionJob(data: {
  question: string
  customer_ids?: string[]
}): Promise<{ id: string; status: string }> {
  return api.post('/pipeline/customer-question', data) as unknown as Promise<{ id: string; status: string }>
}

// --- 状态查询 ---

export async function fetchDailyStatus(): Promise<DailyStatus> {
  return api.get('/pipeline/daily-status') as unknown as Promise<DailyStatus>
}

export async function fetchPipelineJobs(params?: {
  mode?: PipelineMode
  status?: PipelineJobStatus
  page?: number
  page_size?: number
}): Promise<{ items: PipelineJob[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.mode) query.set('mode', params.mode)
  if (params?.status) query.set('status', params.status)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/pipeline/jobs?${query}`) as unknown as Promise<{ items: PipelineJob[]; total: number }>
}

export async function fetchPipelineJob(id: string): Promise<PipelineJob> {
  return api.get(`/pipeline/jobs/${id}`) as unknown as Promise<PipelineJob>
}
