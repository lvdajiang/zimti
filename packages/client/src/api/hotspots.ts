import api from './client'

export interface Hotspot {
  id: number
  title: string
  source_platform: string
  source: string
  source_url: string | null
  relevance_score: number
  heat_value: number
  heat_trend: string
  keywords: string[]
  usage_status: string
  note: string | null
  created_at: string
}

export function fetchHotspots(params?: { platform?: string; status?: string; keyword?: string; page?: number; page_size?: number }) {
  return api.get<{ items: Hotspot[]; total: number }>('/hotspots', { params } as any) as Promise<{ items: Hotspot[]; total: number }>
}

export function createHotspot(data: Partial<Hotspot> & { title: string }) {
  return api.post<Hotspot>('/hotspots', data) as Promise<Hotspot>
}

export function updateHotspot(id: number, data: Partial<Hotspot>) {
  return api.put<Hotspot>(`/hotspots/${id}`, data) as Promise<Hotspot>
}

export function deleteHotspot(id: number) {
  return api.delete(`/hotspots/${id}`) as Promise<{ success: boolean }>
}

export function refreshHotspots(platform?: string) {
  return api.post<{ success: boolean; message: string }>('/hotspots/refresh', null, { params: platform ? { source_platform: platform } : {} } as any) as Promise<{ success: boolean; message: string }>
}
