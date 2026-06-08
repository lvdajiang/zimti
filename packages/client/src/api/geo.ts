/**
 * GEO 优化 API
 */

import api from './client'
import type { GeoQuestionCategory, GeoIntentType, GeoContentStatus, BrandKnowledgeCategory, KeywordCompetition, KeywordDistillationStatus } from '@zimti/shared'

// --- 类型定义 ---

export interface GeoQuestion {
  id: string
  user_id: string
  question: string
  category: GeoQuestionCategory
  intent_type: GeoIntentType
  ai_generated: boolean
  source: string
  tags: string[]
  content_count: number
  created_at: string
  updated_at: string
}

export interface GeoContent {
  id: string
  user_id: string
  question_id: string
  question_text: string | null
  title: string
  content: string
  schema_markup: Record<string, unknown> | null
  keywords: string[]
  status: GeoContentStatus
  eeat_score: number | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface GeoMention {
  id: string
  user_id: string
  content_id: string
  search_engine: string
  query: string
  mentioned: boolean
  mention_rank: number | null
  mention_snippet: string | null
  checked_at: string
  created_at: string
}

export interface GeoDashboard {
  overview: {
    total_questions: number
    total_contents: number
    published_contents: number
  }
  mention_by_engine: Array<{ engine: string; total_checks: number; mentioned_count: number }>
  top_contents: Array<{ id: string; title: string; question: string; eeat_score: number | null; mention_count: number }>
}

// --- 意图问题 ---

export async function fetchGeoQuestions(params?: {
  category?: string
  intent_type?: string
  keyword?: string
  page?: number
  page_size?: number
}): Promise<{ items: GeoQuestion[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.category && params.category !== 'all') query.set('category', params.category)
  if (params?.intent_type && params.intent_type !== 'all') query.set('intent_type', params.intent_type)
  if (params?.keyword) query.set('keyword', params.keyword)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/geo/questions?${query}`) as unknown as Promise<{ items: GeoQuestion[]; total: number }>
}

export async function createGeoQuestion(data: {
  question: string
  category?: GeoQuestionCategory
  intent_type?: GeoIntentType
  tags?: string[]
}): Promise<GeoQuestion> {
  return api.post('/geo/questions', data) as unknown as Promise<GeoQuestion>
}

export async function updateGeoQuestion(id: string, data: {
  question?: string
  category?: GeoQuestionCategory
  intent_type?: GeoIntentType
  tags?: string[]
}): Promise<GeoQuestion> {
  return api.put(`/geo/questions/${id}`, data) as unknown as Promise<GeoQuestion>
}

export async function deleteGeoQuestion(id: string): Promise<{ ok: boolean }> {
  return api.delete(`/geo/questions/${id}`) as unknown as Promise<{ ok: boolean }>
}

export async function generateGeoQuestions(data: {
  domain?: string
  category?: GeoQuestionCategory
  count?: number
}): Promise<{ task_id: string; status: string }> {
  return api.post('/geo/questions/generate', data) as unknown as Promise<{ task_id: string; status: string }>
}

export async function getGenerateQuestionsStatus(taskId: string): Promise<{ task_id: string; status: string; output: unknown }> {
  return api.get(`/geo/questions/generate/${taskId}/status`) as unknown as Promise<{ task_id: string; status: string; output: unknown }>
}

export async function batchCreateGeoQuestions(questions: Array<{
  question: string
  category?: string
  intent_type?: string
  tags?: string[]
}>): Promise<{ created: number }> {
  return api.post('/geo/questions/batch', { questions }) as unknown as Promise<{ created: number }>
}

// --- GEO 内容 ---

export async function fetchGeoContents(params?: {
  status?: string
  question_id?: string
  page?: number
  page_size?: number
}): Promise<{ items: GeoContent[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.status && params.status !== 'all') query.set('status', params.status)
  if (params?.question_id) query.set('question_id', params.question_id)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/geo/contents?${query}`) as unknown as Promise<{ items: GeoContent[]; total: number }>
}

export async function fetchGeoContent(id: string): Promise<GeoContent> {
  return api.get(`/geo/contents/${id}`) as unknown as Promise<GeoContent>
}

