import api from './client'

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
