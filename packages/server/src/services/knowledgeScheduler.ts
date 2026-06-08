/**
 * 知识库构建定时调度服务 — 基于 node-cron
 *
 * 应用启动时从 DB 加载所有 active 的定时任务，
 * 注册到 node-cron，到达执行时间自动触发 Pipeline。
 */

import cron from 'node-cron'
import { prisma } from '../db.js'
import { KnowledgeBuildPipeline } from './knowledgeBuilder/index.js'

type ScheduleTask = {
  id: string
  userId: string
  topic: string
  cronExpr: string
  task: cron.ScheduledTask
}

const activeTasks = new Map<string, ScheduleTask>()

/**
 * 初始化调度器 — 从 DB 加载所有 active 定时任务
 */
export async function initKnowledgeScheduler(): Promise<void> {
  const schedules = await prisma.knowledgeBuildSchedule.findMany({
    where: { isActive: true },
  })

  for (const s of schedules) {
    registerSchedule(s.id, s.userId, s.topic, s.cronExpr)
  }

  console.log(`[KnowledgeScheduler] 已加载 ${schedules.length} 个定时任务`)
}

/**
 * 注册单个定时任务
 */
function registerSchedule(id: string, userId: string, topic: string, cronExpr: string): void {
  // 先取消已有的同名任务
  unregisterSchedule(id)

  try {
    const task = cron.schedule(cronExpr, () => {
      executeSchedule(id, userId, topic)
    })

    activeTasks.set(id, { id, userId, topic, cronExpr, task })
    console.log(`[KnowledgeScheduler] 注册任务 ${id}: "${topic}" (${cronExpr})`)
  } catch (err) {
    console.error(`[KnowledgeScheduler] cron 表达式无效: ${cronExpr}`, err)
  }
}

/**
 * 取消注册
 */
function unregisterSchedule(id: string): void {
  const existing = activeTasks.get(id)
  if (existing) {
    existing.task.stop()
    activeTasks.delete(id)
  }
}

/**
 * 手动触发一次执行
 */
export async function triggerSchedule(id: string): Promise<string | null> {
  const schedule = await prisma.knowledgeBuildSchedule.findUnique({ where: { id } })
  if (!schedule) return null

  return executeSchedule(schedule.id, schedule.userId, schedule.topic)
}

/**
 * 执行定时构建任务
 */
async function executeSchedule(id: string, userId: string, topic: string): Promise<string> {
  console.log(`[KnowledgeScheduler] 执行定时任务 ${id}: "${topic}"`)

  // 更新 lastRunAt
  await prisma.knowledgeBuildSchedule.update({
    where: { id },
    data: { lastRunAt: new Date() },
  })

  // 创建构建任务
  const pipeline = new KnowledgeBuildPipeline({
    jobId: '',
    userId,
    topic,
    mode: 'scheduled',
  })
  // 先创建 Job 记录获取 ID
  // pipeline 内部会处理
  const job = await prisma.knowledgeBuildJob.create({
    data: {
      userId,
      topic,
      mode: 'scheduled',
      status: 'pending',
      currentStep: 0,
      progress: 0,
      input: { topic, scheduleId: id },
    },
  })

  // 异步执行
  setImmediate(async () => {
    try {
      const p = new KnowledgeBuildPipeline({
        jobId: job.id,
        userId,
        topic,
        mode: 'scheduled',
      })
      await p.runAuto()
    } catch (err) {
      console.error(`[KnowledgeScheduler] 定时任务执行失败:`, err)
    }
  })

  return job.id
}

/**
 * 刷新定时任务（创建/更新/删除后调用）
 */
export function refreshSchedule(id: string, userId: string, topic: string, cronExpr: string): void {
  registerSchedule(id, userId, topic, cronExpr)
}

/**
 * 停止定时任务
 */
export function stopSchedule(id: string): void {
  unregisterSchedule(id)
}

/**
 * 获取所有活跃任务状态
 */
export function getActiveScheduleIds(): string[] {
  return Array.from(activeTasks.keys())
}
