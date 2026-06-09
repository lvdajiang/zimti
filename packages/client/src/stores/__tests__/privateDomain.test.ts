// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePrivateDomainStore } from '../privateDomain'

vi.mock('../../api/privateDomain', () => ({
  fetchDailyMoments: vi.fn(),
  markMomentSent: vi.fn(),
  recordMomentEngagement: vi.fn(),
  fetchGroupContents: vi.fn(),
  generateGroupContent: vi.fn(),
}))

import {
  fetchDailyMoments, markMomentSent, recordMomentEngagement,
  fetchGroupContents, generateGroupContent,
} from '../../api/privateDomain'

const mockedFetchDailyMoments = vi.mocked(fetchDailyMoments)
const mockedMarkMomentSent = vi.mocked(markMomentSent)
const mockedRecordMomentEngagement = vi.mocked(recordMomentEngagement)
const mockedFetchGroupContents = vi.mocked(fetchGroupContents)
const mockedGenerateGroupContent = vi.mocked(generateGroupContent)

const mockMoments = [
  { id: 'm1', content_type: 'professional' as const, content: '今日感悟', image_suggestion: null, status: 'draft', scheduled_at: '2026-05-25T09:00:00Z', sent_at: null, engagement_data: null, created_at: '2026-01-01' },
  { id: 'm2', content_type: 'life' as const, content: '产品分享', image_suggestion: null, status: 'draft', scheduled_at: '2026-05-25T12:00:00Z', sent_at: null, engagement_data: null, created_at: '2026-01-01' },
]

const mockGroupContents = [
  { id: 'g1', group_type: 'intent' as const, title: '意向客户群文案', content: '客户群文案', created_at: '2026-01-01' },
]

const mockGeneratedGroup = { id: 'g2', group_type: 'loyalty' as const, title: '老客复购群文案', content: 'VIP群文案', created_at: '2026-01-01' }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('usePrivateDomainStore', () => {
  describe('loadDailyMoments', () => {
    it('设置 moments（res.items）', async () => {
      mockedFetchDailyMoments.mockResolvedValue({ items: mockMoments })

      const store = usePrivateDomainStore()
      await store.loadDailyMoments()

      expect(store.moments).toEqual(mockMoments)
      expect(store.momentsLoading).toBe(false)
    })

    it('期间 momentsLoading 为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedFetchDailyMoments.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve as (v: unknown) => void })
      )

      const store = usePrivateDomainStore()
      const promise = store.loadDailyMoments()

      expect(store.momentsLoading).toBe(true)

      resolveFn!({ items: mockMoments })
      await promise

      expect(store.momentsLoading).toBe(false)
    })
  })

  describe('markSent', () => {
    it('调用 markMomentSent 后刷新 loadDailyMoments', async () => {
      mockedMarkMomentSent.mockResolvedValue(undefined as any)
      mockedFetchDailyMoments.mockResolvedValue({ items: mockMoments })

      const store = usePrivateDomainStore()
      await store.markSent('m1')

      expect(mockedMarkMomentSent).toHaveBeenCalledWith('m1')
      expect(mockedFetchDailyMoments).toHaveBeenCalled()
      expect(store.moments).toEqual(mockMoments)
    })
  })

  describe('recordEngagement', () => {
    it('调用 recordMomentEngagement 并传递参数', async () => {
      mockedRecordMomentEngagement.mockResolvedValue(undefined as any)

      const store = usePrivateDomainStore()
      const engagementData = { likes: 12, comments: 3, screenshot: null }
      await store.recordEngagement('m1', engagementData)

      expect(mockedRecordMomentEngagement).toHaveBeenCalledWith('m1', engagementData)
    })
  })

  describe('loadGroupContents', () => {
    it('不传 groupType 时直接请求', async () => {
      mockedFetchGroupContents.mockResolvedValue({ items: mockGroupContents })

      const store = usePrivateDomainStore()
      await store.loadGroupContents()

      expect(mockedFetchGroupContents).toHaveBeenCalledWith(undefined)
      expect(store.groupContents).toEqual(mockGroupContents)
      expect(store.groupContentsLoading).toBe(false)
    })

    it('传入 groupType 时带上筛选参数', async () => {
      mockedFetchGroupContents.mockResolvedValue({ items: mockGroupContents })

      const store = usePrivateDomainStore()
      await store.loadGroupContents('intent')

      expect(mockedFetchGroupContents).toHaveBeenCalledWith({ group_type: 'intent' })
      expect(store.groupContents).toEqual(mockGroupContents)
    })

    it('期间 groupContentsLoading 为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedFetchGroupContents.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve as (v: unknown) => void })
      )

      const store = usePrivateDomainStore()
      const promise = store.loadGroupContents()

      expect(store.groupContentsLoading).toBe(true)

      resolveFn!({ items: mockGroupContents })
      await promise

      expect(store.groupContentsLoading).toBe(false)
    })
  })

  describe('generateGroup', () => {
    it('调用 generateGroupContent 后刷新 loadGroupContents 并返回 id', async () => {
      mockedGenerateGroupContent.mockResolvedValue(mockGeneratedGroup)
      mockedFetchGroupContents.mockResolvedValue({ items: [mockGeneratedGroup] })

      const store = usePrivateDomainStore()
      const resultId = await store.generateGroup('loyalty')

      expect(mockedGenerateGroupContent).toHaveBeenCalledWith({ group_type: 'loyalty' })
      expect(mockedFetchGroupContents).toHaveBeenCalledWith({ group_type: 'loyalty' })
      expect(resultId).toBe('g2')
      expect(store.groupContents).toEqual([mockGeneratedGroup])
    })

    it('期间 generatingGroup 为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedGenerateGroupContent.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve as (v: unknown) => void })
      )

      const store = usePrivateDomainStore()
      const promise = store.generateGroup('intent')

      expect(store.generatingGroup).toBe(true)

      resolveFn!(mockGeneratedGroup)
      mockedFetchGroupContents.mockResolvedValue({ items: [mockGeneratedGroup] })
      await promise

      expect(store.generatingGroup).toBe(false)
    })
  })
})
