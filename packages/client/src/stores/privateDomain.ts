import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchDailyMoments, markMomentSent, recordMomentEngagement,
  fetchGroupContents, generateGroupContent,
} from '../api/privateDomain'
import type { MomentsContent, GroupContent } from '../api/privateDomain'
import type { GroupType } from '@zimti/shared'

export const usePrivateDomainStore = defineStore('privateDomain', () => {
  const moments = ref<MomentsContent[]>([])
  const momentsLoading = ref(false)

  const groupContents = ref<GroupContent[]>([])
  const groupContentsLoading = ref(false)
  const generatingGroup = ref(false)

  async function loadDailyMoments(): Promise<void> {
    momentsLoading.value = true
    try {
      const res = await fetchDailyMoments()
      moments.value = res.items
    } finally {
      momentsLoading.value = false
    }
  }

  async function markSent(id: string): Promise<void> {
    await markMomentSent(id)
    await loadDailyMoments()
  }

  async function recordEngagement(id: string, data: {
    likes?: number
    comments?: number
    screenshot?: string | null
  }): Promise<void> {
    await recordMomentEngagement(id, data)
  }

  async function loadGroupContents(groupType?: GroupType): Promise<void> {
    groupContentsLoading.value = true
    try {
      const res = await fetchGroupContents(groupType ? { group_type: groupType } : undefined)
      groupContents.value = res.items
    } finally {
      groupContentsLoading.value = false
    }
  }

  async function generateGroup(groupType: GroupType): Promise<string> {
    generatingGroup.value = true
    try {
      const res = await generateGroupContent({ group_type: groupType })
      await loadGroupContents(groupType)
      return res.id
    } finally {
      generatingGroup.value = false
    }
  }

  return {
    moments, momentsLoading,
    groupContents, groupContentsLoading, generatingGroup,
    loadDailyMoments, markSent, recordEngagement,
    loadGroupContents, generateGroup,
  }
})
