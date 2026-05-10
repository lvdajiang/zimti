import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PersonaConfig, SavePersonaParams, CatchphraseItem, SampleFile } from '@/api/persona'
import {
  fetchPersonaConfig,
  savePersonaConfig as apiSave,
} from '@/api/persona'

export const usePersonaStore = defineStore('persona', () => {
  const config = ref<PersonaConfig | null>(null)
  const loading = ref(false)
  const cachedAt = ref<number | null>(null)
  const CACHE_TTL = 300000

  const isCacheValid = (): boolean => {
    if (!cachedAt.value) return false
    return Date.now() - cachedAt.value < CACHE_TTL
  }

  async function loadConfig(): Promise<void> {
    if (config.value && isCacheValid()) return
    loading.value = true
    try {
      config.value = await fetchPersonaConfig()
      cachedAt.value = Date.now()
    } finally {
      loading.value = false
    }
  }

  async function getConfig(): Promise<PersonaConfig> {
    if (config.value && isCacheValid()) return config.value
    await loadConfig()
    return config.value!
  }

  async function saveConfig(params: SavePersonaParams): Promise<void> {
    await apiSave(params)
    cachedAt.value = null
    await loadConfig()
    window.dispatchEvent(new CustomEvent('persona-config-updated'))
  }

  function getCatchphrasesByType(type: CatchphraseItem['type']): string[] {
    return config.value?.catchphrases
      ?.filter(c => c.type === type)
      .map(c => c.content) ?? []
  }

  function getAllSampleFiles(): SampleFile[] {
    const texts = config.value?.sample_texts ?? []
    const audios = config.value?.sample_audios ?? []
    return [
      ...texts.map(f => ({ ...f, type: 'text' as const })),
      ...audios.map(f => ({ ...f, type: 'audio' as const })),
    ]
  }

  function clearCache(): void {
    config.value = null
    cachedAt.value = null
  }

  return {
    config,
    loading,
    loadConfig,
    getConfig,
    saveConfig,
    getCatchphrasesByType,
    getAllSampleFiles,
    clearCache,
  }
})
