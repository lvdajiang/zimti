import { defineStore } from 'pinia'
import { ref } from 'vue'
import { axiosInstance } from '../api/client'
import {
  register, login, getMe, demoLogin,
  fetchCurrentSubscription, upgradePlan, fetchPlans,
} from '../api/auth'
import type { UserInfo, AuthResponse, SubscriptionInfo, PlanInfo } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('zimti_token'))
  const user = ref<UserInfo | null>(null)
  const subscription = ref<SubscriptionInfo | null>(null)
  const plans = ref<PlanInfo[]>([])
  const loading = ref(false)
  const loginError = ref('')

  async function init(): Promise<boolean> {
    if (!token.value) return false
    axiosInstance.defaults.headers.common.Authorization = `Bearer ${token.value}`
    try {
      const res = await getMe()
      user.value = res.user
      return true
    } catch {
      logout()
      return false
    }
  }

  function setAuth(res: AuthResponse): void {
    token.value = res.token
    user.value = res.user
    localStorage.setItem('zimti_token', res.token)
    axiosInstance.defaults.headers.common.Authorization = `Bearer ${res.token}`
  }

  async function doRegister(data: { username: string; email?: string; password: string }): Promise<boolean> {
    loading.value = true
    loginError.value = ''
    try {
      const res = await register(data)
      setAuth(res)
      return true
    } catch (err: unknown) {
      loginError.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '注册失败'
      return false
    } finally {
      loading.value = false
    }
  }

  async function doLogin(username: string, password: string): Promise<boolean> {
    loading.value = true
    loginError.value = ''
    try {
      const res = await login({ username, password })
      setAuth(res)
      return true
    } catch (err: unknown) {
      loginError.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '登录失败'
      return false
    } finally {
      loading.value = false
    }
  }

  async function doDemoLogin(): Promise<boolean> {
    loading.value = true
    loginError.value = ''
    try {
      const res = await demoLogin()
      setAuth(res)
      return true
    } catch {
      loginError.value = '演示登录失败'
      return false
    } finally {
      loading.value = false
    }
  }

  function logout(): void {
    token.value = null
    user.value = null
    subscription.value = null
    localStorage.removeItem('zimti_token')
    delete axiosInstance.defaults.headers.common.Authorization
  }

  async function loadSubscription(): Promise<void> {
    try {
      subscription.value = await fetchCurrentSubscription()
    } catch {
      subscription.value = null
    }
  }

  async function loadPlans(): Promise<void> {
    const res = await fetchPlans()
    plans.value = res.plans
  }

  async function doUpgrade(plan: string): Promise<void> {
    await upgradePlan(plan)
    await loadSubscription()
  }

  return {
    token, user, subscription, plans, loading, loginError,
    init, doRegister, doLogin, doDemoLogin, logout,
    loadSubscription, loadPlans, doUpgrade,
  }
})
