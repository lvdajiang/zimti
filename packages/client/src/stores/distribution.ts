/**
 * 全渠道分发 Store
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchDistributionRecords, createDistributionRecord, updateDistributionRecord,
  deleteDistributionRecord, adaptContent, getAdaptStatus, batchAdaptContent,
  getBatchAdaptStatus, fetchDistributionCalendar, scheduleDistribution,
  publishDistribution, fetchDistributionAnalytics, fetchPlatformConfigs,
} from '../api/distribution'
import type { DistributionRecord } from '@zimti/shared'
import type { Platform } from '@zimti/shared'

export const useDistributionStore = defineStore('distribution', () => {
  const records = ref<DistributionRecord[]>([])
  const total = ref(0)
  const loading = ref(false)
  const currentPage = ref(1)
  const filterPlatform = ref<string>('all')
  const filterStatus = ref<string>('all')

  const generating = ref(false)
  const generateTaskId = ref<string | null>(null)

  const calendarItems = ref<DistributionRecord[]>([])
  const analytics = ref<{
    by_platform: Array<{ platform: string; count: number }>
    by_status: Array<{ status: string; count: number }>
    recent_published: DistributionRecord[]
  } | null>(null)

  const platformConfigs = ref<Array<Platform & { name: string; maxLength: number; tagLimit: number; optimalTimes: string[] }>>([])

  async function loadRecords(): Promise<void> {
    loading.value = true
    try {
      const res = await fetchDistributionRecords({
        platform: filterPlatform.value,
        status: filterStatus.value,
        page: currentPage.value,
      })
      records.value = res.items
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function startAdapt(data: {
    source_title: string
    source_content: string
    source_tags?: string[]
    target_platform: Platform
    brand_context?: string
  }): Promise<string> {
    generating.value = true
    try {
      const res = await adaptContent(data)
      generateTaskId.value = res.task_id
      return res.task_id
    } finally {
      generating.value = false
    }
  }

  async function startBatchAdapt(data: {
    source_title: string
    source_content: string
    source_tags?: string[]
    platforms: Platform[]
    brand_context?: string
    source_content_id?: string
    source_type?: string
  }): Promise<string> {
    generating.value = true
    try {
      const res = await batchAdaptContent(data)
      generateTaskId.value = res.task_id
      return res.task_id
    } finally {
      generating.value = false
    }
  }

  async function pollBatchAdaptStatus(taskId: string): Promise<{ done: boolean; output: unknown }> {
    const res = await getBatchAdaptStatus(taskId)
    return { done: res.status === 'success', output: res.output }
  }

  async function removeRecord(id: string): Promise<void> {
    await deleteDistributionRecord(id)
    await loadRecords()
  }

  async function loadCalendar(from?: string, to?: string): Promise<void> {
    const res = await fetchDistributionCalendar({ from, to })
    calendarItems.value = res.items
  }

  async function schedule(id: string, scheduledAt: string): Promise<void> {
    await scheduleDistribution(id, scheduledAt)
    await loadRecords()
  }

  async function publish(id: string, publishUrl?: string): Promise<void> {
    await publishDistribution(id, publishUrl)
    await loadRecords()
  }

  async function loadAnalytics(): Promise<void> {
    analytics.value = await fetchDistributionAnalytics() as unknown as typeof analytics.value
  }

  async function loadPlatformConfigs(): Promise<void> {
    const res = await fetchPlatformConfigs()
    platformConfigs.value = res.configs
  }

  return {
    records, total, loading, currentPage,
    filterPlatform, filterStatus,
    generating, generateTaskId,
    calendarItems, analytics, platformConfigs,
    loadRecords, startAdapt, startBatchAdapt, pollBatchAdaptStatus,
    removeRecord, loadCalendar, schedule, publish,
    loadAnalytics, loadPlatformConfigs,
  }
})
