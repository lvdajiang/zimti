/**
 * 选题 API — 含独立页面 + 流水线专用接口
 */
import api from './client'
import type { TopicDimensionScores, TopicSourceSignals } from '@zimti/shared'

// --- 旧接口（独立页面使用，保持兼容） ---

export interface TopicProposal {
  id: number
  task_id: string
  title: string
  hook: string
  main_points: string[]
  visual_description: string
  status: string
  created_at: string
}

export function fetchTopicProposals(taskId: string) {
  return api.get<{ items: TopicProposal[] }>('/topic-proposals', { params: { task_id: taskId } } as any) as Promise<{ items: TopicProposal[] }>
}

export function createTopicProposal(data: { task_id: string; title: string; hook: string; main_points: string[]; visual_description: string }) {
  return api.post<TopicProposal>('/topic-proposals', data) as Promise<TopicProposal>
}

export function updateTopicProposal(id: number, data: Partial<TopicProposal>) {
  return api.put<TopicProposal>(`/topic-proposals/${id}`, data) as Promise<TopicProposal>
}

export function deleteTopicProposal(id: number) {
  return api.delete(`/topic-proposals/${id}`) as Promise<{ success: boolean }>
}

export function generateTopics(taskId: string) {
  return api.post<{ task_id: string; status: string }>('/topic-proposals/generate', { task_id: taskId }) as Promise<{ task_id: string; status: string }>
}

// --- 流水线专用接口（多频共振） ---

export interface TopicProposalItem {
  id: number
  task_id: string
  pipeline_job_id: string | null
  title: string
  content_skeleton: Record<string, unknown>
  voice_ratio: number
  status: string
  hotspot_ids: number[]
  video_ids: number[]
  dimension_scores: TopicDimensionScores | null
  reasoning: string | null
  source_signals: TopicSourceSignals | null
  created_at: string
  updated_at: string
}

export interface TopicSourceAggregate {
  geoHints: Array<{ question: string; category: string; intentType: string }>
  chatInsights: {
    hotTopics: Array<{ word: string; count: number }>
    painPoints: string[]
  }
  crmInsights: Array<{ destination: string; count: number }>
  hotspotHints: Array<{ title: string; heatValue: number; keywords: string[] }>
  historicalInsights: {
    summary: string
    topPerformers: Array<{ title: string; platform: string; completionRate: number; playCount: number }>
    averageCompletionRate: number
    totalSnapshots: number
    recentInsight: string | null
  }
}

/** 流水线选题生成 */
export function generateTopicsForPipelineApi(pipelineJobId: string, count?: number) {
  return api.post<{ task_id: string; status: string }>(
    '/topic-proposals/generate-for-pipeline',
    { pipeline_job_id: pipelineJobId, count },
  )
}

/** 获取项目的选题列表 */
export function fetchTopicProposalsByJob(pipelineJobId: string) {
  return api.get<{ items: TopicProposalItem[]; total: number }>(
    `/topic-proposals?pipeline_job_id=${pipelineJobId}`,
  )
}

/** 选用选题 */
export function selectTopicApi(topicId: number) {
  return api.post(`/topic-proposals/${topicId}/select`)
}

/** 获取多源灵感数据 */
export function fetchTopicSourcesApi() {
  return api.get<TopicSourceAggregate>('/topic-proposals/sources')
}

/** 轮询 AI 生成状态 */
export function pollTopicGenerationStatus(aiTaskId: string) {
  return api.get<{ task_id: string; status: string; progress: number; output: unknown }>(
    `/topic-proposals/generate/${aiTaskId}/status`,
  )
}
