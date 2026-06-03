/**
 * GEO 优化 Store
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchGeoQuestions, createGeoQuestion, updateGeoQuestion, deleteGeoQuestion,
  generateGeoQuestions, getGenerateQuestionsStatus, batchCreateGeoQuestions,
  fetchGeoContents, fetchGeoContent, createGeoContent, updateGeoContent,
  deleteGeoContent, generateGeoContent, getGenerateContentStatus,
  batchGenerateGeoContent, getBatchGenerateStatus, fetchSchemaPreview,
  fetchGeoMentions, checkGeoMentions, getCheckMentionsStatus, fetchGeoDashboard,
} from '../api/geo'
import type { GeoQuestion, GeoContent, GeoMention, GeoDashboard } from '../api/geo'
import type { GeoQuestionCategory, GeoIntentType } from '@zimti/shared'

export const useGeoStore = defineStore('geo', () => {
  // --- 问题库 ---
  const questions = ref<GeoQuestion[]>([])
  const questionsTotal = ref(0)
  const questionsLoading = ref(false)
  const questionPage = ref(1)
  const filterCategory = ref<string>('all')
  const filterIntentType = ref<string>('all')
  const searchKeyword = ref('')

  const generatingQuestions = ref(false)
  const generateQuestionsTaskId = ref<string | null>(null)

  // --- 内容 ---
  const contents = ref<GeoContent[]>([])
  const contentsTotal = ref(0)
  const contentsLoading = ref(false)
  const currentContent = ref<GeoContent | null>(null)
  const generatingContent = ref(false)

  // --- 监测 ---
  const mentions = ref<GeoMention[]>([])
  const mentionsTotal = ref(0)
  const checkingMentions = ref(false)
  const dashboard = ref<GeoDashboard | null>(null)

  // --- 问题库操作 ---

  async function loadQuestions(): Promise<void> {
    questionsLoading.value = true
    try {
      const res = await fetchGeoQuestions({
        category: filterCategory.value,
        intent_type: filterIntentType.value,
        keyword: searchKeyword.value || undefined,
        page: questionPage.value,
      })
      questions.value = res.items
      questionsTotal.value = res.total
    } finally {
      questionsLoading.value = false
    }
  }

  async function addQuestion(data: {
    question: string
    category?: GeoQuestionCategory
    intent_type?: GeoIntentType
    tags?: string[]
  }): Promise<void> {
    await createGeoQuestion(data)
    await loadQuestions()
  }

  async function editQuestion(id: string, data: {
    question?: string
    category?: GeoQuestionCategory
    intent_type?: GeoIntentType
    tags?: string[]
  }): Promise<void> {
    await updateGeoQuestion(id, data)
    await loadQuestions()
  }

  async function removeQuestion(id: string): Promise<void> {
    await deleteGeoQuestion(id)
    await loadQuestions()
  }

  async function startGenerateQuestions(data: {
    domain?: string
    category?: GeoQuestionCategory
    count?: number
  }): Promise<string> {
    generatingQuestions.value = true
    try {
      const res = await generateGeoQuestions(data)
      generateQuestionsTaskId.value = res.task_id
      return res.task_id
    } finally {
      generatingQuestions.value = false
    }
  }

  async function importGeneratedQuestions(questions: Array<{
    question: string
    category?: string
    intent_type?: string
  }>): Promise<number> {
    const res = await batchCreateGeoQuestions(questions)
    await loadQuestions()
    return res.created
  }

  // --- 内容操作 ---

  async function loadContents(params?: {
    status?: string
    question_id?: string
    page?: number
  }): Promise<void> {
    contentsLoading.value = true
    try {
      const res = await fetchGeoContents(params)
      contents.value = res.items
      contentsTotal.value = res.total
    } finally {
      contentsLoading.value = false
    }
  }

  async function loadContent(id: string): Promise<void> {
    currentContent.value = await fetchGeoContent(id)
  }

  async function editContent(id: string, data: {
    title?: string
    content?: string
    keywords?: string[]
    status?: 'draft' | 'published' | 'archived'
  }): Promise<void> {
    await updateGeoContent(id, data)
    if (currentContent.value?.id === id) {
      currentContent.value = await fetchGeoContent(id)
    }
  }

  async function removeContent(id: string): Promise<void> {
    await deleteGeoContent(id)
    await loadContents()
  }

  async function startGenerateContent(questionId: string): Promise<string> {
    generatingContent.value = true
    try {
      const res = await generateGeoContent({ question_id: questionId })
      return res.task_id
    } finally {
      generatingContent.value = false
    }
  }

  async function startBatchGenerate(questionIds: string[], domain?: string): Promise<string> {
    generatingContent.value = true
    try {
      const res = await batchGenerateGeoContent({ question_ids: questionIds, domain })
      return res.task_id
    } finally {
      generatingContent.value = false
    }
  }

  async function loadSchemaPreview(id: string): Promise<Record<string, unknown>> {
    const res = await fetchSchemaPreview(id)
    return res.schema_markup
  }

  // --- 监测操作 ---

  async function loadMentions(params?: {
    search_engine?: string
    content_id?: string
  }): Promise<void> {
    const res = await fetchGeoMentions(params)
    mentions.value = res.items
    mentionsTotal.value = res.total
  }

  async function startCheckMentions(contentIds: string[], engines?: string[]): Promise<string> {
    checkingMentions.value = true
    try {
      const res = await checkGeoMentions({ content_ids: contentIds, search_engines: engines })
      return res.task_id
    } finally {
      checkingMentions.value = false
    }
  }

  async function loadDashboard(): Promise<void> {
    dashboard.value = await fetchGeoDashboard()
  }

  return {
    // 问题库
    questions, questionsTotal, questionsLoading, questionPage,
    filterCategory, filterIntentType, searchKeyword,
    generatingQuestions, generateQuestionsTaskId,
    loadQuestions, addQuestion, editQuestion, removeQuestion,
    startGenerateQuestions, importGeneratedQuestions,
    // 内容
    contents, contentsTotal, contentsLoading, currentContent,
    generatingContent,
    loadContents, loadContent, editContent, removeContent,
    startGenerateContent, startBatchGenerate, loadSchemaPreview,
    // 监测
    mentions, mentionsTotal, checkingMentions, dashboard,
    loadMentions, startCheckMentions, loadDashboard,
  }
})
