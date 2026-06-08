/**
 * 知识库构建引擎 API
 */

import api from './client'
import type {
  KnowledgeBuildMode, KnowledgeBuildStepType,
  KnowledgeBuildJobRecord, KnowledgeBuildStepRecord, KnowledgeBuildScheduleRecord,
} from '@zimti/shared'

// --- 构建任务 ---

/** 启动构建（先运行评估） */
export async function startKnowledgeBuild(data: {
  topic: string
  mode?: KnowledgeBuildMode
  category?: string
  distillBatchIds?: string[]
}): Promise<{ job_id: string; status: string; mode: string }> {
  return api.post('/geo/knowledge/build', data) as unknown as Promise<{ job_id: string; status: string; mode: string }>
}

/** 按主题查询可用的蒸馏关键词 */
export async function fetchDistillByDomain(domain: string): Promise<{
  keywords: Array<{ id: string; keyword: string; intentType: string; totalScore: number; competition: string; batchId: string }>
  batches: Array<{ batchId: string; _count: number }>
}> {
  return api.get(`/geo/distill/by-domain?domain=${encodeURIComponent(domain)}`) as unknown as Promise<{
    keywords: Array<{ id: string; keyword: string; intentType: string; totalScore: number; competition: string; batchId: string }>
    batches: Array<{ batchId: string; _count: number }>
  }>
}

/** 确认评估方案，继续执行 */
export async function confirmBuildPlan(jobId: string, data?: {
  adjustedDimensions?: string[]
}): Promise<{ job_id: string; status: string; mode: string }> {
  return api.post(`/geo/knowledge/build/${jobId}/confirm-plan`, data || {}) as unknown as Promise<{ job_id: string; status: string; mode: string }>
}

/** 获取构建状态 + 步骤 */
export async function getKnowledgeBuildStatus(jobId: string): Promise<KnowledgeBuildJobRecord & { steps: KnowledgeBuildStepRecord[] }> {
  return api.get(`/geo/knowledge/build/${jobId}`) as unknown as Promise<KnowledgeBuildJobRecord & { steps: KnowledgeBuildStepRecord[] }>
}

/** 执行单步（step 模式） */
export async function executeBuildStep(jobId: string, stepType: KnowledgeBuildStepType): Promise<KnowledgeBuildJobRecord & { steps: KnowledgeBuildStepRecord[] }> {
  return api.post(`/geo/knowledge/build/${jobId}/step/${stepType}`) as unknown as Promise<KnowledgeBuildJobRecord & { steps: KnowledgeBuildStepRecord[] }>
}

/** 取消构建 */
export async function cancelKnowledgeBuild(jobId: string): Promise<{ ok: boolean }> {
  return api.delete(`/geo/knowledge/build/${jobId}`) as unknown as Promise<{ ok: boolean }>
}

// --- 定时任务 ---

/** 获取定时任务列表 */
export async function fetchKnowledgeSchedules(): Promise<{ schedules: KnowledgeBuildScheduleRecord[] }> {
  return api.get('/geo/knowledge/schedules') as unknown as Promise<{ schedules: KnowledgeBuildScheduleRecord[] }>
}

/** 创建定时任务 */
export async function createKnowledgeSchedule(data: {
  topic: string
  category?: string
  count?: number
  cronExpr: string
}): Promise<KnowledgeBuildScheduleRecord> {
  return api.post('/geo/knowledge/schedules', data) as unknown as Promise<KnowledgeBuildScheduleRecord>
}

/** 更新定时任务 */
export async function updateKnowledgeSchedule(id: string, data: Partial<KnowledgeBuildScheduleRecord>): Promise<KnowledgeBuildScheduleRecord> {
  return api.put(`/geo/knowledge/schedules/${id}`, data) as unknown as Promise<KnowledgeBuildScheduleRecord>
}

/** 删除定时任务 */
export async function deleteKnowledgeSchedule(id: string): Promise<{ ok: boolean }> {
  return api.delete(`/geo/knowledge/schedules/${id}`) as unknown as Promise<{ ok: boolean }>
}

/** 手动触发定时任务 */
export async function triggerKnowledgeSchedule(id: string): Promise<{ job_id: string }> {
  return api.post(`/geo/knowledge/schedules/${id}/run`) as unknown as Promise<{ job_id: string }>
}
