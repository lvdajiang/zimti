import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchCalendarEventsByMonth,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  fetchPresetHolidays,
} from '../api/operationCalendar'
import type { CalendarEvent } from '../api/operationCalendar'
import type { CalendarEventType } from '@zimti/shared'

export const useOperationCalendarStore = defineStore('operationCalendar', () => {
  const events = ref<CalendarEvent[]>([])
  const loading = ref(false)

  async function loadEventsByMonth(year: number, month: number): Promise<void> {
    loading.value = true
    try {
      const res = await fetchCalendarEventsByMonth(year, month)
      events.value = res.items
    } finally {
      loading.value = false
    }
  }

  async function addEvent(data: {
    event_date: string
    title: string
    event_type: CalendarEventType
    content?: CalendarEvent['content']
    remind_at?: string
  }): Promise<string> {
    const res = await createCalendarEvent(data)
    return res.id
  }

  async function editEvent(id: string, data: {
    title?: string
    event_type?: CalendarEventType
    content?: CalendarEvent['content']
    remind_at?: string
  }): Promise<void> {
    await updateCalendarEvent(id, data)
  }

  async function removeEvent(id: string): Promise<void> {
    await deleteCalendarEvent(id)
  }

  async function loadPresetHolidays(year: number): Promise<CalendarEvent[]> {
    const res = await fetchPresetHolidays(year)
    return res.items
  }

  return {
    events,
    loading,
    loadEventsByMonth,
    addEvent,
    editEvent,
    removeEvent,
    loadPresetHolidays,
  }
})
