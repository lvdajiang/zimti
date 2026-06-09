/**
 * 采集任务定时调度服务 — 基于 node-cron
 *
 * 管理采集任务的定时执行。
 * 调度配置通过 API 存储，运行时注册到 node-cron。
 */

import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { prisma } from '../db.js'

type ScheduledCollect = {
  taskId: string
  cronExpr: string
  job: ScheduledTask
}

// 内存中的活跃调度
const activeSchedules = new Map<string, ScheduledCollect>()

/**
 * 注册采集任务的定时调度
 */
export function registerCollectSchedule(taskId: string, cronExpr: string): boolean {
  if (!cron.validate(cronExpr)) {
    console.error(`[CollectScheduler] 无效的 cron 表达式: ${cronExpr}`)
    return false
  }

  // 先取消已有调度
  unregisterCollectSchedule(taskId)

  const job = cron.schedule(cronExpr, () => {
    executeScheduledCollect(taskId).catch(err => {
      console.error(`[CollectScheduler] 任务 ${taskId} 执行失败:`, err)
    })
  })

  activeSchedules.set(taskId, { taskId, cronExpr, job })
  console.log(`[CollectScheduler] 注册采集任务 ${taskId}: (${cronExpr})`)
  return true
}

/**
 * 取消调度
 */
export function unregisterCollectSchedule(taskId: string): void {
  const existing = activeSchedules.get(taskId)
  if (existing) {
    existing.job.stop()
    activeSchedules.delete(taskId)
    console.log(`[CollectScheduler] 取消采集任务 ${taskId}`)
  }
}

/**
 * 获取指定任务的调度信息
 */
export function getCollectSchedule(taskId: string): { cronExpr: string } | null {
  const s = activeSchedules.get(taskId)
  return s ? { cronExpr: s.cronExpr } : null
}

/**
 * 获取所有活跃调度
 */
export function getActiveCollectScheduleIds(): string[] {
  return Array.from(activeSchedules.keys())
}

/**
 * 执行一次定时采集
 */
async function executeScheduledCollect(taskId: string): Promise<void> {
  const task = await prisma.collectTask.findUnique({ where: { id: taskId } })
  if (!task || task.status === 'running') return

  // 重置为 pending，让采集流程自动拾取
  await prisma.collectTask.update({
    where: { id: taskId },
    data: { status: 'pending' },
  })

  // 记录日志
  await prisma.collectTaskLog.create({
    data: {
      taskId,
      level: 'info',
      message: `[定时调度] 触发采集任务`,
    },
  })

  console.log(`[CollectScheduler] 触发采集任务 ${taskId}`)
}
