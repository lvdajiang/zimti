import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchInterviewLayers, startInterview, nextInterviewQuestion, generateIpProfile,
  fetchIndustryTemplates, applyIndustryTemplate, initIndustryTemplates,
} from '../api/interview'
import type { InterviewQuestionLayer, InterviewSession, IndustryTemplate, IpProfile } from '../api/interview'

export const useInterviewStore = defineStore('interview', () => {
  // IP 访谈
  const layers = ref<InterviewQuestionLayer[]>([])
  const session = ref<InterviewSession | null>(null)
  const currentQuestion = ref<string | null>(null)
  const isComplete = ref(false)
  const profile = ref<IpProfile | null>(null)
  const loading = ref(false)
  const profileLoading = ref(false)
  const currentAnswer = ref('')

  // 行业模板
  const templates = ref<IndustryTemplate[]>([])
  const templatesLoading = ref(false)
  const appliedConfig = ref<{
    persona_default: Record<string, unknown>
    content_types: string[]
    pipeline_presets: Record<string, boolean>
  } | null>(null)

  async function loadLayers(): Promise<void> {
    const res = await fetchInterviewLayers()
    layers.value = res.layers
  }

  async function doStart(topic: string): Promise<void> {
    loading.value = true
    try {
      const res = await startInterview(topic)
      session.value = res.session
      currentQuestion.value = `请聊聊${topic}相关的基本经历。你最近做了什么？`
      isComplete.value = false
      profile.value = null
    } finally {
      loading.value = false
    }
  }

  async function doNext(): Promise<void> {
    if (!session.value || !currentAnswer.value.trim()) return
    loading.value = true
    try {
      const res = await nextInterviewQuestion({
        session: session.value,
        answer: currentAnswer.value.trim(),
      })
      session.value = res.session
      currentQuestion.value = res.nextQuestion
      isComplete.value = res.isComplete
      currentAnswer.value = ''
    } finally {
      loading.value = false
    }
  }

  async function doGenerateProfile(): Promise<void> {
    if (!session.value) return
    profileLoading.value = true
    try {
      profile.value = await generateIpProfile({ session: session.value })
    } finally {
      profileLoading.value = false
    }
  }

  async function loadTemplates(industry?: string): Promise<void> {
    templatesLoading.value = true
    try {
      const res = await fetchIndustryTemplates(industry ? { industry } : undefined)
      templates.value = res.items
    } finally {
      templatesLoading.value = false
    }
  }

  async function doApplyTemplate(id: string): Promise<void> {
    appliedConfig.value = await applyIndustryTemplate(id)
  }

  async function doInitPresets(): Promise<number> {
    const res = await initIndustryTemplates()
    await loadTemplates()
    return res.created
  }

  return {
    layers, session, currentQuestion, isComplete, profile, loading, profileLoading, currentAnswer,
    templates, templatesLoading, appliedConfig,
    loadLayers, doStart, doNext, doGenerateProfile,
    loadTemplates, doApplyTemplate, doInitPresets,
  }
})
