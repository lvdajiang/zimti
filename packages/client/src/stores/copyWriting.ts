import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProhibitedCheckReport, ProhibitedCheckItem } from '@zimti/shared'
import {
  generateCopyDraft,
  fetchCopyWriting,
  rewriteCopy,
  updateCopyWriting,
  checkProhibited,
  replaceProhibited,
  finalizeCopy,
  copyToScript,
  type CopyWritingItem,
} from '@/api/copyWriting'

export const useCopyWritingStore = defineStore('copyWriting', () => {
  // --- State ---
  const currentCopy = ref<CopyWritingItem | null>(null)
  const versions = ref<CopyWritingItem[]>([])
  const prohibitedReport = ref<ProhibitedCheckReport | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // --- Computed ---
  const charCount = computed(() => currentCopy.value?.content?.length ?? 0)
  const isDraft = computed(() => currentCopy.value?.status === 'draft')
  const isFinalized = computed(() => currentCopy.value?.status === 'finalized')
  const hasProhibitedRisks = computed(() =>
    (prohibitedReport.value?.total_risks ?? 0) > 0,
  )

  // --- Actions ---

  /** AI 生成初稿 */
  async function generateDraft(params: {
    topic_id?: number
    task_id?: string
    brand_context?: string
    platform?: string
  }) {
    loading.value = true
    error.value = null
    try {
      currentCopy.value = await generateCopyDraft(params)
      versions.value = [currentCopy.value]
    } catch (e: any) {
      error.value = e.message ?? '生成失败'
    } finally {
      loading.value = false
    }
  }

  /** 手动保存 */
  async function saveContent(content: string) {
    if (!currentCopy.value) return
    try {
      currentCopy.value = await updateCopyWriting(currentCopy.value.id, { content })
    } catch (e: any) {
      error.value = e.message ?? '保存失败'
    }
  }

  /** AI 改写（全文或选中段落） */
  async function rewrite(instruction: string, selectedText?: string) {
    if (!currentCopy.value) return
    loading.value = true
    error.value = null
    try {
      currentCopy.value = await rewriteCopy(currentCopy.value.id, {
        instruction,
        selected_text: selectedText,
      })
      versions.value.push(currentCopy.value)
    } catch (e: any) {
      error.value = e.message ?? '改写失败'
    } finally {
      loading.value = false
    }
  }

  /** 违禁词检测 */
  async function doCheck(platforms?: string[]) {
    if (!currentCopy.value) return
    loading.value = true
    error.value = null
    try {
      prohibitedReport.value = await checkProhibited(currentCopy.value.id, platforms)
    } catch (e: any) {
      error.value = e.message ?? '检测失败'
    } finally {
      loading.value = false
    }
  }

  /** 一键替换违禁词 */
  async function doReplace(items: ProhibitedCheckItem[]) {
    if (!currentCopy.value) return
    loading.value = true
    try {
      currentCopy.value = await replaceProhibited(currentCopy.value.id, items)
      // 替换后重新检测
      prohibitedReport.value = null
    } catch (e: any) {
      error.value = e.message ?? '替换失败'
    } finally {
      loading.value = false
    }
  }

  /** 确认定稿 */
  async function doFinalize() {
    if (!currentCopy.value) return
    loading.value = true
    try {
      currentCopy.value = await finalizeCopy(currentCopy.value.id)
    } catch (e: any) {
      error.value = e.message ?? '定稿失败'
    } finally {
      loading.value = false
    }
  }

  /** 转为脚本 */
  async function doToScript() {
    if (!currentCopy.value) return null
    loading.value = true
    try {
      return await copyToScript(currentCopy.value.id)
    } catch (e: any) {
      error.value = e.message ?? '转脚本失败'
      return null
    } finally {
      loading.value = false
    }
  }

  /** 加载已有文案 */
  async function loadCopy(id: string) {
    loading.value = true
    try {
      const result = await fetchCopyWriting(id)
      currentCopy.value = result
      versions.value = result.versions ?? [result]
    } catch (e: any) {
      error.value = e.message ?? '加载失败'
    } finally {
      loading.value = false
    }
  }

  /** 重置 */
  function reset() {
    currentCopy.value = null
    versions.value = []
    prohibitedReport.value = null
    loading.value = false
    error.value = null
  }

  return {
    currentCopy,
    versions,
    prohibitedReport,
    loading,
    error,
    charCount,
    isDraft,
    isFinalized,
    hasProhibitedRisks,
    generateDraft,
    saveContent,
    rewrite,
    doCheck,
    doReplace,
    doFinalize,
    doToScript,
    loadCopy,
    reset,
  }
})
