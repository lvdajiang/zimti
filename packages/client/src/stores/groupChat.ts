import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  uploadGroupChat,
  fetchGroupChatAnalyses,
  fetchGroupChatAnalysis,
} from '../api/groupChat'
import type { GroupChatAnalysis } from '../api/groupChat'

export const useGroupChatStore = defineStore('groupChat', () => {
  // 分析列表
  const analyses = ref<GroupChatAnalysis[]>([])
  const currentAnalysis = ref<GroupChatAnalysis | null>(null)
  const loading = ref(false)
  const uploading = ref(false)

  async function loadAnalyses(): Promise<void> {
    loading.value = true
    try {
      const res = await fetchGroupChatAnalyses()
      analyses.value = res.items
    } finally {
      loading.value = false
    }
  }

  async function loadAnalysis(id: string): Promise<void> {
    loading.value = true
    try {
      currentAnalysis.value = await fetchGroupChatAnalysis(id)
    } finally {
      loading.value = false
    }
  }

  async function uploadFile(formData: FormData): Promise<GroupChatAnalysis> {
    uploading.value = true
    try {
      const result = await uploadGroupChat(formData)
      await loadAnalyses()
      return result
    } finally {
      uploading.value = false
    }
  }

  return {
    analyses,
    currentAnalysis,
    loading,
    uploading,
    loadAnalyses,
    loadAnalysis,
    uploadFile,
  }
})