export async function createGeoContent(data: {
  question_id: string
  title: string
  content: string
  keywords?: string[]
}): Promise<GeoContent> {
  return api.post('/geo/contents', data) as unknown as Promise<GeoContent>
}

export async function updateGeoContent(id: string, data: {
  title?: string
  content?: string
  keywords?: string[]
  status?: GeoContentStatus
}): Promise<GeoContent> {
  return api.put(`/geo/contents/${id}`, data) as unknown as Promise<GeoContent>
}

export async function deleteGeoContent(id: string): Promise<{ ok: boolean }> {
  return api.delete(`/geo/contents/${id}`) as unknown as Promise<{ ok: boolean }>
}

export async function generateGeoContent(data: {
  question_id: string
}): Promise<{ task_id: string; status: string }> {
  return api.post('/geo/contents/generate', data) as unknown as Promise<{ task_id: string; status: string }>
}

export async function getGenerateContentStatus(taskId: string): Promise<{ task_id: string; status: string; output: unknown }> {
  return api.get(`/geo/contents/generate/${taskId}/status`) as unknown as Promise<{ task_id: string; status: string; output: unknown }>
}

export async function batchGenerateGeoContent(data: {
  question_ids: string[]
  domain?: string
  brand_context?: string
}): Promise<{ task_id: string; status: string }> {
  return api.post('/geo/contents/batch-generate', data) as unknown as Promise<{ task_id: string; status: string }>
}

export async function getBatchGenerateStatus(taskId: string): Promise<{ task_id: string; status: string; output: unknown }> {
  return api.get(`/geo/contents/batch-generate/${taskId}/status`) as unknown as Promise<{ task_id: string; status: string; output: unknown }>
}

export async function fetchSchemaPreview(id: string): Promise<{ schema_markup: Record<string, unknown> }> {
  return api.get(`/geo/contents/${id}/schema-preview`) as unknown as Promise<{ schema_markup: Record<string, unknown> }>
}

// --- GEO 提及 ---

export async function fetchGeoMentions(params?: {
  search_engine?: string
  content_id?: string
  page?: number
  page_size?: number
}): Promise<{ items: GeoMention[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.search_engine) query.set('search_engine', params.search_engine)
  if (params?.content_id) query.set('content_id', params.content_id)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/geo/mentions?${query}`) as unknown as Promise<{ items: GeoMention[]; total: number }>
}

export async function checkGeoMentions(data: {
  content_ids: string[]
  search_engines?: string[]
}): Promise<{ task_id: string; status: string }> {
  return api.post('/geo/mentions/check', data) as unknown as Promise<{ task_id: string; status: string }>
}

export async function getCheckMentionsStatus(taskId: string): Promise<{ task_id: string; status: string; output: unknown }> {
  return api.get(`/geo/mentions/check/${taskId}/status`) as unknown as Promise<{ task_id: string; status: string; output: unknown }>
}

export async function fetchGeoDashboard(): Promise<GeoDashboard> {
  return api.get('/geo/dashboard') as unknown as Promise<GeoDashboard>
}

// --- 企业知识库 ---

export interface BrandKnowledgeItem {
  id: string
  user_id: string
  title: string
  content: string
  category: BrandKnowledgeCategory
  source: string
  tags: string[]
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export async function fetchGeoKnowledge(params?: {
  category?: string
  keyword?: string
  page?: number
  page_size?: number
}): Promise<{ items: BrandKnowledgeItem[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.category && params.category !== 'all') query.set('category', params.category)
  if (params?.keyword) query.set('keyword', params.keyword)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/geo/knowledge?${query}`) as unknown as Promise<{ items: BrandKnowledgeItem[]; total: number }>
}

export async function createGeoKnowledge(data: {
  title: string
  content: string
  category: BrandKnowledgeCategory
  tags?: string[]
  source?: string
}): Promise<BrandKnowledgeItem> {
  return api.post('/geo/knowledge', data) as unknown as Promise<BrandKnowledgeItem>
}

