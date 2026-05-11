import api from './client'

export interface CollectTask {
  id: string
  account_id: string
  platform: string
  status: string
  progress: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export function fetchCollectTasks(params?: { status?: string; page?: number; page_size?: number }) {
  return api.get<{ items: CollectTask[]; total: number }>('/collect-tasks', { params } as any) as Promise<{ items: CollectTask[]; total: number }>
}

export function createCollectTask(data: { account_id: string; platform: string }) {
  return api.post<CollectTask>('/collect-tasks', data) as Promise<CollectTask>
}

export function executeCollectTask(id: string) {
  return api.post<CollectTask>(`/collect-tasks/${id}/execute`) as Promise<CollectTask>
}

export function pauseCollectTask(id: string) {
  return api.post<CollectTask>(`/collect-tasks/${id}/pause`) as Promise<CollectTask>
}

export function retryCollectTask(id: string) {
  return api.post<CollectTask>(`/collect-tasks/${id}/retry`) as Promise<CollectTask>
}

export function deleteCollectTask(id: string) {
  return api.delete(`/collect-tasks/${id}`) as Promise<{ success: boolean }>
}

export function batchDeleteCollectTask(ids: string[]) {
  return api.delete('/collect-tasks/batch', { data: { ids } }) as Promise<{ success: boolean }>
}

export function getCollectTaskLogs(id: string) {
  return api.get(`/collect-tasks/${id}/logs`) as Promise<{ items: { message: string; level: string; created_at: string }[] }>
}

export function getCollectTaskStats() {
  return api.get('/collect-tasks/stats') as Promise<{ total: number; by_status: Record<string, number> }>
}
