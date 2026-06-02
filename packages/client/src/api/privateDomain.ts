import api from './client'
import type { MomentsContentType, GroupType } from '@zimti/shared'

// --- 类型定义 ---

export interface MomentsContent {
  id: string
  content_type: MomentsContentType
  content: string
  image_suggestion: string | null
  status: string           // draft/scheduled/sent
  scheduled_at: string | null
  sent_at: string | null
  engagement_data: unknown
  created_at: string
}

export interface GroupContent {
  id: string
  group_type: GroupType
  title: string | null
  content: string
  created_at: string
}

// --- 朋友圈 ---

export async function fetchDailyMoments(): Promise<{ items: MomentsContent[] }> {
  return api.get('/private-domain/moments/daily') as unknown as Promise<{ items: MomentsContent[] }>
}

export async function fetchMomentsCalendar(year: number, month: number): Promise<{ items: MomentsContent[] }> {
  return api.get(`/private-domain/moments/calendar?year=${year}&month=${month}`) as unknown as Promise<{ items: MomentsContent[] }>
}

export async function markMomentSent(id: string): Promise<{ id: string; sent_at: string }> {
  return api.post(`/private-domain/moments/${id}/sent`) as unknown as Promise<{ id: string; sent_at: string }>
}

export async function scheduleMoment(id: string, data: { scheduled_at?: string | null; status?: string }): Promise<{ id: string }> {
  return api.put(`/private-domain/moments/${id}/schedule`, data) as unknown as Promise<{ id: string }>
}

export async function recordMomentEngagement(id: string, data: {
  likes?: number
  comments?: number
  screenshot?: string | null
}): Promise<{ id: string }> {
  return api.post(`/private-domain/moments/${id}/engagement`, data) as unknown as Promise<{ id: string }>
}

// --- 群运营 ---

export async function fetchGroupContents(params?: {
  group_type?: GroupType
}): Promise<{ items: GroupContent[] }> {
  const query = new URLSearchParams()
  if (params?.group_type) query.set('group_type', params.group_type)
  return api.get(`/private-domain/group-content?${query}`) as unknown as Promise<{ items: GroupContent[] }>
}

export async function generateGroupContent(data: {
  group_type: GroupType
}): Promise<{ id: string }> {
  return api.post('/private-domain/group-content', data) as unknown as Promise<{ id: string }>
}
