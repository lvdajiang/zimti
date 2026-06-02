import api from './client'
import type { ReferralSourceType, ReferralStatus, RewardStatus } from '@zimti/shared'

// --- 类型定义 ---

export interface Referral {
  id: string
  referrer_customer_id: string
  referee_customer_id: string | null
  source_type: ReferralSourceType
  status: ReferralStatus
  note: string | null
  rewards: ReferralReward[]
  created_at: string
  updated_at: string
}

export interface ReferralReward {
  id: string
  referral_id: string
  reward_type: string
  reward_value: number
  status: RewardStatus
  created_at: string
  updated_at: string
}

export interface ReferralStats {
  total: number
  converted: number
  pending: number
  bySourceType: Record<string, number>
  topReferrers: Array<{ id: string; name: string; count: number }>
}

export interface ReferralCode {
  code: string
  referralText: string
  shareLink: string
}

// --- API ---

export async function fetchReferrals(params?: {
  status?: string
  source_type?: string
}): Promise<{ items: Referral[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.source_type) query.set('source_type', params.source_type)
  return api.get(`/referral?${query}`) as unknown as Promise<{ items: Referral[]; total: number }>
}

export async function createReferral(data: {
  referrer_customer_id: string
  referee_customer_id?: string
  source_type: ReferralSourceType
  note?: string
}): Promise<{ id: string }> {
  return api.post('/referral', data) as unknown as Promise<{ id: string }>
}

export async function updateReferral(id: string, status: string): Promise<{ id: string; status: string }> {
  return api.put(`/referral/${id}`, { status }) as unknown as Promise<{ id: string; status: string }>
}

export async function fetchReferralStats(): Promise<ReferralStats> {
  return api.get('/referral/stats') as unknown as Promise<ReferralStats>
}

export async function generateReferralCode(customerId: string): Promise<ReferralCode> {
  return api.post(`/referral/generate-code/${customerId}`) as unknown as Promise<ReferralCode>
}

export async function fetchReferralRewards(): Promise<{ items: ReferralReward[] }> {
  return api.get('/referral/rewards') as unknown as Promise<{ items: ReferralReward[] }>
}

export async function createReferralReward(data: {
  referral_id: string
  reward_type: string
  reward_value: number
}): Promise<{ id: string }> {
  return api.post('/referral/rewards', data) as unknown as Promise<{ id: string }>
}

export async function updateReferralReward(id: string, status: string): Promise<{ id: string; status: string }> {
  return api.put(`/referral/rewards/${id}`, { status }) as unknown as Promise<{ id: string; status: string }>
}
