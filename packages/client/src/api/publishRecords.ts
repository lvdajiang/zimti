import api from './client'

export interface PublishRecord {
  id: string
  video_product_id: string
  type: string
  platforms: string[]
  status: string
  published_at: string | null
  seo_score: number | null
  created_at: string
}

export function fetchPublishRecords(videoProductId: string) {
  return api.get<{ items: PublishRecord[] }>('/publish-records', { params: { video_product_id: videoProductId } } as any) as Promise<{ items: PublishRecord[] }>
}

export function seoCheck(publishRecordId: string) {
  return api.get<{ score: number; issues: { type: string; field: string; message: string }[]; suggestions: string[] }>(`/publish-records/${publishRecordId}/seo-check`) as Promise<{ score: number; issues: any[]; suggestions: string[] }>
}

export function generateCopy(publishRecordId: string, platform: string) {
  return api.post<{ copy: string }>(`/publish-records/${publishRecordId}/generate-copy`, { platform }) as Promise<{ copy: string }>
}

export function publishToPlatform(publishRecordId: string, platform: string) {
  return api.post<{ success: boolean; platform: string; published_at: string }>(`/publish-records/${publishRecordId}/publish`, { platform }) as Promise<{ success: boolean; platform: string; published_at: string }>
}

export function generateBatchCopy(videoProductId: string) {
  return api.post<{ copies: { platform: string; copy: string }[] }>(`/video-products/${videoProductId}/generate-copy/batch`) as Promise<{ copies: { platform: string; copy: string }[] }>
}
