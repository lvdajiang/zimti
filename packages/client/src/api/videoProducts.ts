import api from './client'

export interface VideoProduct {
  id: string
  title: string
  status: string
  platform: string
  resolution: string
  video_url: string | null
  duration: number | null
  created_at: string
}

export function fetchVideoProducts(scriptId: number) {
  return api.get<{ items: VideoProduct[] }>('/video-products', { params: { script_id: scriptId } } as any) as Promise<{ items: VideoProduct[] }>
}

export function createVideoProduct(data: { script_id: number; title: string; platform: string; resolution: string }) {
  return api.post<VideoProduct>('/video-products', data) as Promise<VideoProduct>
}

export function renderVideo(videoProductId: string, config?: Record<string, unknown>) {
  return api.post<{ task_id: string; render_job_id: string; status: string }>('/video-products/render', { video_product_id: videoProductId, ...config }) as Promise<{ task_id: string; render_job_id: string; status: string }>
}

export function getRenderStatus(videoProductId: string) {
  return api.get<{ status: string; progress: number; video_url?: string }>(`/video-products/${videoProductId}/render-status`) as Promise<{ status: string; progress: number; video_url?: string }>
}

export function cancelRender(videoProductId: string) {
  return api.post(`/video-products/${videoProductId}/render-cancel`) as Promise<{ success: boolean }>
}

export function deriveVideo(videoProductId: string, data: { platform: string; resolution: string }) {
  return api.post(`/video-products/${videoProductId}/derive`, data) as Promise<{ success: boolean; id: string }>
}
