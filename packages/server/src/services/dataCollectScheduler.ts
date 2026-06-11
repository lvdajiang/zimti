/**
 * 数据自动采集调度服务
 *
 * 读取 DataCollectSchedule 表，注册/管理定时采集任务。
 * 触发时调用 collectAllEnabled() 拉取所有已启用自动采集的记录。
 */
import { prisma } from '../db.js'
import { registerCollectSchedule, unregisterCollectSchedule } from './collectScheduler.js'
import { collectAllEnabled } from './collectors/collectService.js'

const SCHEDULE_TASK_PREFIX = 'data-collect'

function taskId(scheduleId: string): string {
  return `${SCHEDULE_TASK_PREFIX}:${scheduleId}`
}

/** 启动时加载所有活跃采集计划 */
export async function loadAllSchedules(): Promise<void> {
  const schedules = await prisma.dataCollectSchedule.findMany({
    where: { isActive: true },
  })
  for (const s of schedules) {
    registerCollectSchedule(taskId(s.id), s.cronExpr)
  }
  console.log(`[DataCollectScheduler] 已加载 ${schedules.length} 个采集计划`)
}

/** 创建或更新采集计划 */
export async function upsertSchedule(params: {
  id?: string
  userId: string
  platform: string
  cronExpr: string
  isActive?: boolean
}): Promise<{ id: string }> {
  const { id, userId, platform, cronExpr, isActive = true } = params

  const schedule = id
    ? await prisma.dataCollectSchedule.update({
        where: { id },
        data: { cronExpr, isActive },
      })
    : await prisma.dataCollectSchedule.create({
        data: { userId, platform, cronExpr, isActive },
      })

  if (isActive) {
    registerCollectSchedule(taskId(schedule.id), cronExpr)
  } else {
    unregisterCollectSchedule(taskId(schedule.id))
  }

  return { id: schedule.id }
}

/** 确保某用户+平台存在默认采集计划（每6小时） */
export async function ensureDefaultSchedule(userId: string, platform: string): Promise<void> {
  const existing = await prisma.dataCollectSchedule.findFirst({
    where: { userId, platform },
  })
  if (!existing) {
    await upsertSchedule({ userId, platform, cronExpr: '0 */6 * * *', isActive: true })
  }
}

/** 采集回调：定时器触发时调用 */
export async function executeScheduledCollect(_taskId: string): Promise<void> {
  console.log(`[DataCollectScheduler] 开始定时采集: ${_taskId}`)
  try {
    const result = await collectAllEnabled()
    console.log(
      `[DataCollectScheduler] 采集完成: 共${result.total}条, 成功${result.succeeded}, 失败${result.failed}`,
    )
    if (result.failed > 0) {
      console.warn(`[DataCollectScheduler] 失败详情:`, result.errors.slice(0, 5))
    }
  } catch (err) {
    console.error(`[DataCollectScheduler] 采集异常:`, err)
  }
}
