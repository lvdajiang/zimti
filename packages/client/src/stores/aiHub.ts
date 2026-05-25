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

  async function loadBrandMemory(category?: BrandMemoryCategory): Promise<void> {
    memoriesLoading.value = true
    try {
      const res = await fetchBrandMemory(category ? { category } : undefined)
      brandProfile.value = res.profile
      brandMemories.value = res.items
    } finally {
      memoriesLoading.value = false
    }
  }

  async function saveBrandMemory(items: Array<{
    category: BrandMemoryCategory
    key: string
    value: unknown
  }>): Promise<void> {
    await upsertBrandMemory(items)
    await loadBrandMemory()
  }

  async function removeBrandMemory(id: string): Promise<void> {
    await deleteBrandMemory(id)
    await loadBrandMemory()
  }

  async function doLearn(data: {
    category: BrandMemoryCategory
    before: string
    after: string
  }): Promise<string[]> {
    learningLoading.value = true
    try {
      const res = await learnBrandMemory(data)
      return res.findings
    } finally {
      learningLoading.value = false
    }
  }

  async function loadRecommendations(context?: string): Promise<void> {
    recommendationsLoading.value = true
    try {
      const res = await fetchStrategyRecommendations(context ? { context } : undefined)
      recommendations.value = res.items
    } finally {
      recommendationsLoading.value = false
    }
  }

  async function loadEvolutionLogs(params?: {
    evolution_type?: EvolutionType
    limit?: number
  }): Promise<void> {
    evolutionLoading.value = true
    try {
      const res = await fetchEvolutionLogs(params)
      evolutionLogs.value = res.items
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
