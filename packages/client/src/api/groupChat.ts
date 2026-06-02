import api from './client'

// --- 类型定义 ---

export interface GroupChatLead {
  name: string
  intent: string
  context: string
}

export interface GroupChatAnalysis {
  id: string
  group_name: string
  file_name: string
  message_count: number
  lead_count: number
  report: {
    leads: GroupChatLead[]
    hotTopics: Array<{ word: string; count: number }>
    painPoints: string[]
    priceRange: { min: number; max: number; currency: string } | null
  }
  created_at: string
}

// --- API ---

export async function uploadGroupChat(data: FormData): Promise<GroupChatAnalysis> {
  return api.post('/group-chat/upload', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }) as unknown as Promise<GroupChatAnalysis>
}

export async function fetchGroupChatAnalyses(): Promise<{ items: GroupChatAnalysis[] }> {
  return api.get('/group-chat/analyses') as unknown as Promise<{ items: GroupChatAnalysis[] }>
}

export async function fetchGroupChatAnalysis(id: string): Promise<GroupChatAnalysis> {
  return api.get(`/group-chat/analyses/${id}`) as unknown as Promise<GroupChatAnalysis>
}
