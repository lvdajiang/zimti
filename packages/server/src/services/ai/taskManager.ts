import { prisma } from '../../db.js'

export type AITaskStatus = 'pending' | 'running' | 'success' | 'failed'
export type AITaskType =
  | 'topic_generate'
  | 'topic_merge'
  | 'storyboard_generate'
  | 'ai_check'
  | 'ai_suggest'
  | 'voiceover_generate'
  | 'copy_generate'
  | 'copy_batch_generate'
  | 'video_analyze'
  | 'video_analyze_batch'
  | 'transcript_extract'
  | 'material_generate'
  | 'dashboard_analysis'
  | 'persona_preview'
  | 'hotspot_refresh'
  | 'geo_generate'
  | 'jimeng_t2i'
  | 'jimeng_i2v'
  | 'jimeng_t2v'
  | 'jimeng_edit'
  | 'jimeng_digital_human'

export interface AITaskCreate {
  type: AITaskType
  input: Record<string, unknown>
  refId?: string
  refType?: string
}

export interface AITaskResult {
  id: string
  type: string
  status: string
  progress: number
  input: unknown
  output: unknown
  error: string | null
  ref_id: string | null
  ref_type: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

function mapTask(t: {
  id: string; type: string; status: string; progress: number;
  input: unknown; output: unknown; error: string | null;
  refId: string | null; refType: string | null;
  startedAt: Date | null; completedAt: Date | null; createdAt: Date;
}): AITaskResult {
  return {
    id: t.id, type: t.type, status: t.status, progress: t.progress,
    input: t.input, output: t.output, error: t.error,
    ref_id: t.refId, ref_type: t.refType,
    started_at: t.startedAt?.toISOString() ?? null,
    completed_at: t.completedAt?.toISOString() ?? null,
    created_at: t.createdAt.toISOString(),
  }
}

export async function createTask(params: AITaskCreate): Promise<AITaskResult> {
  const task = await prisma.aITask.create({
    data: {
      type: params.type,
      status: 'pending',
      input: params.input as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      refId: params.refId ?? null,
      refType: params.refType ?? null,
    },
  })
  return mapTask(task)
}

export async function getTask(taskId: string): Promise<AITaskResult | null> {
  const task = await prisma.aITask.findUnique({ where: { id: taskId } })
  return task ? mapTask(task) : null
}

export async function updateTask(
  taskId: string,
  updates: {
    status?: AITaskStatus
    progress?: number
    output?: unknown
    error?: string
  },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {}
  if (updates.status !== undefined) {
    data.status = updates.status
    if (updates.status === 'running') data.startedAt = new Date()
    if (updates.status === 'success' || updates.status === 'failed') data.completedAt = new Date()
  }
  if (updates.progress !== undefined) data.progress = updates.progress
  if (updates.output !== undefined) data.output = updates.output as any // eslint-disable-line @typescript-eslint/no-explicit-any
  if (updates.error !== undefined) data.error = updates.error

  await prisma.aITask.update({ where: { id: taskId }, data })
}

export async function runTask(
  params: AITaskCreate,
  handler: () => Promise<unknown>,
): Promise<AITaskResult> {
  const task = await createTask(params)
  const taskId = task.id

  // 异步执行，不阻塞响应
  setImmediate(async () => {
    try {
      await updateTask(taskId, { status: 'running', progress: 10 })
    } catch {
      return // 任务已被清理
    }
    try {
      const output = await handler()
      await updateTask(taskId, { status: 'success', progress: 100, output })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      try { await updateTask(taskId, { status: 'failed', error: msg }) } catch { /* 已清理 */ }
    }
  })

  return task
}
