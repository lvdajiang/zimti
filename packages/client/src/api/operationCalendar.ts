import api from './client'
import type { CalendarEventType } from '@zimti/shared'

// --- 类型定义 ---

export interface CalendarEvent {
  id: string
  event_date: string
  title: string
  event_type: CalendarEventType
  content: {
    moments_plan?: string
    chat_script?: string
    campaign_plan?: string
  } | null
  remind_at: string | null
  created_at: string
  updated_at: string
}

// --- API ---

export async function fetchCalendarEventsByMonth(year: number, month: number): Promise<{ items: CalendarEvent[] }> {
  return api.get(`/operation-calendar/events/${year}/${month}`) as unknown as Promise<{ items: CalendarEvent[] }>
}

export async function createCalendarEvent(data: {
  event_date: string
  title: string
  event_type: CalendarEventType
  content?: CalendarEvent['content']
  remind_at?: string
}): Promise<{ id: string }> {
  return api.post('/operation-calendar/events', data) as unknown as Promise<{ id: string }>
}

export async function updateCalendarEvent(id: string, data: {
  title?: string
  event_type?: CalendarEventType
  content?: CalendarEvent['content']
  remind_at?: string
}): Promise<{ id: string }> {
  return api.put(`/operation-calendar/events/${id}`, data) as unknown as Promise<{ id: string }>
}

export async function deleteCalendarEvent(id: string): Promise<{ success: boolean }> {
  return api.delete(`/operation-calendar/events/${id}`) as unknown as Promise<{ success: boolean }>
}

export async function fetchPresetHolidays(year: number): Promise<{ items: CalendarEvent[] }> {
  return api.get(`/operation-calendar/preset-holidays?year=${year}`) as unknown as Promise<{ items: CalendarEvent[] }>
}
