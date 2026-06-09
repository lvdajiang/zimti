/**
 * 知识库构建引擎 — Pipeline 编排器
 *
 * 顺序编排 6 个步骤，每步更新 KnowledgeBuildStep 记录，
 * 支持全自动模式、分步确认模式、从指定步骤继续执行。
 */

import { prisma } from '../../db.js'
import type {
  KnowledgeBuildMode,
  KnowledgeBuildStepType,
  KnowledgeBuildJobRecord,
  KnowledgeBuildStepRecord,
  DistilledKeywordHint,
} from '@zimti/shared'
import { runEvaluate, type BuildPlan } from './stepEvaluate.js'
import { runDimensionSplit, type DimensionSplitOutput } from './stepDimensionSplit.js'
import { runMultiSearch, type MultiSearchOutput } from './stepMultiSearch.js'
import { runCredibilityFilter, type CredibilityOutput } from './stepCredibility.js'
import { runSemanticDedup, type SemanticDedupOutput } from './stepSemanticDedup.js'
import { runRefine, type RefineOutput } from './stepRefine.js'
import { runPersist, type PersistOutput } from './stepPersist.js'

// 所有步骤类型（有序，evaluation 为步骤0）
const STEP_TYPES: KnowledgeBuildStepType[] = [
  'evaluation',
  'dimension_split',
  'search',
  'credibility',
  'dedup',
  'refine',
  'persist',
]

export interface PipelineContext {
  jobId: string
  userId: string
  topic: string
  mode: KnowledgeBuildMode
  distilledKeywords?: DistilledKeywordHint[]
}

interface StepHandlerContext {
  stepType: KnowledgeBuildStepType
  stepIndex: number
  totalSteps: number
}

type StepResult =
  | BuildPlan
  | DimensionSplitOutput
  | MultiSearchOutput
  | CredibilityOutput
  | SemanticDedupOutput
  | RefineOutput
  | PersistOutput

// Prisma 返回 camelCase，Record 接口期望 snake_case — 映射辅助函数
type PrismaJob = Awaited<ReturnType<typeof prisma.knowledgeBuildJob.findUniqueOrThrow>>
type PrismaStep = NonNullable<Awaited<ReturnType<typeof prisma.knowledgeBuildStep.findFirst>>>

function mapJobRecord(j: PrismaJob): KnowledgeBuildJobRecord {
  return {
    id: j.id,
    user_id: j.userId,
    topic: j.topic,
    mode: j.mode as KnowledgeBuildMode,
    status: j.status as unknown as KnowledgeBuildJobRecord['status'],
    current_step: j.currentStep,
    progress: j.progress,
    input: j.input as Record<string, unknown>,
    output: j.output as Record<string, unknown> | null,
    error: j.error,
    started_at: j.startedAt?.toISOString() ?? null,
    completed_at: j.completedAt?.toISOString() ?? null,
    created_at: j.createdAt.toISOString(),
    updated_at: j.updatedAt.toISOString(),
  }
}

function mapStepRecord(s: PrismaStep): KnowledgeBuildStepRecord {
  return {
    id: s.id,
    job_id: s.jobId,
    step_type: s.stepType as KnowledgeBuildStepType,
    status: s.status as unknown as KnowledgeBuildStepRecord['status'],
    progress: s.progress,
    input: s.input as Record<string, unknown> | null,
    output: s.output as Record<string, unknown> | null,
    error: s.error,
    started_at: s.startedAt?.toISOString() ?? null,
    completed_at: s.completedAt?.toISOString() ?? null,
    created_at: s.createdAt.toISOString(),
  }
}

export class KnowledgeBuildPipeline {
  private ctx: PipelineContext
  private stepData: Map<KnowledgeBuildStepType, StepResult> = new Map()

  constructor(ctx: PipelineContext) {
    this.ctx = ctx
  }

  /**
   * 全自动执行全部 6 个步骤
   */
  async runAuto(): Promise<KnowledgeBuildJobRecord> {
    console.log(`[KnowledgeBuilder] 启动全自动 Pipeline — 任务: ${this.ctx.jobId}, 主题: "${this.ctx.topic}"`)

    await this.initJob()
    const result = await this.runSteps(STEP_TYPES.length)

    console.log(`[KnowledgeBuilder] Pipeline 完成 — 任务: ${this.ctx.jobId}, 状态: ${result.status}`)
    return result
  }

  /**
   * 执行到指定步骤后暂停（status = 'waiting_confirm'）
   * @param stepType 要执行到的步骤类型（该步骤完成后暂停）
   */
  async runUntil(stepType: KnowledgeBuildStepType): Promise<KnowledgeBuildJobRecord> {
    const targetIndex = STEP_TYPES.indexOf(stepType)
    if (targetIndex === -1) {
      throw new Error(`[KnowledgeBuilder] 未知步骤类型: ${stepType}`)
    }

    console.log(
      `[KnowledgeBuilder] 启动分步 Pipeline — 任务: ${this.ctx.jobId}, 执行到: ${stepType}`
    )

    await this.initJob()
    const result = await this.runSteps(targetIndex + 1, stepType)

    console.log(`[KnowledgeBuilder] Pipeline 暂停 — 任务: ${this.ctx.jobId}, 步骤: ${stepType}`)
    return result
  }

