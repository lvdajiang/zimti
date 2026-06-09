import api from './client'
import type { ProhibitedCheckReport, ProhibitedCheckItem } from '@zimti/shared'

// --- 类型定义 ---

export interface CopyWritingItem {
  id: string
  user_id: string
  topic_id: number | null
  hotspot_ids: number[]
  title: string
  content: string
  structure: Record<string, unknown>
  version: number
  parent_id: string | null
  status: 'draft' | 'checking' | 'finalized'
  prohibited_report: ProhibitedCheckReport | null
  created_at: string
  updated_at: string
}

// --- API 调用 ---

/** 列表 */
export async function fetchCopyWritings(params?: { topic_id?: number; status?: string }) {
  return api.get('/copy-writings', { params }) as unknown as Promise<CopyWritingItem[]>
}

/** 详情 */
export async function fetchCopyWriting(id: string) {
  return api.get(`/copy-writings/${id}`) as unknown as Promise<CopyWritingItem & { versions: CopyWritingItem[] }>
}

/** 创建 */
export async function createCopyWriting(params: {
  topic_id?: number
  title: string
  content?: string
  hotspot_ids?: number[]
}) {
  return api.post('/copy-writings', params) as unknown as Promise<CopyWritingItem>
}

/** AI 生成初稿 */
export async function generateCopyDraft(params: {
  topic_id?: number
  task_id?: string
  brand_context?: string
  platform?: string
}) {
  return api.post('/copy-writings/generate', params) as unknown as Promise<CopyWritingItem>
}

/** AI 改写 */
export async function rewriteCopy(id: string, params: {
  instruction?: string
  selected_text?: string
  brand_context?: string
}) {
  return api.post(`/copy-writings/${id}/rewrite`, params) as unknown as Promise<CopyWritingItem>
}

/** 更新内容 */
export async function updateCopyWriting(id: string, params: {
  title?: string
  content?: string
  structure?: Record<string, unknown>
}) {
  return api.put(`/copy-writings/${id}`, params) as unknown as Promise<CopyWritingItem>
}

/** 违禁词检测 */
export async function checkProhibited(id: string, platforms?: string[]) {
  return api.post(`/copy-writings/${id}/check`, { platforms }) as unknown as Promise<ProhibitedCheckReport>
}

/** 一键替换违禁词 */
export async function replaceProhibited(id: string, items: ProhibitedCheckItem[]) {
  return api.post(`/copy-writings/${id}/replace`, { items }) as unknown as Promise<CopyWritingItem>
}

/** 确认定稿 */
export async function finalizeCopy(id: string) {
  return api.post(`/copy-writings/${id}/finalize`) as unknown as Promise<CopyWritingItem>
}

/** 转为脚本 */
export async function copyToScript(id: string) {
  return api.post(`/copy-writings/${id}/to-script`) as unknown as Promise<{ id: number; topic_id: number; full_text: string; status: string }>
}
