import api from './client'
import type {
  CustomerStage, IntentLevel, ChatTemplateCategory,
} from '@zimti/shared'

// --- 类型定义 ---

export interface Customer {
  id: string
  name: string
  aliases: string
  phone: string | null
  wechat: string | null
  source_type: string
  source_ref_id: string | null
  intent_level: IntentLevel
  stage: CustomerStage
  travel_intent: unknown
  notes: string | null
  last_follow_up_at: string | null
  tags: CustomerTag[]
  created_at: string
  updated_at: string
}

export interface CustomerTag {
  id: string
  customer_id: string
  tag: string
}

export interface ChatTemplate {
  id: string
  stage: string
  category: ChatTemplateCategory
  content: string
  effectiveness_score: number
  created_at: string
}

export interface FollowUpReminder {
  id: string
  customer_id: string
  customer: { name: string }
  remind_at: string
  message: string | null
  status: string
}

export interface VoiceInputResult {
  name?: string
  travel_intent?: {
    people?: number
    date?: string
    destination?: string
    budget?: string
  }
  tags?: string[]
  notes?: string
}

export interface FunnelStats {
  [stage: string]: number
}

// --- 客户 CRUD ---

export async function fetchCustomers(params?: {
  stage?: CustomerStage
  intent_level?: IntentLevel
  keyword?: string
  page?: number
  page_size?: number
}): Promise<{ items: Customer[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.stage) query.set('stage', params.stage)
  if (params?.intent_level) query.set('intent_level', params.intent_level)
  if (params?.keyword) query.set('keyword', params.keyword)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/crm/customers?${query}`) as unknown as Promise<{ items: Customer[]; total: number }>
}

export async function createCustomer(data: {
  name: string
  aliases?: string
  phone?: string
  wechat?: string
  source_type?: string
  source_ref_id?: string
  intent_level?: IntentLevel
  stage?: CustomerStage
  travel_intent?: unknown
  notes?: string
  tags?: string[]
}): Promise<{ id: string }> {
  return api.post('/crm/customers', data) as unknown as Promise<{ id: string }>
}

export async function updateCustomer(id: string, data: {
  name?: string
  aliases?: string
  phone?: string
  wechat?: string
  intent_level?: IntentLevel
  travel_intent?: unknown
  notes?: string
}): Promise<{ id: string }> {
  return api.put(`/crm/customers/${id}`, data) as unknown as Promise<{ id: string }>
}

export async function deleteCustomer(id: string): Promise<{ success: boolean }> {
  return api.delete(`/crm/customers/${id}`) as unknown as Promise<{ success: boolean }>
}

// --- 阶段流转 ---

export async function updateCustomerStage(id: string, stage: CustomerStage, note?: string): Promise<{ id: string; stage: string }> {
  return api.put(`/crm/customers/${id}/stage`, { stage, note }) as unknown as Promise<{ id: string; stage: string }>
}

// --- 标签 ---

export async function addCustomerTags(id: string, tags: string[]): Promise<{ success: boolean }> {
  return api.post(`/crm/customers/${id}/tags`, { tags }) as unknown as Promise<{ success: boolean }>
}

export async function removeCustomerTag(id: string, tag: string): Promise<{ success: boolean }> {
  return api.delete(`/crm/customers/${id}/tags`, { data: { tag } }) as unknown as Promise<{ success: boolean }>
}

// --- 语音录入 ---

export async function parseVoiceInput(text: string): Promise<VoiceInputResult> {
  return api.post('/crm/customers/voice-input', { text }) as unknown as Promise<VoiceInputResult>
}

// --- 话术模板 ---

export async function fetchChatTemplates(params?: {
  stage?: string
}): Promise<{ items: ChatTemplate[] }> {
  const query = new URLSearchParams()
  if (params?.stage) query.set('stage', params.stage)
  return api.get(`/crm/chat-templates?${query}`) as unknown as Promise<{ items: ChatTemplate[] }>
}

export async function generateChatTemplates(stage: string, customerContext?: string): Promise<{ templates: ChatTemplate[] }> {
  return api.post('/crm/chat-templates/generate', { stage, customer_context: customerContext }) as unknown as Promise<{ templates: ChatTemplate[] }>
}

export async function createChatTemplate(data: {
  stage: string
  category?: ChatTemplateCategory
  content: string
}): Promise<{ id: string }> {
  return api.post('/crm/chat-templates', data) as unknown as Promise<{ id: string }>
}

// --- 跟进提醒 ---

export async function fetchFollowUpReminders(): Promise<{ items: FollowUpReminder[] }> {
  return api.get('/crm/follow-up-reminders') as unknown as Promise<{ items: FollowUpReminder[] }>
}

export async function createFollowUpReminder(data: {
  customer_id: string
  remind_at: string
  message?: string
}): Promise<{ id: string }> {
  return api.post('/crm/follow-up-reminders', data) as unknown as Promise<{ id: string }>
}

// --- 沉默客户 + 漏斗 ---

export async function fetchSilentCustomers(): Promise<{ items: Customer[] }> {
  return api.get('/crm/silent-customers') as unknown as Promise<{ items: Customer[] }>
}

export async function fetchFunnelStats(): Promise<FunnelStats> {
  return api.get('/crm/funnel-stats') as unknown as Promise<FunnelStats>
}

// --- 联系人健康度 ---

export interface ContactHealthItem {
  id: string
  name: string
  stage: string
  lastFollowUpAt: string | null
  health: 'healthy' | 'attention' | 'at_risk' | 'lost'
  daysSinceContact: number | null
}

export async function fetchContactHealth(params?: {
  health?: string
}): Promise<{ items: ContactHealthItem[] }> {
  const query = new URLSearchParams()
  if (params?.health) query.set('health', params.health)
  return api.get(`/crm/contact-health?${query}`) as unknown as Promise<{ items: ContactHealthItem[] }>
}

// --- 批量唤醒话术 ---

export interface WakeScript {
  customerId: string
  name: string
  script: string
}

export async function batchGenerateWakeScripts(customerIds: string[]): Promise<{ items: WakeScript[] }> {
  return api.post('/crm/batch-wake-scripts', { customer_ids: customerIds }) as unknown as Promise<{ items: WakeScript[] }>
}

// --- 批量导入线索 ---

export async function importLeads(leads: Array<{
  name: string
  phone?: string
  wechat?: string
  sourceDetail?: unknown
  travelIntent?: unknown
  tags?: string[]
}>): Promise<{ count: number }> {
  return api.post('/crm/import-leads', { leads }) as unknown as Promise<{ count: number }>
}

// --- 漏斗分析 ---

export interface FunnelAnalysisStage {
  stage: string
  count: number
  conversionRate: number
  avgDays: number
}

export interface FunnelAnalysis {
  stages: FunnelAnalysisStage[]
  totalCustomers: number
  bottleneck: { stage: string; rate: number }
}

export async function fetchFunnelAnalysis(params?: {
  start_date?: string
  end_date?: string
  source_type?: string
  tags?: string[]
}): Promise<FunnelAnalysis> {
  const query = new URLSearchParams()
  if (params?.start_date) query.set('start_date', params.start_date)
  if (params?.end_date) query.set('end_date', params.end_date)
  if (params?.source_type) query.set('source_type', params.source_type)
  if (params?.tags?.length) query.set('tags', params.tags.join(','))
  return api.get(`/crm/funnel-analysis?${query}`) as unknown as Promise<FunnelAnalysis>
}
