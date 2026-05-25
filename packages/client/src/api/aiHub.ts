import api from './client'
import type { BrandMemoryCategory, EvolutionType } from '@zimti/shared'

// --- 类型定义 ---

export interface BrandMemory {
  id: string
  category: BrandMemoryCategory
  key: string
  value: unknown
  created_at: string
  updated_at: string
}

export interface StrategyRecommendation {
  type: string
  priority: 'high' | 'medium' | 'low'
  title: string
  reason: string
  action: string
}

export interface EvolutionLog {
  id: string
  evolution_type: EvolutionType
  trigger: string
  finding: string
  action: string
  created_at: string
}

// --- 品牌记忆 ---

export async function fetchBrandMemory(params?: {
  category?: BrandMemoryCategory
}): Promise<{ profile: Record<string, unknown> | null; items: BrandMemory[] }> {
  const query = new URLSearchParams()
  if (params?.category) query.set('category', params.category)
  return api.get(`/ai-hub/brand-memory?${query}`) as unknown as Promise<{ profile: Record<string, unknown> | null; items: BrandMemory[] }>
}

export async function upsertBrandMemory(items: Array<{
  category: BrandMemoryCategory
  key: string
  value: unknown
}>): Promise<{ success: boolean }> {
  return api.put('/ai-hub/brand-memory', { items }) as unknown as Promise<{ success: boolean }>
}

export async function deleteBrandMemory(id: string): Promise<{ success: boolean }> {
  return api.delete(`/ai-hub/brand-memory/${id}`) as unknown as Promise<{ success: boolean }>
}

export async function learnBrandMemory(data: {
  category: BrandMemoryCategory
  before: string
  after: string
}): Promise<{ findings: string[] }> {
  return api.post('/ai-hub/brand-memory/learn', data) as unknown as Promise<{ findings: string[] }>
}

// --- 策略引擎 ---

export async function fetchStrategyRecommendations(params?: {
  context?: string
}): Promise<{ items: StrategyRecommendation[] }> {
  const query = new URLSearchParams()
  if (params?.context) query.set('context', params.context)
  return api.get(`/ai-hub/strategy/recommendations?${query}`) as unknown as Promise<{ items: StrategyRecommendation[] }>
}

export async function evaluateHotspot(data: {
  title: string
  description?: string
}): Promise<{ score: number; recommendation: string }> {
  return api.post('/ai-hub/strategy/evaluate-hotspot', data) as unknown as Promise<{ score: number; recommendation: string }>
}

// --- 进化引擎 ---

export async function triggerEvolutionAnalysis(data: {
  content_type: string
  content_id: string
  metrics: Record<string, number>
}): Promise<{ findings: string[] }> {
  return api.post('/ai-hub/evolution/analyze', data) as unknown as Promise<{ findings: string[] }>
}

export async function fetchEvolutionLogs(params?: {
  evolution_type?: EvolutionType
  limit?: number
}): Promise<{ items: EvolutionLog[] }> {
  const query = new URLSearchParams()
  if (params?.evolution_type) query.set('evolution_type', params.evolution_type)
  if (params?.limit) query.set('limit', String(params.limit))
  return api.get(`/ai-hub/evolution/log?${query}`) as unknown as Promise<{ items: EvolutionLog[] }>
}
