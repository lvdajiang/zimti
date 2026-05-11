import { Router } from 'express'
import { prisma } from '../../db.js'
import type { Request, Response } from 'express'
import { DEMO_USER_ID, str, toInt } from '../../constants.js'

const router: Router = Router()

// GET /api/v1/benchmark-accounts — 列表（支持筛选、搜索、分页）
router.get('/benchmark-accounts', async (req: Request, res: Response) => {
  try {
    const platform = str(req.query.platform)
    const keyword = str(req.query.keyword)
    const p = toInt(req.query.page, 1)
    const ps = Math.min(toInt(req.query.page_size, 20), 100)
    const skip = (p - 1) * ps

    const where: Record<string, unknown>[] = [{ userId: DEMO_USER_ID }]
    if (platform && platform !== 'all') where.push({ platform })
    if (keyword) where.push({ accountName: { contains: keyword, mode: 'insensitive' } })

    const [items, total] = await Promise.all([
      prisma.benchmarkAccount.findMany({
        where: { AND: where },
        orderBy: { createdAt: 'desc' },
        skip,
        take: ps,
      }),
      prisma.benchmarkAccount.count({ where: { AND: where } }),
    ])

    res.json({
      items: items.map(a => ({
        id: a.id,
        account_name: a.accountName,
        platform: a.platform,
        avatar_url: null,
        homepage_url: a.homepageUrl,
        follower_count: a.followerCount,
        content_direction: a.contentDirection,
        monitor_status: a.monitorStatus,
        last_collected_at: a.lastCollectedAt?.toISOString() ?? null,
        created_at: a.createdAt.toISOString(),
      })),
      total,
    })
  } catch (error) {
    console.error('[GET /benchmark-accounts]', error)
    res.status(500).json({ error: 'Failed to load accounts' })
  }
})

// GET /api/v1/benchmark-accounts/stats — 统计
router.get('/benchmark-accounts/stats', async (_req: Request, res: Response) => {
  try {
    const [total, monitoring, paused] = await Promise.all([
      prisma.benchmarkAccount.count({ where: { userId: DEMO_USER_ID } }),
      prisma.benchmarkAccount.count({ where: { userId: DEMO_USER_ID, monitorStatus: 'active' } }),
      prisma.benchmarkAccount.count({ where: { userId: DEMO_USER_ID, monitorStatus: 'paused' } }),
    ])
    res.json({ total, monitoring, paused })
  } catch (error) {
    console.error('[GET /benchmark-accounts/stats]', error)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})

// POST /api/v1/benchmark-accounts — 创建
router.post('/benchmark-accounts', async (req: Request, res: Response) => {
  try {
    const { account_name, platform, homepage_url, follower_count, content_direction } = req.body
    if (!account_name || !platform || !homepage_url) {
      res.status(400).json({ error: 'account_name, platform, homepage_url are required' })
      return
    }
    const account = await prisma.benchmarkAccount.create({
      data: {
        userId: DEMO_USER_ID,
        accountName: account_name,
        platform,
        homepageUrl: homepage_url,
        followerCount: follower_count ?? 0,
        contentDirection: content_direction ?? '',
      },
    })
    res.json({
      id: account.id,
      account_name: account.accountName,
      platform: account.platform,
      homepage_url: account.homepageUrl,
      follower_count: account.followerCount,
      content_direction: account.contentDirection,
      monitor_status: account.monitorStatus,
      created_at: account.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('[POST /benchmark-accounts]', error)
    res.status(500).json({ error: 'Failed to create account' })
  }
})

// PUT /api/v1/benchmark-accounts/:id — 更新
router.put('/benchmark-accounts/:id', async (req: Request, res: Response) => {
  try {
    const { account_name, homepage_url, follower_count, content_direction } = req.body
    const account = await prisma.benchmarkAccount.update({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
      data: {
        ...(account_name !== undefined && { accountName: account_name }),
        ...(homepage_url !== undefined && { homepageUrl: homepage_url }),
        ...(follower_count !== undefined && { followerCount: follower_count }),
        ...(content_direction !== undefined && { contentDirection: content_direction }),
      },
    })
    res.json({
      id: account.id,
      account_name: account.accountName,
      platform: account.platform,
      homepage_url: account.homepageUrl,
      follower_count: account.followerCount,
      content_direction: account.contentDirection,
      monitor_status: account.monitorStatus,
    })
  } catch (error) {
    console.error('[PUT /benchmark-accounts/:id]', error)
    res.status(500).json({ error: 'Failed to update account' })
  }
})

// DELETE /api/v1/benchmark-accounts/:id — 删除
router.delete('/benchmark-accounts/:id', async (req: Request, res: Response) => {
  try {
    await prisma.benchmarkAccount.delete({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
    })
    res.json({ success: true })
  } catch (error) {
    console.error('[DELETE /benchmark-accounts/:id]', error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

// PUT /api/v1/benchmark-accounts/:id/monitor — 切换监控
router.put('/benchmark-accounts/:id/monitor', async (req: Request, res: Response) => {
  try {
    const { monitor_status } = req.body
    if (monitor_status !== 'active' && monitor_status !== 'paused') {
      res.status(400).json({ error: 'monitor_status must be active or paused' })
      return
    }
    const account = await prisma.benchmarkAccount.update({
      where: { id: str(req.params.id), userId: DEMO_USER_ID },
      data: { monitorStatus: monitor_status },
    })
    res.json({ id: account.id, monitor_status: account.monitorStatus })
  } catch (error) {
    console.error('[PUT /benchmark-accounts/:id/monitor]', error)
    res.status(500).json({ error: 'Failed to toggle monitor' })
  }
})

export default router
