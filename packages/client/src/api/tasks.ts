import api from './client'

export interface Task {
  id: string
  title: string
  description: string
  status: string
  current_step: number
  topic_count: number
  script_count: number
  created_at: string
  updated_at: string
}

export interface TaskListResponse {
  items: Task[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export function fetchTasks(params?: { status?: string; page?: number; page_size?: number }) {
  return api.get<TaskListResponse>('/tasks', { params } as any) as Promise<TaskListResponse>
}

export function createTask(data: { title: string; description?: string; platform?: string }) {
  return api.post<Task>('/tasks', data) as Promise<Task>
}

export function updateTask(taskId: string, data: Partial<Task>) {
  return api.put<Task>(`/tasks/${taskId}`, data) as Promise<Task>
}
