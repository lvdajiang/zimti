import api from './client'

export interface Material {
  id: string
  name: string
  type: string
  thumbnail_url: string | null
  file_url: string | null
  source: string | null
  tags: string[]
  created_at: string
}

export function fetchMaterials(params?: { type?: string; tag?: string; page?: number; page_size?: number }) {
  return api.get<{ items: Material[]; total: number }>('/materials', { params } as any) as Promise<{ items: Material[]; total: number }>
}

export function uploadMaterial(data: FormData) {
  return api.post<Material>('/materials', data) as Promise<Material>
}

export function deleteMaterial(id: string) {
  return api.delete(`/materials/${id}`) as Promise<{ success: boolean }>
}

export function searchPexels(query: string, page?: number) {
  return api.get('/materials/pexels-search', { params: { query, page } } as any) as Promise<{ results: any[]; total: number }>
}

export function generateMaterial(data: { prompt: string; type: string }) {
  return api.post<{ task_id: string; status: string }>('/materials/generate', data) as Promise<{ task_id: string; status: string }>
}

export function getMaterialStats() {
  return api.get('/materials/stats') as Promise<{ total: number; by_type: Record<string, number> }>
}
