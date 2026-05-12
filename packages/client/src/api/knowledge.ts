import api from './client'

export interface KnowledgeItem {
  id: string
  title: string
  content: string
  source: string
  category: string
  tags: string[]
  created_at: string
  updated_at: string
}

export async function fetchKnowledge(params?: {
  category?: string
  keyword?: string
  page?: number
  page_size?: number
}): Promise<{ items: KnowledgeItem[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.category && params.category !== 'all') query.set('category', params.category)
  if (params?.keyword) query.set('keyword', params.keyword)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/knowledge?${query}`) as unknown as Promise<{ items: KnowledgeItem[]; total: number }>
}

export async function createKnowledge(data: {
  title: string
  content: string
  source?: string
  category?: string
  tags?: string[]
}): Promise<{ id: string }> {
  return api.post('/knowledge', data) as unknown as Promise<{ id: string }>
}

export async function updateKnowledge(
  id: string,
  data: Partial<Pick<KnowledgeItem, 'title' | 'content' | 'source' | 'category' | 'tags'>>,
): Promise<{ id: string }> {
  return api.put(`/knowledge/${id}`, data) as unknown as Promise<{ id: string }>
}

export async function deleteKnowledge(id: string): Promise<void> {
  return api.delete(`/knowledge/${id}`) as unknown as Promise<void>
}
