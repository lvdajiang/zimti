import api from './client'

export interface DashboardOverview {
  total_tasks: number
  active_tasks: number
  completed_scripts: number
  published_videos: number
}

export function fetchOverview() {
  return api.get<DashboardOverview>('/dashboard/overview') as Promise<DashboardOverview>
}

export function fetchWorkflowStats() {
  return api.get('/dashboard/workflow') as Promise<{ stages: { name: string; count: number }[] }>
}

export function fetchTrends(days?: number) {
  return api.get('/dashboard/trends', { params: { days } } as any) as Promise<{ points: { date: string; play_count: number; interaction_rate: number }[] }>
}

export function fetchVideoRecords(limit?: number) {
  return api.get('/dashboard/video-records', { params: { limit } } as any) as Promise<{ items: any[] }>
}

export function runAiAnalysis() {
  return api.post<{ task_id: string; status: string }>('/dashboard/ai-analysis') as Promise<{ task_id: string; status: string }>
}
