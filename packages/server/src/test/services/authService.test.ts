import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import request from 'supertest'
import { createTestApp, setupTestDb, cleanupTestDb, teardownTestDb } from '../setup.js'
import { prisma } from '../../db.js'
import { signJwtReal, verifyJwtReal } from '../../services/auth/authService.js'
import { DEMO_USER_ID } from '../../constants.js'

describe('authService', () => {
  const app = createTestApp()

  beforeAll(async () => {
    await setupTestDb()
    await cleanupTestDb()
  })

  afterEach(async () => {
    await cleanupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  // --- 辅助：注册并返回 token + userId ---
  async function registerAndGetToken(username = 'testuser', password = 'test1234') {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username, password })
      .expect(201)
    return { token: res.body.token as string, userId: res.body.user.id as string }
  }

  // ============================================================
  // 1. JWT 签发与验证
  // ============================================================
  describe('JWT 签发与验证', () => {
    it('signJwtReal 生成有效 token，verifyJwtReal 返回 payload', async () => {
      const payload = { userId: 'user-1', username: 'alice', email: 'a@b.com' }
      const token = signJwtReal(payload)
      expect(token).toContain('.')

      const verified = await verifyJwtReal(token)
      expect(verified).not.toBeNull()
      expect(verified!.userId).toBe('user-1')
      expect(verified!.username).toBe('alice')
      expect(verified!.email).toBe('a@b.com')
      expect(verified!.iat).toBeTypeOf('number')
      expect(verified!.exp).toBeGreaterThan(verified!.iat)
    })

    it('篡改签名后 verifyJwtReal 返回 null', async () => {
      const payload = { userId: 'user-2', username: 'bob', email: null }
      const token = signJwtReal(payload)
      // 篡改签名部分（第三段）
      const parts = token.split('.')
      parts[2] = 'tampered_signature_' + parts[2].slice(0, 10)
      const tampered = parts.join('.')

      const verified = await verifyJwtReal(tampered)
      expect(verified).toBeNull()
    })

    it('格式错误（非 3 段）返回 null', async () => {
      expect(await verifyJwtReal('only.two')).toBeNull()
      expect(await verifyJwtReal('single')).toBeNull()
      expect(await verifyJwtReal('a.b.c.d')).toBeNull()
      expect(await verifyJwtReal('')).toBeNull()
    })
  })

  // ============================================================
  // 2. 密码哈希（通过路由间接测试）
  // ============================================================
  describe('密码哈希（通过路由测试）', () => {
    it('POST /auth/register + POST /auth/login 正确密码 → 200', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'hashuser', password: 'correctpwd' })
        .expect(201)

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'hashuser', password: 'correctpwd' })
        .expect(200)

      expect(res.body.token).toBeTruthy()
      expect(res.body.user.username).toBe('hashuser')
    })

    it('POST /auth/login 错误密码 → 401', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'wrongpwduser', password: 'rightpass' })
        .expect(201)

      await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'wrongpwduser', password: 'badpass' })
        .expect(401)
    })

    it('POST /auth/login 不存在用户 → 401', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nonexistent_user_xyz', password: 'anything' })
        .expect(401)
    })
  })

  // ============================================================
  // 3. 认证中间件（通过路由间接测试）
  // ============================================================
  describe('认证中间件（通过路由测试）', () => {
    it('GET /auth/me 无 header → 401', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .expect(401)
    })

    it('GET /auth/me 有效 token → 200', async () => {
      const { token } = await registerAndGetToken('me_user')

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body.user.username).toBe('me_user')
      expect(res.body.user.id).toBeTruthy()
    })
  })

  // ============================================================
  // 4. 配额管理
  // ============================================================
  describe('配额管理', () => {
    it('GET /subscriptions/current 无订阅 → free 计划', async () => {
      const { token } = await registerAndGetToken('nosub_user')

      const res = await request(app)
        .get('/api/v1/subscriptions/current')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body.plan).toBe('free')
      expect(res.body.quota_used).toBe(0)
      expect(res.body.quota_limit).toBe(1)
    })

    it('POST /subscriptions/upgrade → 201，quota 重置为 0', async () => {
      const { token, userId } = await registerAndGetToken('upgrade_user')

      // 先升级到 personal
      const upgrade1 = await request(app)
        .post('/api/v1/subscriptions/upgrade')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'personal' })
      expect(upgrade1.status).toBe(201)

      // 手动增加 quota_used，模拟使用
      const sub = await prisma.subscription.findFirst({
        where: { userId, status: 'active' },
      })
      expect(sub).not.toBeNull()
      await prisma.subscription.update({
        where: { id: sub!.id },
        data: { quotaUsed: 5 },
      })

      // 再次升级到 professional，quota 应重置为 0
      const res = await request(app)
        .post('/api/v1/subscriptions/upgrade')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'professional' })
      expect(res.status).toBe(201)
      expect(res.body.plan).toBe('professional')
      expect(res.body.quota_limit).toBe(50)

      // 验证订阅已更新：同一条记录，plan 变了，quotaUsed 重置为 0
      const updatedSub = await prisma.subscription.findFirst({
        where: { userId, status: 'active' },
      })
      expect(updatedSub).not.toBeNull()
      expect(updatedSub!.id).toBe(sub!.id)
      expect(updatedSub!.plan).toBe('professional')
      expect(updatedSub!.quotaUsed).toBe(0)
    })

    it('GET /subscriptions/plans → 返回 4 档套餐', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions/plans')
        .expect(200)

      expect(res.body.plans).toHaveLength(4)
      const planNames = res.body.plans.map((p: { plan: string }) => p.plan)
      expect(planNames).toContain('free')
      expect(planNames).toContain('personal')
      expect(planNames).toContain('professional')
      expect(planNames).toContain('enterprise')
    })

    it('POST /subscriptions/upgrade 无效 plan → 400', async () => {
      const { token } = await registerAndGetToken('badplan_user')

      await request(app)
        .post('/api/v1/subscriptions/upgrade')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'invalid_plan' })
        .expect(400)
    })
  })

  // ============================================================
  // 5. 认证路由
  // ============================================================
  describe('认证路由', () => {
    it('POST /auth/register 正常 → 201 + token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'newuser', password: 'password123' })
        .expect(201)

      expect(res.body.token).toBeTruthy()
      expect(res.body.user.username).toBe('newuser')
      expect(res.body.user.id).toBeTruthy()
    })

    it('POST /auth/register 密码 < 6 位 → 400', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'shortpwd_user', password: '12345' })
        .expect(400)
    })

    it('POST /auth/register 重复用户名 → 409', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'dupuser', password: 'password123' })
        .expect(201)

      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'dupuser', password: 'otherpass456' })
        .expect(409)
    })

    it('POST /auth/demo-login → 200 + token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/demo-login')
        .expect(200)

      expect(res.body.token).toBeTruthy()
      expect(res.body.user.id).toBe(DEMO_USER_ID)
    })

    it('POST /subscriptions/upgrade 原地更新（同一记录，plan 变更，quota 重置）', async () => {
      const { token, userId } = await registerAndGetToken('tx_user')

      // 第一次升级 → free → personal
      const res1 = await request(app)
        .post('/api/v1/subscriptions/upgrade')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'personal' })
      expect(res1.status).toBe(201)

      // 第二次升级 → personal → enterprise
      const res2 = await request(app)
        .post('/api/v1/subscriptions/upgrade')
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'enterprise' })
      expect(res2.status).toBe(201)

      // 查询该用户的订阅记录
      const subs = await prisma.subscription.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })

      // 只有 1 条记录（原地更新）
      expect(subs).toHaveLength(1)
      expect(subs[0].plan).toBe('enterprise')
      expect(subs[0].status).toBe('active')
      expect(subs[0].quotaUsed).toBe(0)
      expect(subs[0].quotaLimit).toBe(999)
    })
  })
})
