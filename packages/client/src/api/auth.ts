import api from './client'

// --- 类型定义 ---

export interface UserInfo {
  id: string
  username: string
  email: string | null
}

export interface AuthResponse {
  token: string
  user: UserInfo
}

export interface SubscriptionInfo {
  id?: string
  plan: string
  status: string
  start_date: string
  end_date: string | null
  quota_used: number
  quota_limit: number
  features: string[]
}

export interface PlanInfo {
  plan: string
  quota_limit: number
  features: string[]
}

export interface PlansResponse {
  plans: PlanInfo[]
}

// --- 认证 ---

export async function register(data: {
  username: string
  email?: string
  password: string
}): Promise<AuthResponse> {
  return api.post('/auth/register', data) as unknown as Promise<AuthResponse>
}

export async function login(data: {
  username: string
  password: string
}): Promise<AuthResponse> {
  return api.post('/auth/login', data) as unknown as Promise<AuthResponse>
}

export async function getMe(): Promise<{ user: UserInfo }> {
  return api.get('/auth/me') as unknown as Promise<{ user: UserInfo }>
}

export async function demoLogin(): Promise<AuthResponse> {
  return api.post('/auth/demo-login') as unknown as Promise<AuthResponse>
}

// --- 订阅 ---

export async function fetchCurrentSubscription(): Promise<SubscriptionInfo> {
  return api.get('/subscriptions/current') as unknown as Promise<SubscriptionInfo>
}

export async function upgradePlan(plan: string): Promise<{
  id: string
  plan: string
  quota_limit: number
  features: string[]
}> {
  return api.post('/subscriptions/upgrade', { plan }) as unknown as Promise<{
    id: string
    plan: string
    quota_limit: number
    features: string[]
  }>
}

export async function fetchPlans(): Promise<PlansResponse> {
  return api.get('/subscriptions/plans') as unknown as Promise<PlansResponse>
}
