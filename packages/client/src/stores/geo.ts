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
  fetchGeoKnowledge, createGeoKnowledge, updateGeoKnowledge, deleteGeoKnowledge,
  generateGeoKnowledge, getGenerateKnowledgeStatus,
  fetchDistillBatches, fetchDistillResults, startDistill, getDistillStatus,
  importDistillToQuestions, updateDistillResult, deleteDistillBatch,
  searchAndBuildKnowledge, getSearchAndBuildStatus,
} from '../api/geo'
import type { GeoQuestion, GeoContent, GeoMention, GeoDashboard, BrandKnowledgeItem, DistillKeyword, DistillBatch, WebKnowledgeBuildOutput } from '../api/geo'
import type { GeoQuestionCategory, GeoIntentType, BrandKnowledgeCategory, KeywordDistillationStatus } from '@zimti/shared'

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

  // --- 知识库 ---

  const knowledgeItems = ref<BrandKnowledgeItem[]>([])
  const knowledgeTotal = ref(0)
  const knowledgeLoading = ref(false)
  const knowledgeFilterCategory = ref<string>('all')
  const generatingKnowledge = ref(false)

  // --- 全网搜索建库 ---
  const searchAndBuilding = ref(false)
  const searchBuildTaskId = ref<string | null>(null)
  const searchBuildResult = ref<WebKnowledgeBuildOutput | null>(null)

  async function loadKnowledge(): Promise<void> {
    knowledgeLoading.value = true
    try {
      const res = await fetchGeoKnowledge({
        category: knowledgeFilterCategory.value,
        keyword: searchKeyword.value || undefined,
      })
      knowledgeItems.value = res.items
      knowledgeTotal.value = res.total
    } finally {
      knowledgeLoading.value = false
    }
  }

  async function addKnowledge(data: {
    title: string
    content: string
    category: BrandKnowledgeCategory
    tags?: string[]
  }): Promise<void> {
    await createGeoKnowledge(data)
    await loadKnowledge()
  }

  async function editKnowledge(id: string, data: {
    title?: string
    content?: string
    category?: BrandKnowledgeCategory
    tags?: string[]
    is_active?: boolean
    sort_order?: number
  }): Promise<void> {
    await updateGeoKnowledge(id, data)
    await loadKnowledge()
  }

  async function removeKnowledge(id: string): Promise<void> {
    await deleteGeoKnowledge(id)
    await loadKnowledge()
  }

  async function startGenerateKnowledge(data: {
    domain?: string
    category?: BrandKnowledgeCategory
    count?: number
  }): Promise<string> {
    generatingKnowledge.value = true
    try {
      const res = await generateGeoKnowledge(data)
      return res.task_id
    } finally {
      generatingKnowledge.value = false
    }
  }

  async function startSearchAndBuild(data: {
    topic: string
    category?: BrandKnowledgeCategory
    count?: number
  }): Promise<string> {
    searchAndBuilding.value = true
    searchBuildResult.value = null
    try {
      const res = await searchAndBuildKnowledge(data)
      searchBuildTaskId.value = res.task_id
      return res.task_id
    } finally {
      searchAndBuilding.value = false
    }
  }

  async function pollSearchAndBuild(taskId: string): Promise<WebKnowledgeBuildOutput | null> {
    const res = await getSearchAndBuildStatus(taskId)
    if (res.status === 'completed' && res.output) {
      searchBuildResult.value = res.output
      searchBuildTaskId.value = null
      await loadKnowledge() // 刷新知识库列表
    }
    return res.output
  }

  // --- 关键词蒸馏 ---

  const distillResults = ref<DistillKeyword[]>([])
  const distillResultsTotal = ref(0)
  const distillLoading = ref(false)
  const distillBatches = ref<DistillBatch[]>([])
  const currentBatchId = ref<string | null>(null)
  const distilling = ref(false)

  async function loadDistillBatches(): Promise<void> {
    const res = await fetchDistillBatches()
    distillBatches.value = res.batches
    // 默认选中最新批次
    if (!currentBatchId.value && res.batches.length > 0) {
      currentBatchId.value = res.batches[0].batch_id
    }
  }

  async function loadDistillResults(): Promise<void> {
    if (!currentBatchId.value) return
    distillLoading.value = true
    try {
      const res = await fetchDistillResults({ batch_id: currentBatchId.value, page_size: 100 })
      distillResults.value = res.items
      distillResultsTotal.value = res.total
    } finally {
      distillLoading.value = false
    }
  }

  async function startKeywordDistill(keywords: string[], domain?: string): Promise<string> {
    distilling.value = true
    try {
      const res = await startDistill({ keywords, domain })
      return res.task_id
    } finally {
      distilling.value = false
    }
  }

  async function importSelectedToQuestions(ids: string[]): Promise<number> {
    const res = await importDistillToQuestions(ids)
    await loadDistillResults()
    return res.imported
  }

  async function updateDistillStatus(id: string, status: KeywordDistillationStatus): Promise<void> {
    await updateDistillResult(id, { status })
    await loadDistillResults()
  }

  async function removeDistillBatch(batchId: string): Promise<void> {
    await deleteDistillBatch(batchId)
    if (currentBatchId.value === batchId) {
      currentBatchId.value = null
      distillResults.value = []
    }
    await loadDistillBatches()
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
    // 知识库
    knowledgeItems, knowledgeTotal, knowledgeLoading,
    knowledgeFilterCategory, generatingKnowledge,
    loadKnowledge, addKnowledge, editKnowledge, removeKnowledge,
    startGenerateKnowledge,
    // 全网搜索建库
    searchAndBuilding, searchBuildTaskId, searchBuildResult,
    startSearchAndBuild, pollSearchAndBuild,
    // 关键词蒸馏
    distillResults, distillResultsTotal, distillLoading,
    distillBatches, currentBatchId, distilling,
    loadDistillBatches, loadDistillResults, startKeywordDistill,
    importSelectedToQuestions, updateDistillStatus, removeDistillBatch,
  }
})
