import { Router } from 'express'
import { getUserId, str, toInt } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import * as calService from '../../services/operationCalendarService.js'
import type { Request, Response } from 'express'
import type { CalendarEventType } from '@zimti/shared'

const router: Router = Router()
router.use(optionalAuth)

// GET /api/v1/operation-calendar/events — 列出所有事件（分页，支持 refId 查询）
router.get('/operation-calendar/events', async (req: Request, res: Response) => {
  try {
    const eventType = str(req.query.event_type) as CalendarEventType | ''
    const refId = str(req.query.ref_id)
    const result = await calService.getEvents(
      getUserId(req as any),
      toInt(req.query.page, 1),
      toInt(req.query.page_size, 20),
      eventType || undefined,
      refId || undefined,
    )
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/v1/operation-calendar/events/:year/:month — 按月获取事件
router.get('/operation-calendar/events/:year/:month', async (req: Request, res: Response) => {
  try {
    const year = toInt(req.params.year, new Date().getFullYear())
    const month = toInt(req.params.month, new Date().getMonth() + 1)

    if (month < 1 || month > 12) {
      res.status(400).json({ error: '月份必须在 1-12 之间' })
      return
    }

    const events = await calService.getEventsByMonth(getUserId(req as any), year, month)
    res.json({ items: events })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/v1/operation-calendar/preset-holidays — 获取预设节假日
router.get('/operation-calendar/preset-holidays', async (req: Request, res: Response) => {
  try {
    const year = toInt(req.query.year, new Date().getFullYear())
    const holidays = calService.getPresetHolidays(year)
    res.json({ items: holidays })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/v1/operation-calendar/events — 创建事件（支持 refId 关联）
router.post('/operation-calendar/events', async (req: Request, res: Response) => {
  try {
    const { event_date, title, event_type, content, remind_at, ref_id, ref_type } = req.body
    if (!title || !event_date || !event_type) {
      res.status(400).json({ error: 'title, event_date, event_type 为必填项' })
      return
    }

    const event = await calService.createEvent(getUserId(req as any), {
      eventDate: event_date,
      title,
      eventType: event_type,
      content,
      remindAt: remind_at,
      refId: ref_id,
      refType: ref_type,
    })
    res.status(201).json({ id: event.id })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('不能为空') || msg.includes('必须是')) {
      res.status(400).json({ error: msg })
      return
    }
    res.status(500).json({ error: msg })
  }
})

// PUT /api/v1/operation-calendar/events/:id — 更新事件
router.put('/operation-calendar/events/:id', async (req: Request, res: Response) => {
  try {
    const { event_date, title, event_type, content, remind_at } = req.body
    const event = await calService.updateEvent(getUserId(req as any), str(req.params.id), {
      eventDate: event_date,
      title,
      eventType: event_type,
      content,
      remindAt: remind_at,
    })
    res.json({ id: event.id })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('不存在') || msg.includes('必须是')) {
      res.status(404).json({ error: msg })
      return
    }
    res.status(500).json({ error: msg })
  }
})

// DELETE /api/v1/operation-calendar/events/:id — 删除事件
router.delete('/operation-calendar/events/:id', async (req: Request, res: Response) => {
  try {
    await calService.deleteEvent(getUserId(req as any), str(req.params.id))
    res.json({ success: true })
  } catch (err) {
    const msg = String(err)
    if (msg.includes('不存在')) {
      res.status(404).json({ error: msg })
      return
    }
    res.status(500).json({ error: msg })
  }
})

export default router
