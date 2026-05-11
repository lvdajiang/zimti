import api from './client'

export interface ViralVideo {
  id: number
  account_id: string
  platform: string
  platform_video_id: string
  title: string
  cover_url: string | null
  video_url: string | null
  duration: number
  play_count: number
  like_count: number
  comment_count: number
  collect_count: number
  share_count: number
  interaction_rate: number | null
  transcript: string | null
  analysis: unknown
  collected_at: string
}

export function fetchViralVideos(params?: { platform?: string; keyword?: string; sort_by?: string; page?: number; page_size?: number }) {
  return api.get<{ items: ViralVideo[]; total: number }>('/viral-videos', { params } as any) as Promise<{ items: ViralVideo[]; total: number }>
}

export function fetchViralVideo(id: number) {
  return api.get<ViralVideo & { account_name: string }>(`/viral-videos/${id}`) as Promise<ViralVideo & { account_name: string }>
}

export function saveTranscript(id: number, text: string) {
  return api.put(`/viral-videos/${id}/transcript`, { transcript_text: text }) as Promise<{ success: boolean }>
}

export function analyzeVideo(id: number) {
  return api.post(`/viral-videos/${id}/analyze`) as Promise<{ success: boolean }>
}

export function extractTranscript(id: number) {
  return api.post<{ task_id: string; status: string }>(`/viral-videos/${id}/transcript/extract`) as Promise<{ task_id: string; status: string }>
}

export function batchAnalyze(videoIds: number[]) {
  return api.post('/viral-videos/analyze-batch', { video_ids: videoIds }) as Promise<{ success: boolean; count: number }>
}
