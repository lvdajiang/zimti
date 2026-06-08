/**
 * 知识库构建引擎 Store
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  startKnowledgeBuild, confirmBuildPlan, getKnowledgeBuildStatus, executeBuildStep,
  cancelKnowledgeBuild, fetchDistillByDomain,
  fetchKnowledgeSchedules, createKnowledgeSchedule, updateKnowledgeSchedule,
  deleteKnowledgeSchedule, triggerKnowledgeSchedule,
} from '../api/knowledgeBuild'
import type { KnowledgeBuildJobRecord, KnowledgeBuildStepRecord, KnowledgeBuildScheduleRecord } from '@zimti/shared'
import type { KnowledgeBuildMode, KnowledgeBuildStepType } from '@zimti/shared'

export const useKnowledgeBuildStore = defineStore('knowledgeBuild', () => {
  // --- 构建任务状态 ---
  const currentJob = ref<KnowledgeBuildJobRecord | null>(null)
  const jobSteps = ref<KnowledgeBuildStepRecord[]>([])
  const building = ref(false)
  const buildMode = ref<KnowledgeBuildMode>('auto')
  const planConfirmed = ref(false)  // 用户是否已确认方案

  // --- 定时任务 ---
  const schedules = ref<KnowledgeBuildScheduleRecord[]>([])
  const schedulesLoading = ref(false)

  // --- 构建主题输入 ---
  const buildTopic = ref('')
  const buildCategory = ref('')
  const availableKeywords = ref<Array<{ id: string; keyword: string; intentType: string; totalScore: number; competition: string; batchId: string }>>([])
  const useDistilledKeywords = ref(true)

  /** 加载主题对应的可用蒸馏关键词 */
  async function loadAvailableKeywords(topic: string): Promise<void> {
    if (!topic.trim()) {
      availableKeywords.value = []
      return
    }
    try {
      const res = await fetchDistillByDomain(topic.trim())
      availableKeywords.value = res.keywords
    } catch {
      availableKeywords.value = []
    }
  }

  /** 获取评估步骤的方案数据 */
  function getEvaluationPlan(): Record<string, unknown> | null {
    // API 可能返回 step_type 或 stepType（camelCase）
    const evalStep = jobSteps.value.find(s =>
      (s as Record<string, unknown>).step_type === 'evaluation' ||
      (s as Record<string, unknown>).stepType === 'evaluation'
    )
    return evalStep?.output ?? null
  }

  // === 构建任务 ===

  async function startBuild(data: { topic: string; mode?: KnowledgeBuildMode }): Promise<string> {
    building.value = true
    buildMode.value = data.mode || 'auto'
    planConfirmed.value = false
    try {
      // 自动附带可用蒸馏关键词的批次 ID
      const distillBatchIds = (useDistilledKeywords.value && availableKeywords.value.length > 0)
        ? [...new Set(availableKeywords.value.map(k => k.batchId))]
        : undefined

      const res = await startKnowledgeBuild({
        topic: data.topic,
        mode: data.mode,
        distillBatchIds,
      })
      // 等待评估步骤完成，轮询获取结果
      await pollEvaluation(res.job_id)
      return res.job_id
    } finally {
      building.value = false
    }
  }

  /** 轮询等待评估步骤完成 */
  async function pollEvaluation(jobId: string): Promise<void> {
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 2000))
      await loadBuildStatus(jobId)
      const evalStep = jobSteps.value.find(s =>
        (s as Record<string, unknown>).step_type === 'evaluation' ||
        (s as Record<string, unknown>).stepType === 'evaluation'
      )
      const status = (evalStep as Record<string, unknown>)?.status as string | undefined
      if (status === 'completed') {
        return  // 评估完成
      }
      if (status === 'failed') {
        throw new Error('评估步骤失败')
      }
      const jobStatus = (currentJob.value as Record<string, unknown>)?.status as string | undefined
      if (jobStatus === 'failed') {
        throw new Error('构建任务失败')
      }
    }
    throw new Error('评估超时')
  }

  /** 确认评估方案，继续执行后续步骤 */
  async function confirmPlan(jobId: string, adjustedDimensions?: string[]): Promise<void> {
    building.value = true
    planConfirmed.value = true
    try {
      await confirmBuildPlan(jobId, adjustedDimensions ? { adjustedDimensions } : undefined)
      // auto 模式：轮询直到完成；step 模式：只加载当前状态
      if (buildMode.value === 'auto') {
        await pollBuild(jobId)
      } else {
        await loadBuildStatus(jobId)
      }
    } finally {
      building.value = false
    }
  }

  async function loadBuildStatus(jobId: string): Promise<void> {
    const res = await getKnowledgeBuildStatus(jobId)
    currentJob.value = res
    jobSteps.value = res.steps || []
  }

  async function executeStep(jobId: string, stepType: KnowledgeBuildStepType): Promise<void> {
    const res = await executeBuildStep(jobId, stepType)
    currentJob.value = res
    jobSteps.value = res.steps || []
  }

  async function cancelBuild(jobId: string): Promise<void> {
    await cancelKnowledgeBuild(jobId)
    currentJob.value = null
    jobSteps.value = []
  }

  /** 轮询构建状态（用于 auto 模式），最多 6 分钟 */
  async function pollBuild(jobId: string): Promise<boolean> {
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 3000))
      await loadBuildStatus(jobId)
      const status = currentJob.value?.status
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return status === 'completed'
      }
    }
    return false
  }

  // === 定时任务 ===

  async function loadSchedules(): Promise<void> {
    schedulesLoading.value = true
    try {
      const res = await fetchKnowledgeSchedules()
      schedules.value = res.schedules
    } finally {
      schedulesLoading.value = false
    }
  }

  async function createSchedule(data: { topic: string; category?: string; count?: number; cronExpr: string }): Promise<void> {
    await createKnowledgeSchedule(data)
    await loadSchedules()
  }

  async function updateSchedule(id: string, data: Partial<KnowledgeBuildScheduleRecord>): Promise<void> {
    await updateKnowledgeSchedule(id, data)
    await loadSchedules()
  }

  async function deleteSchedule(id: string): Promise<void> {
    await deleteKnowledgeSchedule(id)
    await loadSchedules()
  }

  async function triggerSchedule(id: string): Promise<string> {
    const res = await triggerKnowledgeSchedule(id)
    return res.job_id
  }

  return {
    currentJob, jobSteps, building, buildMode, planConfirmed,
    buildTopic, buildCategory, availableKeywords, useDistilledKeywords,
    schedules, schedulesLoading,
    startBuild, loadBuildStatus, executeStep, cancelBuild, pollBuild,
    confirmPlan, getEvaluationPlan, loadAvailableKeywords,
    loadSchedules, createSchedule, updateSchedule, deleteSchedule, triggerSchedule,
  }
})
