// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAiHubStore } from '../aiHub'

vi.mock('../../api/aiHub', () => ({
  fetchBrandMemory: vi.fn(),
  upsertBrandMemory: vi.fn(),
  deleteBrandMemory: vi.fn(),
  learnBrandMemory: vi.fn(),
  fetchStrategyRecommendations: vi.fn(),
  fetchEvolutionLogs: vi.fn(),
}))

import {
  fetchBrandMemory, upsertBrandMemory, deleteBrandMemory,
  learnBrandMemory, fetchStrategyRecommendations, fetchEvolutionLogs,
} from '../../api/aiHub'

const mockedFetchBrandMemory = vi.mocked(fetchBrandMemory)
const mockedUpsertBrandMemory = vi.mocked(upsertBrandMemory)
const mockedDeleteBrandMemory = vi.mocked(deleteBrandMemory)
const mockedLearnBrandMemory = vi.mocked(learnBrandMemory)
const mockedFetchStrategyRecommendations = vi.mocked(fetchStrategyRecommendations)
const mockedFetchEvolutionLogs = vi.mocked(fetchEvolutionLogs)

const mockProfile = { name: '测试品牌', industry: '科技' }
const mockItems = [
  { id: '1', category: 'core', key: '定位', value: '高端科技品牌' },
]
const mockRecommendations = [
  { id: 'r1', title: '建议一', content: '优化品牌调性' },
]
const mockLogs = [
  { id: 'l1', type: 'strategy', summary: '策略演进记录' },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useAiHubStore', () => {
  describe('loadBrandMemory', () => {
    it('设置 brandProfile 和 brandMemories', async () => {
      mockedFetchBrandMemory.mockResolvedValue({
        profile: mockProfile,
        items: mockItems,
      })

      const store = useAiHubStore()
      await store.loadBrandMemory()

      expect(store.brandProfile).toEqual(mockProfile)
      expect(store.brandMemories).toEqual(mockItems)
      expect(store.memoriesLoading).toBe(false)
    })

    it('期间 memoriesLoading 为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedFetchBrandMemory.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve })
      )

      const store = useAiHubStore()
      const promise = store.loadBrandMemory()

      expect(store.memoriesLoading).toBe(true)

      resolveFn!({ profile: mockProfile, items: mockItems })
      await promise

      expect(store.memoriesLoading).toBe(false)
    })
  })

  describe('saveBrandMemory', () => {
    it('调用 upsertBrandMemory 后刷新 loadBrandMemory', async () => {
      mockedUpsertBrandMemory.mockResolvedValue(undefined)
      mockedFetchBrandMemory.mockResolvedValue({
        profile: mockProfile,
        items: mockItems,
      })

      const store = useAiHubStore()
      const data = { category: 'core' as const, key: '定位', value: '新值' }
      await store.saveBrandMemory(data)

      expect(mockedUpsertBrandMemory).toHaveBeenCalledWith(data)
      expect(mockedFetchBrandMemory).toHaveBeenCalled()
      expect(store.brandMemories).toEqual(mockItems)
    })
  })

  describe('removeBrandMemory', () => {
    it('调用 deleteBrandMemory 后刷新 loadBrandMemory', async () => {
      mockedDeleteBrandMemory.mockResolvedValue(undefined)
      mockedFetchBrandMemory.mockResolvedValue({
        profile: mockProfile,
        items: [],
      })

      const store = useAiHubStore()
      // 先加载初始数据
      store.brandMemories = mockItems as any
      store.brandProfile = mockProfile

      const data = { category: 'core' as const, key: '定位' }
      await store.removeBrandMemory(data)

      expect(mockedDeleteBrandMemory).toHaveBeenCalledWith(data)
      expect(mockedFetchBrandMemory).toHaveBeenCalled()
      expect(store.brandMemories).toEqual([])
    })
  })

  describe('doLearn', () => {
    it('调用 learnBrandMemory，learningLoading 期间为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedLearnBrandMemory.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve })
      )

      const store = useAiHubStore()
      const data = { original_text: '原文', modified_text: '改后' }
      const promise = store.doLearn(data)

      expect(store.learningLoading).toBe(true)
      expect(mockedLearnBrandMemory).toHaveBeenCalledWith(data)

      resolveFn!(undefined)
      await promise

      expect(store.learningLoading).toBe(false)
    })
  })

  describe('loadRecommendations', () => {
    it('设置 recommendations（res.recommendations）', async () => {
      mockedFetchStrategyRecommendations.mockResolvedValue({
        recommendations: mockRecommendations,
      })

      const store = useAiHubStore()
      await store.loadRecommendations()

      expect(store.recommendations).toEqual(mockRecommendations)
      expect(store.recommendationsLoading).toBe(false)
    })

    it('期间 recommendationsLoading 为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedFetchStrategyRecommendations.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve })
      )

      const store = useAiHubStore()
      const promise = store.loadRecommendations()

      expect(store.recommendationsLoading).toBe(true)

      resolveFn!({ recommendations: mockRecommendations })
      await promise

      expect(store.recommendationsLoading).toBe(false)
    })
  })

  describe('loadEvolutionLogs', () => {
    it('设置 evolutionLogs（res.logs）', async () => {
      mockedFetchEvolutionLogs.mockResolvedValue({
        logs: mockLogs,
      })

      const store = useAiHubStore()
      await store.loadEvolutionLogs({ type: 'strategy', limit: 10 })

      expect(mockedFetchEvolutionLogs).toHaveBeenCalledWith({
        type: 'strategy',
        limit: 10,
      })
      expect(store.evolutionLogs).toEqual(mockLogs)
      expect(store.evolutionLoading).toBe(false)
    })

    it('期间 evolutionLoading 为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedFetchEvolutionLogs.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve })
      )

      const store = useAiHubStore()
      const promise = store.loadEvolutionLogs()

      expect(store.evolutionLoading).toBe(true)

      resolveFn!({ logs: mockLogs })
      await promise

      expect(store.evolutionLoading).toBe(false)
    })
  })
})
