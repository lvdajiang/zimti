import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchReferrals,
  createReferral,
  updateReferral,
  fetchReferralStats,
  generateReferralCode,
  fetchReferralRewards,
  createReferralReward,
  updateReferralReward,
} from '../api/referral'
import type { Referral, ReferralReward, ReferralStats, ReferralCode } from '../api/referral'
import type { ReferralSourceType } from '@zimti/shared'

export const useReferralStore = defineStore('referral', () => {
  const referrals = ref<Referral[]>([])
  const total = ref(0)
  const stats = ref<ReferralStats | null>(null)
  const rewards = ref<ReferralReward[]>([])
  const referralCode = ref<ReferralCode | null>(null)
  const loading = ref(false)

  async function loadReferrals(params?: { status?: string; source_type?: string }): Promise<void> {
    loading.value = true
    try {
      const res = await fetchReferrals(params)
      referrals.value = res.items
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function addReferral(data: {
    referrer_customer_id: string
    referee_customer_id?: string
    source_type: ReferralSourceType
    note?: string
  }): Promise<string> {
    const res = await createReferral(data)
    await loadReferrals()
    return res.id
  }

  async function changeReferralStatus(id: string, status: string): Promise<void> {
    await updateReferral(id, status)
    await loadReferrals()
  }

  async function loadStats(): Promise<void> {
    stats.value = await fetchReferralStats()
  }

  async function generateCode(customerId: string): Promise<void> {
    referralCode.value = await generateReferralCode(customerId)
  }

  async function loadRewards(): Promise<void> {
    const res = await fetchReferralRewards()
    rewards.value = res.items
  }

  async function addReward(data: {
    referral_id: string
    reward_type: string
    reward_value: number
  }): Promise<string> {
    const res = await createReferralReward(data)
    await loadRewards()
    return res.id
  }

  async function changeRewardStatus(id: string, status: string): Promise<void> {
    await updateReferralReward(id, status)
    await loadRewards()
  }

  return {
    referrals,
    total,
    stats,
    rewards,
    referralCode,
    loading,
    loadReferrals,
    addReferral,
    changeReferralStatus,
    loadStats,
    generateCode,
    loadRewards,
    addReward,
    changeRewardStatus,
  }
})
