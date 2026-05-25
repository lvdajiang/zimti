import api from './client'

// --- 类型定义 ---

export interface InterviewQuestionLayer {
  layer: number
  type: string
  label: string
  description: string
}

export interface InterviewSession {
  topic: string
  currentLayer: number
  answers: Array<{ layer: number; type: string; question: string; answer: string }>
}

export interface InterviewNextResult {
  session: InterviewSession
  nextQuestion: string | null
  isComplete: boolean
}

export interface IpProfile {
  profile: Record<string, unknown>
  canvas: Record<string, string>
}

export interface IndustryTemplate {
  id: string
  name: string
  industry: string
  description: string | null
  config: unknown
}

// --- IP 访谈 ---

export async function fetchInterviewLayers(): Promise<{ layers: InterviewQuestionLayer[] }> {
  return api.get('/ip-interview/layers') as unknown as Promise<{ layers: InterviewQuestionLayer[] }>
}

export async function startInterview(topic: string): Promise<{ session: InterviewSession }> {
  return api.post('/ip-interview/start', { topic }) as unknown as Promise<{ session: InterviewSession }>
}

export async function nextInterviewQuestion(data: {
  session: InterviewSession
  answer: string
}): Promise<InterviewNextResult> {
  return api.post('/ip-interview/next', data) as unknown as Promise<InterviewNextResult>
}

export async function generateIpProfile(data: {
  session: InterviewSession
}): Promise<IpProfile> {
  return api.post('/ip-interview/profile', data) as unknown as Promise<IpProfile>
}

// --- 行业模板 ---

export async function fetchIndustryTemplates(params?: {
  industry?: string
}): Promise<{ items: IndustryTemplate[] }> {
  const query = new URLSearchParams()
  if (params?.industry) query.set('industry', params.industry)
  return api.get(`/industry-templates?${query}`) as unknown as Promise<{ items: IndustryTemplate[] }>
}

export async function applyIndustryTemplate(id: string): Promise<{
  persona_default: Record<string, unknown>
  content_types: string[]
  pipeline_presets: Record<string, boolean>
} | null> {
  return api.post('/industry-templates/apply', { id }) as unknown as Promise<{
    persona_default: Record<string, unknown>
    content_types: string[]
    pipeline_presets: Record<string, boolean>
  } | null>
}

export async function initIndustryTemplates(): Promise<{ created: number }> {
  return api.post('/industry-templates/init') as unknown as Promise<{ created: number }>
}