export async function updateGeoKnowledge(id: string, data: {
  title?: string
  content?: string
  category?: BrandKnowledgeCategory
  tags?: string[]
  is_active?: boolean
  sort_order?: number
}): Promise<BrandKnowledgeItem> {
  return api.put(`/geo/knowledge/${id}`, data) as unknown as Promise<BrandKnowledgeItem>
}

export async function deleteGeoKnowledge(id: string): Promise<{ success: boolean }> {
  return api.delete(`/geo/knowledge/${id}`) as unknown as Promise<{ success: boolean }>
}

export async function generateGeoKnowledge(data: {
  domain?: string
  category?: BrandKnowledgeCategory
  count?: number
}): Promise<{ task_id: string; status: string }> {
  return api.post('/geo/knowledge/generate', data) as unknown as Promise<{ task_id: string; status: string }>
}

export async function getGenerateKnowledgeStatus(taskId: string): Promise<{ task_id: string; status: string; output: unknown }> {
  return api.get(`/geo/knowledge/generate/${taskId}/status`) as unknown as Promise<{ task_id: string; status: string; output: unknown }>
}

// --- 关键词蒸馏 ---

export interface DistillKeyword {
  id: string
  user_id: string
  batch_id: string
  keyword: string
  intent_type: GeoIntentType
  competition: KeywordCompetition
  brand_relevance: number
  content_opportunity: number
  total_score: number
  recommendation: string | null
  status: KeywordDistillationStatus
  domain: string | null
  created_at: string
  updated_at: string
}

export interface DistillBatch {
  batch_id: string
  domain: string | null
  created_at: string
  counts: Record<string, number>
}

export async function fetchDistillBatches(): Promise<{ batches: DistillBatch[] }> {
  return api.get('/geo/distill/batches') as unknown as Promise<{ batches: DistillBatch[] }>
}

export async function fetchDistillResults(params?: {
  batch_id?: string
  status?: string
  page?: number
  page_size?: number
}): Promise<{ items: DistillKeyword[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.batch_id) query.set('batch_id', params.batch_id)
  if (params?.status && params.status !== 'all') query.set('status', params.status)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/geo/distill?${query}`) as unknown as Promise<{ items: DistillKeyword[]; total: number }>
}

export async function startDistill(data: {
  keywords: string[]
  domain?: string
}): Promise<{ task_id: string; status: string }> {
  return api.post('/geo/distill/start', data) as unknown as Promise<{ task_id: string; status: string }>
}

export async function getDistillStatus(taskId: string): Promise<{ task_id: string; status: string; output: unknown }> {
  return api.get(`/geo/distill/start/${taskId}/status`) as unknown as Promise<{ task_id: string; status: string; output: unknown }>
}

export async function importDistillToQuestions(ids: string[]): Promise<{ imported: number }> {
  return api.post('/geo/distill/import', { ids }) as unknown as Promise<{ imported: number }>
}

export async function updateDistillResult(id: string, data: {
  status: KeywordDistillationStatus
}): Promise<DistillKeyword> {
  return api.put(`/geo/distill/${id}`, data) as unknown as Promise<DistillKeyword>
}

export async function deleteDistillBatch(batchId: string): Promise<{ success: boolean }> {
  return api.delete(`/geo/distill/batch/${batchId}`) as unknown as Promise<{ success: boolean }>
}

// --- 全网搜索知识建库 ---

export interface WebKnowledgeBuildOutput {
  search_results_count: number
  knowledge_items: Array<{
    title: string
    content: string
    category: BrandKnowledgeCategory
    tags: string[]
    source_url: string
    confidence: number
  }>
  created_count: number
}

export async function searchAndBuildKnowledge(data: {
  topic: string
  category?: BrandKnowledgeCategory
  count?: number
}): Promise<{ task_id: string; status: string }> {
  return api.post('/geo/knowledge/search-and-build', data) as unknown as Promise<{ task_id: string; status: string }>
}

export async function getSearchAndBuildStatus(taskId: string): Promise<{
  task_id: string
  status: string
  output: WebKnowledgeBuildOutput | null
  error?: string | null
}> {
  return api.get(`/geo/knowledge/search-and-build/${taskId}/status`) as unknown as Promise<{
    task_id: string
    status: string
    output: WebKnowledgeBuildOutput | null
    error?: string | null
  }>
}
