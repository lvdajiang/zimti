import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  startExtractFacts, getExtractStatus,
  startVerifyFacts, getVerifyStatus,
  fetchFacts, updateFact,
} from '../api/factExtract'
import type { ExtractResult, FactRecord } from '../api/factExtract'

export const useFactExtractStore = defineStore('factExtract', () => {
  // 提取状态
  const extracting = ref(false)
  const extractTaskId = ref<string | null>(null)
  const extractResult = ref<ExtractResult | null>(null)

  // 验证状态
  const verifying = ref(false)

  // 事实库
  const factsList = ref<FactRecord[]>([])
  const factsTotal = ref(0)
  const factsLoading = ref(false)

  // 输入
  const transcript = ref('')
  const topic = ref('')
  const autoVerify = ref(true)

  async function startExtract(): Promise<void> {
    extracting.value = true
    extractResult.value = null
    try {
      const res = await startExtractFacts({
        transcript: transcript.value,
        topic: topic.value || undefined,
        verify: autoVerify.value,
      })
      extractTaskId.value = res.task_id
      await pollExtract(res.task_id)
    } finally {
      extracting.value = false
    }
  }

  async function pollExtract(tid: string): Promise<void> {
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const res = await getExtractStatus(tid)
      if (res.status === 'success') {
        extractResult.value = res.output as ExtractResult
        return
      }
      if (res.status === 'failed') {
        throw new Error(res.error || '事实提取失败')
      }
    }
    throw new Error('提取超时')
  }

  async function loadFacts(params?: {
    fact_type?: string
    verification_status?: string
    keyword?: string
    page?: number
  }): Promise<void> {
    factsLoading.value = true
    try {
      const res = await fetchFacts(params)
      factsList.value = res.items
      factsTotal.value = res.total
    } finally {
      factsLoading.value = false
    }
  }

  async function verifySelected(factIds: string[]): Promise<void> {
    verifying.value = true
    try {
      const res = await startVerifyFacts(factIds)
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const status = await getVerifyStatus(res.task_id)
        if (status.status === 'success') {
          await loadFacts()
          return
        }
        if (status.status === 'failed') throw new Error('验证失败')
      }
    } finally {
      verifying.value = false
    }
  }

  async function editFact(id: string, data: {
    content?: string
    factType?: string
    verificationStatus?: string
    tags?: string[]
    is_active?: boolean
  }): Promise<void> {
    await updateFact(id, data)
    await loadFacts()
  }

  return {
    extracting, extractTaskId, extractResult,
    verifying,
    factsList, factsTotal, factsLoading,
    transcript, topic, autoVerify,
    startExtract, loadFacts, verifySelected, editFact,
  }
})
