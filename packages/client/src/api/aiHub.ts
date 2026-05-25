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

export async function fetchBrandMemory(): Promise<{ profile: Record<string, unknown> | null; items: BrandMemory[] }> {
  return api.get('/ai-hub/brand-memory') as unknown as Promise<{ profile: Record<string, unknown> | null; items: BrandMemory[] }>
}

export async function upsertBrandMemory(data: {
  category: BrandMemoryCategory
  key: string
  value: unknown
  source?: string
  weight?: number
}): Promise<{ success: boolean }> {
  return api.put('/ai-hub/brand-memory', data) as unknown as Promise<{ success: boolean }>
}

export async function deleteBrandMemory(data: {
  category: BrandMemoryCategory
  key: string
}): Promise<{ success: boolean }> {
  return api.delete('/ai-hub/brand-memory', data) as unknown as Promise<{ success: boolean }>
}

export async function learnBrandMemory(data: {
  original_text: string
  modified_text: string
}): Promise<{ success: boolean }> {
  return api.post('/ai-hub/brand-memory/learn', data) as unknown as Promise<{ success: boolean }>
}

// --- 策略引擎 ---

export async function fetchStrategyRecommendations(): Promise<{ recommendations: StrategyRecommendation[] }> {
  return api.get('/ai-hub/strategy/recommendations') as unknown as Promise<{ recommendations: StrategyRecommendation[] }>
}

export async function evaluateHotspot(data: {
  title: string
  description?: string
}): Promise<{ score: number; recommendation: string }> {
  return api.post('/ai-hub/strategy/evaluate-hotspot', data) as unknown as Promise<{ score: number; recommendation: string }>
}

// --- 进化引擎 ---

export async function triggerEvolutionAnalysis(data: {
  type: EvolutionType
  trigger: string
  before?: string
  after?: string
  metric?: number
}): Promise<{ success: boolean }> {
  return api.post('/ai-hub/evolution/analyze', data) as unknown as Promise<{ success: boolean }>
}

export async function fetchEvolutionLogs(params?: {
  type?: EvolutionType
  limit?: number
}): Promise<{ logs: EvolutionLog[]; patterns?: unknown }> {
  const query = new URLSearchParams()
  if (params?.type) query.set('type', params.type)
  if (params?.limit) query.set('limit', String(params.limit))
  return api.get(`/ai-hub/evolution/log?${query}`) as unknown as Promise<{ logs: EvolutionLog[]; patterns?: unknown }>
}
