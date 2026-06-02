import api from './client'
import type { TouchPointType } from '@zimti/shared'

// --- 类型定义 ---

export interface TouchPoint {
  id: string
  customer_id: string
  touch_type: TouchPointType
  content_summary: string
  response: string | null
  created_at: string
  customer?: { name: string }
}

// --- API ---

export async function fetchTouchPoints(params?: {
  customer_id?: string
}): Promise<{ items: TouchPoint[] }> {
  const query = new URLSearchParams()
  if (params?.customer_id) query.set('customer_id', params.customer_id)
  return api.get(`/touch-points?${query}`) as unknown as Promise<{ items: TouchPoint[] }>
}

export async function createTouchPoint(data: {
  customer_id: string
  touch_type: TouchPointType
  content_summary: string
  response?: string
}): Promise<{ id: string }> {
  return api.post('/touch-points', data) as unknown as Promise<{ id: string }>
}

export async function fetchTodayTouchTasks(): Promise<{ items: TouchPoint[] }> {
  return api.get('/touch-points/today-tasks') as unknown as Promise<{ items: TouchPoint[] }>
}

export async function fetchCustomerTouchHistory(customerId: string): Promise<{ items: TouchPoint[] }> {
  return api.get(`/touch-points/customer/${customerId}`) as unknown as Promise<{ items: TouchPoint[] }>
}
