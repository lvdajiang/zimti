import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createViralRemindJob, createHotspotRushJob, createCustomerQuestionJob,
  fetchDailyStatus, fetchPipelineJobs, fetchPipelineJob,
} from '../api/pipeline'
import type { PipelineJob, DailyStatus } from '../api/pipeline'
import type { PipelineMode, PipelineJobStatus } from '@zimti/shared'

export const usePipelineStore = defineStore('pipeline', () => {
  const jobs = ref<PipelineJob[]>([])
  const total = ref(0)
  const loading = ref(false)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const filterMode = ref<PipelineMode | ''>('')
  const filterStatus = ref<PipelineJobStatus | ''>('')

  const dailyStatus = ref<DailyStatus | null>(null)
  const dailyLoading = ref(false)

  const currentJob = ref<PipelineJob | null>(null)
  const jobLoading = ref(false)

  async function loadJobs(): Promise<void> {
    loading.value = true
    try {
      const res = await fetchPipelineJobs({
        mode: filterMode.value || undefined,
        status: filterStatus.value || undefined,
        page: currentPage.value,
        page_size: pageSize.value,
      })
      jobs.value = res.items
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function loadDailyStatus(): Promise<void> {
    dailyLoading.value = true
    try {
      dailyStatus.value = await fetchDailyStatus()
    } finally {
      dailyLoading.value = false
    }
  }

  async function loadJob(id: string): Promise<void> {
    jobLoading.value = true
    try {
      currentJob.value = await fetchPipelineJob(id)
    } finally {
      jobLoading.value = false
    }
  }

  async function startViralRemind(data: {
    video_url?: string
    video_text?: string
  }): Promise<string> {
    const res = await createViralRemindJob(data)
    await loadJobs()
    return res.id
  }

  async function startHotspotRush(data: {
    hotspot_title: string
    hotspot_desc?: string
  }): Promise<string> {
    const res = await createHotspotRushJob(data)
    await loadJobs()
    return res.id
  }

  async function startCustomerQuestion(data: {
    question: string
    customer_ids?: string[]
  }): Promise<string> {
    const res = await createCustomerQuestionJob(data)
    await loadJobs()
    return res.id
  }

  return {
    jobs, total, loading, currentPage, pageSize,
    filterMode, filterStatus,
    dailyStatus, dailyLoading,
    currentJob, jobLoading,
    loadJobs, loadDailyStatus, loadJob,
    startViralRemind, startHotspotRush, startCustomerQuestion,
  }
})
