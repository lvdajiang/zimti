import api from './client'

export interface ExtractedFact {
  content: string
  fact_type: string
  confidence: number
  fact_context: string
  tags: string[]
  needs_verification: boolean
  verification_status: string | null
  verification_note: string | null
}

export interface ExtractResult {
  topic: string
  total_extracted: number
  saved_count: number
  facts: ExtractedFact[]
}

export function startExtractFacts(data: {
  transcript: string
  topic?: string
  verify?: boolean
}): Promise<{ task_id: string; status: string }> {
  return api.post('/geo/facts/extract', data) as unknown as Promise<{ task_id: string; status: string }>
}

export function getExtractStatus(taskId: string): Promise<{
  task_id: string
  status: string
  output: ExtractResult | null
  error: string | null
}> {
  return api.get(`/geo/facts/extract/${taskId}/status`) as unknown as Promise<any>
}

export function startVerifyFacts(factIds: string[]): Promise<{ task_id: string; status: string }> {
  return api.post('/geo/facts/verify', { fact_ids: factIds }) as unknown as Promise<{ task_id: string; status: string }>
}

export function getVerifyStatus(taskId: string): Promise<{
  task_id: string
  status: string
  output: { verified: number; total: number } | null
  error: string | null
}> {
  return api.get(`/geo/facts/verify/${taskId}/status`) as unknown as Promise<any>
}

export interface FactRecord {
  id: string
  content: string
  title: string
  fact_type: string | null
  verification_status: string | null
  credibility: number
  tags: string[]
  metadata: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

export function fetchFacts(params?: {
  fact_type?: string
  verification_status?: string
  keyword?: string
  page?: number
  page_size?: number
}): Promise<{ items: FactRecord[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.fact_type && params.fact_type !== 'all') query.set('fact_type', params.fact_type)
  if (params?.verification_status && params.verification_status !== 'all') query.set('verification_status', params.verification_status)
  if (params?.keyword) query.set('keyword', params.keyword)
  query.set('page', String(params?.page || 1))
  query.set('page_size', String(params?.page_size || 50))
  return api.get(`/geo/facts?${query}`) as unknown as Promise<{ items: FactRecord[]; total: number }>
}

export function updateFact(id: string, data: {
  content?: string
  factType?: string
  verificationStatus?: string
  tags?: string[]
  is_active?: boolean
}): Promise<{ id: string; ok: boolean }> {
  return api.put(`/geo/facts/${id}`, data) as unknown as Promise<{ id: string; ok: boolean }>
}
