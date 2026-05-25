import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchBrandMemory, upsertBrandMemory, deleteBrandMemory, learnBrandMemory,
  fetchStrategyRecommendations,
  fetchEvolutionLogs,
} from '../api/aiHub'
import type { BrandMemory, StrategyRecommendation, EvolutionLog } from '../api/aiHub'
import type { BrandMemoryCategory, EvolutionType } from '@zimti/shared'

export const useAiHubStore = defineStore('aiHub', () => {
  const brandProfile = ref<Record<string, unknown> | null>(null)
  const brandMemories = ref<BrandMemory[]>([])
  const memoriesLoading = ref(false)

  const recommendations = ref<StrategyRecommendation[]>([])
  const recommendationsLoading = ref(false)

  const evolutionLogs = ref<EvolutionLog[]>([])
  const evolutionLoading = ref(false)

  const learningLoading = ref(false)

  async function loadBrandMemory(): Promise<void> {
    memoriesLoading.value = true
    try {
      const res = await fetchBrandMemory()
      brandProfile.value = res.profile
      brandMemories.value = res.items
    } finally {
      memoriesLoading.value = false
    }
  }

  async function saveBrandMemory(data: {
    category: BrandMemoryCategory
    key: string
    value: unknown
    source?: string
    weight?: number
  }): Promise<void> {
    await upsertBrandMemory(data)
    await loadBrandMemory()
  }

  async function removeBrandMemory(data: {
    category: BrandMemoryCategory
    key: string
  }): Promise<void> {
    await deleteBrandMemory(data)
    await loadBrandMemory()
  }

  async function doLearn(data: {
    original_text: string
    modified_text: string
  }): Promise<void> {
    learningLoading.value = true
    try {
      await learnBrandMemory(data)
    } finally {
      learningLoading.value = false
    }
  }

  async function loadRecommendations(): Promise<void> {
    recommendationsLoading.value = true
    try {
      const res = await fetchStrategyRecommendations()
      recommendations.value = res.recommendations
    } finally {
      recommendationsLoading.value = false
    }
  }

  async function loadEvolutionLogs(params?: {
    type?: EvolutionType
    limit?: number
  }): Promise<void> {
    evolutionLoading.value = true
    try {
      const res = await fetchEvolutionLogs(params)
      evolutionLogs.value = res.logs
    } finally {
      evolutionLoading.value = false
    }
  }

  return {
    brandProfile, brandMemories, memoriesLoading,
    recommendations, recommendationsLoading,
    evolutionLogs, evolutionLoading,
    learningLoading,
    loadBrandMemory, saveBrandMemory, removeBrandMemory, doLearn,
    loadRecommendations, loadEvolutionLogs,
  }
})