  /**
   * 从指定步骤继续执行（直到完成或下一个暂停点）
   * @param stepType 从该步骤开始继续
   */
  async continueFrom(stepType: KnowledgeBuildStepType): Promise<KnowledgeBuildJobRecord> {
    const startIndex = STEP_TYPES.indexOf(stepType)
    if (startIndex === -1) {
      throw new Error(`[KnowledgeBuilder] 未知步骤类型: ${stepType}`)
    }

    console.log(
      `[KnowledgeBuilder] 继续 Pipeline — 任务: ${this.ctx.jobId}, 从步骤: ${stepType} 继续`
    )

    // 查找已有的 stepData（从已完成的步骤中恢复）
    await this.loadStepData()

    const result = await this.runSteps(STEP_TYPES.length, undefined, startIndex)

    console.log(`[KnowledgeBuilder] Pipeline 继续 完成 — 任务: ${this.ctx.jobId}`)
    return result
  }

  /**
   * 获取任务完整状态（供 API 返回）
   */
  async getJobStatus(): Promise<KnowledgeBuildJobRecord & { steps: KnowledgeBuildStepRecord[] }> {
    const job = await prisma.knowledgeBuildJob.findUniqueOrThrow({
      where: { id: this.ctx.jobId },
    })

    const steps = await prisma.knowledgeBuildStep.findMany({
      where: { jobId: this.ctx.jobId },
      orderBy: { createdAt: 'asc' },
    })

    return { ...mapJobRecord(job), steps: steps.map(mapStepRecord) }
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /**
   * 初始化 Job 记录
   */
  private async initJob(): Promise<void> {
    await prisma.knowledgeBuildJob.update({
      where: { id: this.ctx.jobId },
      data: {
        status: 'running',
        startedAt: new Date(),
        currentStep: 0,
        progress: 0,
      },
    })
  }

  /**
   * 从已完成的步骤中加载数据（用于 continueFrom）
   */
  private async loadStepData(): Promise<void> {
    const steps = await prisma.knowledgeBuildStep.findMany({
      where: {
        jobId: this.ctx.jobId,
        status: 'completed',
      },
      orderBy: { createdAt: 'asc' },
    })

    for (const step of steps) {
      if (step.output && typeof step.output === 'object') {
        this.stepData.set(step.stepType as KnowledgeBuildStepType, step.output as unknown as StepResult)
      }
    }
  }

  /**
   * 执行步骤序列
   */
  private async runSteps(
    upToIndex: number,
    pauseAtStep?: KnowledgeBuildStepType,
    startIndex: number = 0,
  ): Promise<KnowledgeBuildJobRecord> {
    for (let i = startIndex; i < upToIndex && i < STEP_TYPES.length; i++) {
      const stepType = STEP_TYPES[i]

      try {
        await this.executeStep({
          stepType,
          stepIndex: i,
          totalSteps: STEP_TYPES.length,
        })

        // 更新进度
        const progress = Math.round(((i + 1) / STEP_TYPES.length) * 100)
        await prisma.knowledgeBuildJob.update({
          where: { id: this.ctx.jobId },
          data: { currentStep: i + 1, progress },
        })

        // 如果是最后一个要执行的步骤且需要暂停
        if (i === upToIndex - 1 && pauseAtStep) {
          await prisma.knowledgeBuildJob.update({
            where: { id: this.ctx.jobId },
            data: { status: 'waiting_confirm' },
          })
          return mapJobRecord(await prisma.knowledgeBuildJob.findUniqueOrThrow({ where: { id: this.ctx.jobId } }))
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[KnowledgeBuilder] 步骤 ${stepType} 失败: ${errorMsg}`)

        await prisma.knowledgeBuildJob.update({
          where: { id: this.ctx.jobId },
          data: { status: 'failed', error: errorMsg },
        })

        return mapJobRecord(await prisma.knowledgeBuildJob.findUniqueOrThrow({ where: { id: this.ctx.jobId } }))
      }
    }

    // 全部完成
    await prisma.knowledgeBuildJob.update({
      where: { id: this.ctx.jobId },
      data: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      },
    })

    return mapJobRecord(await prisma.knowledgeBuildJob.findUniqueOrThrow({ where: { id: this.ctx.jobId } }))
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(ctx: StepHandlerContext): Promise<void> {
    const { stepType, stepIndex, totalSteps } = ctx

    console.log(`[KnowledgeBuilder] 执行步骤 ${stepIndex + 1}/${totalSteps}: ${stepType}`)

    // 查找已有步骤记录，不存在则创建
    const existingStep = await prisma.knowledgeBuildStep.findFirst({
      where: { jobId: this.ctx.jobId, stepType },
    })

    let step
    if (existingStep) {
      step = await prisma.knowledgeBuildStep.update({
        where: { id: existingStep.id },
        data: {
          status: 'running',
          progress: 0,
          startedAt: new Date(),
          error: null,
        },
      })
    } else {
      step = await prisma.knowledgeBuildStep.create({
        data: {
          jobId: this.ctx.jobId,
          stepType,
          status: 'running',
          progress: 0,
          startedAt: new Date(),
        },
      })
    }

    try {
      const input = this.buildStepInput(stepType)
      const result = await this.runStepLogic(stepType, input)

      // 保存步骤结果到 stepData
      this.stepData.set(stepType, result)

      // 更新步骤记录
      await prisma.knowledgeBuildStep.update({
        where: { id: step.id },
        data: {
          status: 'completed',
          progress: 100,
          output: result as any,
          completedAt: new Date(),
        },
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      await prisma.knowledgeBuildStep.update({
        where: { id: step.id },
        data: {
          status: 'failed',
          error: errorMsg,
          completedAt: new Date(),
        },
      })

      throw err
    }
  }

  /**
   * 构建步骤输入参数
   */
  private buildStepInput(stepType: KnowledgeBuildStepType): Record<string, unknown> {
    switch (stepType) {
      case 'evaluation':
        return {
          topic: this.ctx.topic,
          distilledKeywords: this.ctx.distilledKeywords ?? [],
        }

      case 'dimension_split': {
        const evalResult = this.stepData.get('evaluation') as BuildPlan | undefined
        const dims = evalResult?.dimensions?.map(d => d.dimension) ?? []
        // 构建维度-关键词映射
        const mappings = evalResult?.dimensions?.map(d => ({
          dimension: d.dimension,
          keywords: d.keywords ?? [],
          searchQueries: (d.keywords && d.keywords.length > 0)
            ? d.keywords.slice(0, 3)
            : [`${this.ctx.topic} ${d.dimension}`],
          // 也包含补充关键词
          ...(d.supplementaryKeywords && d.supplementaryKeywords.length > 0
            ? { searchQueries: [...(d.keywords ?? []).slice(0, 2), ...d.supplementaryKeywords.slice(0, 1)] }
            : {}),
        })) ?? []
        return {
          topic: this.ctx.topic,
          dimensions: dims,
          dimensionMappings: mappings,
          suggestedKeywords: evalResult?.suggestedKeywords ?? [],
        }
      }

      case 'search': {
        const dimResult = this.stepData.get('dimension_split') as DimensionSplitOutput | undefined
        return {
          dimensions: dimResult?.dimensions ?? [],
          topic: this.ctx.topic,
          dimensionMappings: dimResult?.dimensionMappings ?? [],
          suggestedKeywords: dimResult?.suggestedKeywords ?? [],
        }
      }

      case 'credibility': {
        const searchResult = this.stepData.get('search') as MultiSearchOutput | undefined
        return { results: searchResult?.results ?? [] }
      }

      case 'dedup': {
        const credResult = this.stepData.get('credibility') as CredibilityOutput | undefined
        return { items: credResult?.filtered ?? [], existingKnowledge: [] }
      }

      case 'refine': {
        const dedupResult = this.stepData.get('dedup') as SemanticDedupOutput | undefined
        return { items: dedupResult?.merged ?? [], topic: this.ctx.topic }
      }

      case 'persist': {
        const refineResult = this.stepData.get('refine') as RefineOutput | undefined
        return { items: refineResult?.refined ?? [], userId: this.ctx.userId, jobId: this.ctx.jobId }
      }

      default:
        return {}
    }
  }

  /**
   * 执行步骤逻辑
   */
  private async runStepLogic(
    stepType: KnowledgeBuildStepType,
    input: Record<string, unknown>,
  ): Promise<StepResult> {
    switch (stepType) {
      case 'evaluation':
        return runEvaluate(input as { topic: string; distilledKeywords?: DistilledKeywordHint[] })

      case 'dimension_split':
        return runDimensionSplit(input as {
          topic: string
          dimensions?: string[]
          dimensionMappings?: import('@zimti/shared').DimensionKeywordMapping[]
          suggestedKeywords?: string[]
        })

      case 'search':
        return runMultiSearch(input as {
          dimensions: string[]
          topic: string
          dimensionMappings?: import('@zimti/shared').DimensionKeywordMapping[]
          suggestedKeywords?: string[]
        })

      case 'credibility':
        return runCredibilityFilter(input as { results: import('./stepMultiSearch.js').SearchRawItem[] })

      case 'dedup':
        return runSemanticDedup(input as {
          items: import('./stepCredibility.js').FilteredItem[]
          existingKnowledge: Array<{ id: string; title: string; content: string }>
        })

      case 'refine':
        return runRefine(input as { items: import('./stepSemanticDedup.js').MergedItem[]; topic: string })

      case 'persist':
        return runPersist(input as { items: import('./stepRefine.js').RefinedItem[]; userId: string; jobId: string })

      default:
        throw new Error(`[KnowledgeBuilder] 未知步骤类型: ${stepType}`)
    }
  }
}
