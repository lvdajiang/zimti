import api from './client'

export interface AiStudioProject {
  id: string
  title: string
  description: string | null
  status: string
  asset_count: number
  created_at: string
  updated_at: string
}

export interface AiStudioAsset {
  id: string
  project_id: string
  type: 'image' | 'video'
  task_type: string
  status: string
  input_params: Record<string, unknown>
  file_url: string | null
  thumbnail_url: string | null
  width: number | null
  height: number | null
  duration: number | null
  file_size: number | null
  error: string | null
  jimeng_task_id: string | null
  created_at: string
  updated_at: string
}

export interface GenerateParams {
  project_id: string
  task_type: string
  prompt?: string
  image_url?: string
  first_frame_url?: string
  last_frame_url?: string
  audio_url?: string
  model?: string
  width?: number
  height?: number
  duration?: number
  edit_instruction?: string
}

// 项目 CRUD

export function fetchProjects() {
  return api.get<AiStudioProject[]>('/ai-studio/projects') as Promise<AiStudioProject[]>
}

export function createProject(data: { title: string; description?: string }) {
  return api.post<AiStudioProject>('/ai-studio/projects', data) as Promise<AiStudioProject>
}

export function fetchProject(id: string) {
  return api.get<AiStudioProject>(`/ai-studio/projects/${id}`) as Promise<AiStudioProject>
}

export function updateProject(id: string, data: { title?: string; description?: string; status?: string }) {
  return api.put<AiStudioProject>(`/ai-studio/projects/${id}`, data) as Promise<AiStudioProject>
}

export function deleteProject(id: string) {
  return api.delete(`/ai-studio/projects/${id}`) as Promise<{ success: boolean }>
}

// 素材

export function fetchAssets(projectId: string, params?: { type?: string; status?: string }) {
  return api.get<AiStudioAsset[]>(`/ai-studio/projects/${projectId}/assets`, { params } as any) as Promise<AiStudioAsset[]>
}

export function fetchAsset(id: string) {
  return api.get<AiStudioAsset>(`/ai-studio/assets/${id}`) as Promise<AiStudioAsset>
}

export function deleteAsset(id: string) {
  return api.delete(`/ai-studio/assets/${id}`) as Promise<{ success: boolean }>
}

// 生成

export function submitGeneration(data: GenerateParams) {
  return api.post<{ asset_id: string; status: string }>('/ai-studio/generate', data) as Promise<{ asset_id: string; status: string }>
}

export function fetchAssetStatus(assetId: string) {
  return api.get<AiStudioAsset>(`/ai-studio/tasks/${assetId}/status`) as Promise<AiStudioAsset>
}

// 推送

export function pushToMaterials(assetId: string) {
  return api.post<{ material_id: string }>(`/ai-studio/assets/${assetId}/push-to-materials`) as Promise<{ material_id: string }>
}

export function pushToSegment(assetId: string, segmentId: number) {
  return api.post<{ success: boolean }>(`/ai-studio/assets/${assetId}/push-to-segment`, { segment_id: segmentId }) as Promise<{ success: boolean }>
}
