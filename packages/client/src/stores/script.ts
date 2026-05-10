import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StoryboardSegment } from '@zimti/shared'
import type { AiCheckResult } from '@/api/script'
import {
  fetchScript,
  saveScript as apiSaveScript,
  saveSegment as apiSaveSegment,
  addSegment as apiAddSegment,
  deleteSegment as apiDeleteSegment,
  reorderSegments as apiReorderSegments,
  duplicateSegment as apiDuplicateSegment,
  saveProgress as apiSaveProgress,
} from '@/api/script'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export const useScriptStore = defineStore('script', () => {
  const scriptId = ref(0)
  const fullText = ref('')
  const videoType = ref('knowledge')
  const oralRatio = ref(0.6)
  const status = ref<'draft' | 'confirmed'>('draft')
  const segments = ref<StoryboardSegment[]>([])
  const aiResult = ref<AiCheckResult | null>(null)
  const isLoaded = ref(false)
  const saveStatus = ref<SaveStatus>('saved')
  const loading = ref(false)

  const hasUnsavedChanges = computed(() => saveStatus.value === 'unsaved')

  const estimatedDuration = computed(() => {
    const oral = segments.value.filter(s => s.segment_type === 'oral')
    return oral.reduce((sum, s) => sum + s.duration, 0)
  })

  const isReady = computed(() => scriptId.value > 0 && isLoaded.value)

  function markUnsaved(): void {
    if (saveStatus.value !== 'saving') saveStatus.value = 'unsaved'
  }

  async function load(id: number): Promise<boolean> {
    loading.value = true
    try {
      const res = await fetchScript(id)
      scriptId.value = res.id
      fullText.value = res.full_text
      videoType.value = res.video_type ?? 'knowledge'
      oralRatio.value = res.oral_ratio
      status.value = res.status as 'draft' | 'confirmed'
      segments.value = res.segments ?? []
      isLoaded.value = true
      saveStatus.value = 'saved'
      return true
    } catch (e) {
      console.error('Failed to load script:', e)
      return false
    } finally {
      loading.value = false
    }
  }

  async function save(): Promise<void> {
    if (scriptId.value === 0) return
    saveStatus.value = 'saving'
    try {
      await apiSaveScript(scriptId.value, {
        full_text: fullText.value,
        video_type: videoType.value,
        oral_ratio: oralRatio.value,
      })
      saveStatus.value = 'saved'
    } catch (e) {
      console.error(e)
      saveStatus.value = 'error'
    }
  }

  async function saveAllSegments(): Promise<void> {
    if (scriptId.value === 0) return
    saveStatus.value = 'saving'
    try {
      await apiSaveProgress(String(scriptId.value), segments.value)
      saveStatus.value = 'saved'
    } catch (e) {
      console.error(e)
      saveStatus.value = 'error'
    }
  }

  async function updateSegment(seg: StoryboardSegment): Promise<void> {
    if (scriptId.value === 0) return
    try {
      await apiSaveSegment(scriptId.value, seg.id, {
        segment_type: seg.segment_type,
        oral_text: seg.oral_text,
        visual_description: seg.visual_description,
        duration: seg.duration,
      })
    } catch (e) {
      console.error(e)
    }
  }

  async function addNewSegment(data: {
    segment_type: string
    visual_description: string
    duration: number
  }): Promise<StoryboardSegment | null> {
    if (scriptId.value === 0) return null
    try {
      const seg = await apiAddSegment(scriptId.value, data)
      segments.value.push(seg)
      markUnsaved()
      return seg
    } catch (e) {
      console.error(e)
      return null
    }
  }

  async function removeSegment(segmentId: number): Promise<void> {
    if (scriptId.value === 0) return
    try {
      await apiDeleteSegment(scriptId.value, segmentId)
      segments.value = segments.value.filter(s => s.id !== segmentId)
      markUnsaved()
    } catch (e) {
      console.error(e)
    }
  }

  async function reorder(segmentIds: number[]): Promise<void> {
    if (scriptId.value === 0) return
    try {
      await apiReorderSegments(scriptId.value, segmentIds)
      const indexed = new Map(segmentIds.map((id, idx) => [id, idx]))
      segments.value.forEach(seg => {
        const ni = indexed.get(seg.id)
        if (ni !== undefined) seg.segment_index = ni
      })
      segments.value.sort((a, b) => a.segment_index - b.segment_index)
      markUnsaved()
    } catch (e) {
      console.error(e)
      await load(scriptId.value)
    }
  }

  async function duplicate(segmentId: number): Promise<StoryboardSegment | null> {
    if (scriptId.value === 0) return null
    try {
      const seg = await apiDuplicateSegment(scriptId.value, segmentId)
      segments.value.push(seg)
      markUnsaved()
      return seg
    } catch (e) {
      console.error(e)
      return null
    }
  }

  function reset(): void {
    scriptId.value = 0
    fullText.value = ''
    videoType.value = 'knowledge'
    oralRatio.value = 0.6
    status.value = 'draft'
    segments.value = []
    aiResult.value = null
    isLoaded.value = false
    saveStatus.value = 'saved'
  }

  return {
    scriptId, fullText, videoType, oralRatio, status, segments, aiResult, isLoaded,
    saveStatus, loading,
    hasUnsavedChanges, estimatedDuration, isReady,
    markUnsaved, load, save, saveAllSegments, updateSegment,
    addNewSegment, removeSegment, reorder, duplicate, reset,
  }
})
