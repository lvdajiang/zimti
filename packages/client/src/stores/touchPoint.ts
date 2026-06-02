import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchTouchPoints,
  createTouchPoint,
  fetchTodayTouchTasks,
  fetchCustomerTouchHistory,
} from '../api/touchPoint'
import type { TouchPoint } from '../api/touchPoint'
import type { TouchPointType } from '@zimti/shared'

export const useTouchPointStore = defineStore('touchPoint', () => {
  const touchPoints = ref<TouchPoint[]>([])
  const todayTasks = ref<TouchPoint[]>([])
  const loading = ref(false)

  async function loadTouchPoints(customerId?: string): Promise<void> {
    loading.value = true
    try {
      const res = await fetchTouchPoints({ customer_id: customerId })
      touchPoints.value = res.items
    } finally {
      loading.value = false
    }
  }

  async function addTouchPoint(data: {
    customer_id: string
    touch_type: TouchPointType
    content_summary: string
    response?: string
  }): Promise<string> {
    const res = await createTouchPoint(data)
    return res.id
  }

  async function loadTodayTasks(): Promise<void> {
    loading.value = true
    try {
      const res = await fetchTodayTouchTasks()
      todayTasks.value = res.items
    } finally {
      loading.value = false
    }
  }

  async function loadCustomerHistory(customerId: string): Promise<TouchPoint[]> {
    const res = await fetchCustomerTouchHistory(customerId)
    return res.items
  }

  return {
    touchPoints,
    todayTasks,
    loading,
    loadTouchPoints,
    addTouchPoint,
    loadTodayTasks,
    loadCustomerHistory,
  }
})
