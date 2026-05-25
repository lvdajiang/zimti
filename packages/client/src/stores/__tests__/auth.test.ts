// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { register, login, getMe, demoLogin, fetchCurrentSubscription, upgradePlan, fetchPlans } from '../../api/auth'
import { useAuthStore } from '../auth'
import { axiosInstance } from '../../api/client'

const localStorageMock = (() => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v }),
    removeItem: vi.fn((k: string) => { delete store[k] }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
    get length() { return Object.keys(store).length },
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

vi.mock('../../api/auth', () => ({
  register: vi.fn(),
  login: vi.fn(),
  getMe: vi.fn(),
  demoLogin: vi.fn(),
  fetchCurrentSubscription: vi.fn(),
  upgradePlan: vi.fn(),
  fetchPlans: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  axiosInstance: {
    defaults: { headers: { common: { Authorization: '' as string | undefined } } },
  },
}))

const mockUser = { id: 'u1', username: 'testuser', email: 'test@example.com' }
const mockToken = 'jwt-token-123'
const mockAuthResponse = { token: mockToken, user: mockUser }
const mockSubscription = {
  id: 'sub1',
  plan: 'pro',
  status: 'active',
  start_date: '2026-01-01',
  end_date: '2027-01-01',
  quota_used: 5,
  quota_limit: 100,
  features: ['ai_generation', 'crm'],
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  localStorage.clear()
  axiosInstance.defaults.headers.common.Authorization = ''
})

