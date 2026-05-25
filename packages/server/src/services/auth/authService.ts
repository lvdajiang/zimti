import { Router, Response } from 'express'
import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import type { Request, NextFunction } from 'express'

// JWT 简单实现（生产环境应使用 jsonwebtoken 库）
const JWT_SECRET = process.env.JWT_SECRET || 'zimti-dev-secret-2026'
const JWT_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 天

interface JwtPayload {
  userId: string
  username: string
  email: string | null
  iat: number
  exp: number
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64url')
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString()
}

// HMAC-SHA256 签名
async function hmacSha256(message: string): Promise<string> {
  const { createHmac } = await import('crypto')
  return createHmac('sha256', JWT_SECRET).update(message).digest('base64url')
}

export async function signJwtReal(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Date.now()
  const body = base64UrlEncode(JSON.stringify({
    ...payload,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + JWT_EXPIRY) / 1000),
  }))
  const signature = await hmacSha256(`${header}.${body}`)
  return `${header}.${body}.${signature}`
}

export async function verifyJwtReal(token: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const expectedSig = await hmacSha256(`${parts[0]}.${parts[1]}`)
    if (expectedSig !== parts[2]) return null
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload as JwtPayload
  } catch {
    return null
  }
}

// 密码哈希
async function hashPassword(password: string): Promise<string> {
  const { createHash } = await import('crypto')
  return createHash('sha256').update(password).digest('hex')
}

// 中间件：认证
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' })
    return
  }

  const token = authHeader.slice(7)
  const payload = await verifyJwtReal(token)
  if (!payload) {
    res.status(401).json({ error: '令牌无效或已过期' })
    return
  }

  // 将用户信息注入请求
  (req as AuthenticatedRequest).user = payload
  next()
}

// 中间件：可选认证（不强制）
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = await verifyJwtReal(token)
    if (payload) {
      (req as AuthenticatedRequest).user = payload
    }
  }
  next()
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

// --- 订阅配额检查 ---

const PLAN_QUOTAS: Record<string, number> = {
  free: 1,
  personal: 10,
  professional: 50,
  enterprise: 999,
}

export async function checkQuota(userId: string): Promise<{
  allowed: boolean
  used: number
  limit: number
  remaining: number
  plan: string
}> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })

  const plan = sub?.plan ?? 'free'
  const used = sub?.quotaUsed ?? 0
  const limit = sub?.quotaLimit ?? PLAN_QUOTAS[plan]
  const remaining = Math.max(0, limit - used)

  return { allowed: used < limit, used, limit, remaining, plan }
}

export async function incrementQuota(userId: string): Promise<void> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { quotaUsed: sub.quotaUsed + 1 },
    })
  }
}

// --- 认证路由 ---

export function createAuthRouter(): Router {
  const router = Router()

  // POST /api/v1/auth/register — 注册
  router.post('/auth/register', async (req: Request, res: Response) => {
    const { username, email, password } = req.body
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' })
      return
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, ...(email ? [{ email }] : [])] },
    })
    if (existing) {
      res.status(409).json({ error: '用户名或邮箱已存在' })
      return
    }

    const pwHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { username, email: email || null, passwordHash: pwHash },
    })

    const token = await signJwtReal({
      userId: user.id,
      username: user.username,
      email: user.email,
    })

    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    })
  })

  // POST /api/v1/auth/login — 登录
  router.post('/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' })
      return
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: username }] },
    })
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: '用户名或密码错误' })
      return
    }

    const pwHash = await hashPassword(password)
    if (pwHash !== user.passwordHash) {
      res.status(401).json({ error: '用户名或密码错误' })
      return
    }

    const token = await signJwtReal({
      userId: user.id,
      username: user.username,
      email: user.email,
    })

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    })
  })

  // GET /api/v1/auth/me — 获取当前用户信息
  router.get('/auth/me', async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    if (!authReq.user) {
      res.status(401).json({ error: '未认证' })
      return
    }
    res.json({ user: { id: authReq.user.userId, username: authReq.user.username, email: authReq.user.email } })
  })

  // POST /api/v1/auth/demo-login — 演示登录（开发用）
  router.post('/auth/demo-login', async (_req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } })
    if (!user) {
      res.status(404).json({ error: '演示用户不存在' })
      return
    }

    const token = await signJwtReal({
      userId: user.id,
      username: user.username,
      email: user.email,
    })

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    })
  })

  // --- 订阅管理 ---

  // GET /api/v1/subscriptions/current — 获取当前订阅
  router.get('/subscriptions/current', async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    if (!authReq.user) { res.status(401).json({ error: '未认证' }); return }

    const sub = await prisma.subscription.findFirst({
      where: { userId: authReq.user.userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    if (!sub) {
      res.json({ plan: 'free', quota_used: 0, quota_limit: 1, features: [] })
      return
    }

    const plan = sub.plan
    const features = getPlanFeatures(plan)

    res.json({
      id: sub.id,
      plan,
      status: sub.status,
      start_date: sub.startDate,
      end_date: sub.endDate,
      quota_used: sub.quotaUsed,
      quota_limit: sub.quotaLimit,
      features,
    })
  })

  // POST /api/v1/subscriptions/upgrade — 升级计划
  router.post('/subscriptions/upgrade', async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    if (!authReq.user) { res.status(401).json({ error: '未认证' }); return }

    const { plan } = req.body
    if (!plan || !PLAN_QUOTAS[plan]) {
      res.status(400).json({ error: `plan must be one of: ${Object.keys(PLAN_QUOTAS).join(', ')}` })
      return
    }

    // 将当前订阅标记过期
    const currentSub = await prisma.subscription.findFirst({
      where: { userId: authReq.user.userId, status: 'active' },
    })
    if (currentSub) {
      await prisma.subscription.update({
        where: { id: currentSub.id },
        data: { status: 'expired' },
      })
    }

    const newSub = await prisma.subscription.create({
      data: {
        userId: authReq.user.userId,
        plan,
        status: 'active',
        startDate: new Date(),
        quotaUsed: 0,
        quotaLimit: PLAN_QUOTAS[plan],
      },
    })

    res.status(201).json({
      id: newSub.id,
      plan: newSub.plan,
      quota_limit: newSub.quotaLimit,
      features: getPlanFeatures(newSub.plan),
    })
  })

  // GET /api/v1/subscriptions/plans — 获取所有计划
  router.get('/subscriptions/plans', (_req: Request, res: Response) => {
    res.json({
      plans: Object.entries(PLAN_QUOTAS).map(([plan, limit]) => ({
        plan,
        quota_limit: limit,
        features: getPlanFeatures(plan),
      })),
    })
  })

  return router
}

function getPlanFeatures(plan: string): string[] {
  const features: Record<string, string[]> = {
    free: ['基础AI生成', '1条/月', '基础数据'],
    personal: ['AI 生成', '10条/月', '数据分析', '私域运营'],
    professional: ['AI 生成', '50条/月', '数据分析', '私域运营', 'AI中枢', '多账号管理'],
    enterprise: ['无限使用', '数据分析', '私域运营', 'AI中枢', '多账号管理', '优先支持', 'API 接口'],
  }
  return features[plan] || features.free
}