describe('useAuthStore', () => {
  describe('初始状态', () => {
    it('token 从 localStorage 读取，测试环境为 null', () => {
      const store = useAuthStore()
      expect(store.token).toBeNull()
    })

    it('user 为 null', () => {
      const store = useAuthStore()
      expect(store.user).toBeNull()
    })

    it('subscription 为 null，plans 为空数组', () => {
      const store = useAuthStore()
      expect(store.subscription).toBeNull()
      expect(store.plans).toEqual([])
    })
  })

  describe('doRegister', () => {
    it('成功时返回 true，设置 token/user 并写入 localStorage', async () => {
      vi.mocked(register).mockResolvedValue(mockAuthResponse)

      const store = useAuthStore()
      const result = await store.doRegister({ username: 'testuser', password: 'pass123' })

      expect(result).toBe(true)
      expect(store.token).toBe(mockToken)
      expect(store.user).toEqual(mockUser)
      expect(store.loading).toBe(false)
      expect(localStorage.getItem('zimti_token')).toBe(mockToken)
    })

    it('失败时返回 false，loginError 被设置', async () => {
      const error = new Error('注册失败') as Error & { response?: { data?: { error?: string } } }
      error.response = { data: { error: '用户名已存在' } }
      vi.mocked(register).mockRejectedValue(error)

      const store = useAuthStore()
      const result = await store.doRegister({ username: 'testuser', password: 'pass123' })

      expect(result).toBe(false)
      expect(store.loginError).toBe('用户名已存在')
      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(store.loading).toBe(false)
    })
  })

  describe('doLogin', () => {
    it('成功时返回 true，设置 token/user', async () => {
      vi.mocked(login).mockResolvedValue(mockAuthResponse)

      const store = useAuthStore()
      const result = await store.doLogin('testuser', 'pass123')

      expect(result).toBe(true)
      expect(store.token).toBe(mockToken)
      expect(store.user).toEqual(mockUser)
      expect(localStorage.getItem('zimti_token')).toBe(mockToken)
    })

    it('失败时返回 false，loginError 被设置', async () => {
      const error = new Error('登录失败') as Error & { response?: { data?: { error?: string } } }
      error.response = { data: { error: '密码错误' } }
      vi.mocked(login).mockRejectedValue(error)

      const store = useAuthStore()
      const result = await store.doLogin('testuser', 'wrong')

      expect(result).toBe(false)
      expect(store.loginError).toBe('密码错误')
    })
  })

  describe('doDemoLogin', () => {
    it('成功时返回 true，设置 token/user', async () => {
      vi.mocked(demoLogin).mockResolvedValue(mockAuthResponse)

      const store = useAuthStore()
      const result = await store.doDemoLogin()

      expect(result).toBe(true)
      expect(store.token).toBe(mockToken)
      expect(store.user).toEqual(mockUser)
    })

    it('失败时返回 false，loginError 被设置', async () => {
      vi.mocked(demoLogin).mockRejectedValue(new Error('fail'))

      const store = useAuthStore()
      const result = await store.doDemoLogin()

      expect(result).toBe(false)
      expect(store.loginError).toBe('演示登录失败')
    })
  })

  describe('logout', () => {
    it('清空所有状态，清除 localStorage，移除 axios header', async () => {
      vi.mocked(login).mockResolvedValue(mockAuthResponse)
      const store = useAuthStore()
      await store.doLogin('testuser', 'pass123')

      expect(store.token).toBe(mockToken)
      expect(store.user).not.toBeNull()

      store.logout()

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(store.subscription).toBeNull()
      expect(localStorage.getItem('zimti_token')).toBeNull()
      expect(axiosInstance.defaults.headers.common.Authorization).toBeUndefined()
    })
  })

  describe('loadSubscription', () => {
    it('成功时设置 subscription', async () => {
      vi.mocked(fetchCurrentSubscription).mockResolvedValue(mockSubscription)

      const store = useAuthStore()
      await store.loadSubscription()

      expect(store.subscription).toEqual(mockSubscription)
    })

    it('失败时 subscription 设为 null', async () => {
      vi.mocked(fetchCurrentSubscription).mockRejectedValue(new Error('network'))

      const store = useAuthStore()
      await store.loadSubscription()

      expect(store.subscription).toBeNull()
    })
  })

  describe('loadPlans', () => {
    const mockPlans = [
      { plan: 'free', quota_limit: 10, features: ['basic'] },
      { plan: 'starter', quota_limit: 50, features: ['basic', 'crm'] },
      { plan: 'pro', quota_limit: 100, features: ['basic', 'crm', 'ai_generation'] },
      { plan: 'enterprise', quota_limit: 999, features: ['basic', 'crm', 'ai_generation', 'priority_support'] },
    ]

    it('成功时设置 plans（4 档）', async () => {
      vi.mocked(fetchPlans).mockResolvedValue({ plans: mockPlans })

      const store = useAuthStore()
      await store.loadPlans()

      expect(store.plans).toEqual(mockPlans)
      expect(store.plans).toHaveLength(4)
    })

    it('失败时 plans 设为空数组', async () => {
      vi.mocked(fetchPlans).mockRejectedValue(new Error('network'))

      const store = useAuthStore()
      await store.loadPlans()

      expect(store.plans).toEqual([])
    })
  })

  describe('doUpgrade', () => {
    it('调 upgradePlan → loadSubscription', async () => {
      vi.mocked(upgradePlan).mockResolvedValue({
        id: 'sub1',
        plan: 'pro',
        quota_limit: 100,
        features: ['crm', 'ai_generation'],
      })
      vi.mocked(fetchCurrentSubscription).mockResolvedValue(mockSubscription)

      const store = useAuthStore()
      await store.doUpgrade('pro')

      expect(upgradePlan).toHaveBeenCalledWith('pro')
      expect(fetchCurrentSubscription).toHaveBeenCalledTimes(1)
      expect(store.subscription).toEqual(mockSubscription)
    })
  })

  describe('loading 状态', () => {
    it('doLogin 执行期间 loading 为 true，完成后恢复 false', async () => {
      let loadingDuringCall = false
      vi.mocked(login).mockImplementation(async () => {
        const store = useAuthStore()
        loadingDuringCall = store.loading
        return mockAuthResponse
      })

      const store = useAuthStore()
      expect(store.loading).toBe(false)

      await store.doLogin('testuser', 'pass123')

      expect(loadingDuringCall).toBe(true)
      expect(store.loading).toBe(false)
    })
  })
})
