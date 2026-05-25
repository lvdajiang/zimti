// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePipelineStore } from '../pipeline'

vi.mock('../../api/pipeline', () => ({
  createViralRemindJob: vi.fn(),
  createHotspotRushJob: vi.fn(),
  createCustomerQuestionJob: vi.fn(),
  fetchDailyStatus: vi.fn(),
  fetchPipelineJobs: vi.fn(),
  fetchPipelineJob: vi.fn(),
}))

import {
  createViralRemindJob, createHotspotRushJob, createCustomerQuestionJob,
  fetchDailyStatus, fetchPipelineJobs, fetchPipelineJob,
} from '../../api/pipeline'

const mockedCreateViralRemindJob = vi.mocked(createViralRemindJob)
const mockedCreateHotspotRushJob = vi.mocked(createHotspotRushJob)
const mockedCreateCustomerQuestionJob = vi.mocked(createCustomerQuestionJob)
const mockedFetchDailyStatus = vi.mocked(fetchDailyStatus)
const mockedFetchPipelineJobs = vi.mocked(fetchPipelineJobs)
const mockedFetchPipelineJob = vi.mocked(fetchPipelineJob)

const mockJobs = [
  { id: 'j1', mode: 'viral_remind', status: 'completed' },
  { id: 'j2', mode: 'hotspot_rush', status: 'running' },
]

const mockJobDetail = { id: 'j1', mode: 'viral_remind', status: 'completed', result: '执行成功' }

const mockDailyStatus = {
  viral_remind: { total: 5, success: 3, failed: 1, pending: 1 },
  hotspot_rush: { total: 3, success: 2, failed: 0, pending: 1 },
  customer_question: { total: 2, success: 1, failed: 1, pending: 0 },
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('usePipelineStore', () => {
  describe('loadJobs', () => {
    it('设置 jobs 和 total', async () => {
      mockedFetchPipelineJobs.mockResolvedValue({
        items: mockJobs,
        total: 10,
      })

      const store = usePipelineStore()
      await store.loadJobs()

      expect(store.jobs).toEqual(mockJobs)
      expect(store.total).toBe(10)
      expect(store.loading).toBe(false)
    })

    it('传递当前分页和筛选参数', async () => {
      mockedFetchPipelineJobs.mockResolvedValue({ items: [], total: 0 })

      const store = usePipelineStore()
      store.currentPage = 2
      store.pageSize = 10
      store.filterMode = 'viral_remind'
      store.filterStatus = 'running'

      await store.loadJobs()

      expect(mockedFetchPipelineJobs).toHaveBeenCalledWith({
        mode: 'viral_remind',
        status: 'running',
        page: 2,
        page_size: 10,
      })
    })

    it('筛选值为空时传 undefined', async () => {
      mockedFetchPipelineJobs.mockResolvedValue({ items: [], total: 0 })

      const store = usePipelineStore()
      store.filterMode = ''
      store.filterStatus = ''

      await store.loadJobs()

      expect(mockedFetchPipelineJobs).toHaveBeenCalledWith({
        mode: undefined,
        status: undefined,
        page: 1,
        page_size: 20,
      })
    })

    it('期间 loading 为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedFetchPipelineJobs.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve })
      )

      const store = usePipelineStore()
      const promise = store.loadJobs()

      expect(store.loading).toBe(true)

      resolveFn!({ items: mockJobs, total: 2 })
      await promise

      expect(store.loading).toBe(false)
    })
  })

  describe('loadDailyStatus', () => {
    it('设置 dailyStatus', async () => {
      mockedFetchDailyStatus.mockResolvedValue(mockDailyStatus as any)

      const store = usePipelineStore()
      await store.loadDailyStatus()

      expect(store.dailyStatus).toEqual(mockDailyStatus)
      expect(store.dailyLoading).toBe(false)
    })

    it('期间 dailyLoading 为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedFetchDailyStatus.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve })
      )

      const store = usePipelineStore()
      const promise = store.loadDailyStatus()

      expect(store.dailyLoading).toBe(true)

      resolveFn!(mockDailyStatus)
      await promise

      expect(store.dailyLoading).toBe(false)
    })
  })

  describe('loadJob', () => {
    it('设置 currentJob', async () => {
      mockedFetchPipelineJob.mockResolvedValue(mockJobDetail as any)

      const store = usePipelineStore()
      await store.loadJob('j1')

      expect(mockedFetchPipelineJob).toHaveBeenCalledWith('j1')
      expect(store.currentJob).toEqual(mockJobDetail)
      expect(store.jobLoading).toBe(false)
    })

    it('期间 jobLoading 为 true', async () => {
      let resolveFn: (v: unknown) => void
      mockedFetchPipelineJob.mockReturnValue(
        new Promise((resolve) => { resolveFn = resolve })
      )

      const store = usePipelineStore()
      const promise = store.loadJob('j1')

      expect(store.jobLoading).toBe(true)

      resolveFn!(mockJobDetail)
      await promise

      expect(store.jobLoading).toBe(false)
    })
  })

  describe('startViralRemind', () => {
    it('调用 createViralRemindJob 后刷新 loadJobs 并返回 id', async () => {
      mockedCreateViralRemindJob.mockResolvedValue({ id: 'j3' } as any)
      mockedFetchPipelineJobs.mockResolvedValue({ items: mockJobs, total: 3 })

      const store = usePipelineStore()
      const resultId = await store.startViralRemind({
        video_url: 'https://example.com/video.mp4',
        video_text: '测试文案',
      })

      expect(mockedCreateViralRemindJob).toHaveBeenCalledWith({
        video_url: 'https://example.com/video.mp4',
        video_text: '测试文案',
      })
      expect(mockedFetchPipelineJobs).toHaveBeenCalled()
      expect(resultId).toBe('j3')
    })
  })

  describe('startHotspotRush', () => {
    it('调用 createHotspotRushJob 后刷新 loadJobs 并返回 id', async () => {
      mockedCreateHotspotRushJob.mockResolvedValue({ id: 'j4' } as any)
      mockedFetchPipelineJobs.mockResolvedValue({ items: mockJobs, total: 4 })

      const store = usePipelineStore()
      const resultId = await store.startHotspotRush({
        hotspot_title: '热点标题',
        hotspot_desc: '热点描述',
      })

      expect(mockedCreateHotspotRushJob).toHaveBeenCalledWith({
        hotspot_title: '热点标题',
        hotspot_desc: '热点描述',
      })
      expect(mockedFetchPipelineJobs).toHaveBeenCalled()
      expect(resultId).toBe('j4')
    })
  })

  describe('startCustomerQuestion', () => {
    it('调用 createCustomerQuestionJob 后刷新 loadJobs 并返回 id', async () => {
      mockedCreateCustomerQuestionJob.mockResolvedValue({ id: 'j5' } as any)
      mockedFetchPipelineJobs.mockResolvedValue({ items: mockJobs, total: 5 })

      const store = usePipelineStore()
      const resultId = await store.startCustomerQuestion({
        question: '客户问题内容',
        customer_ids: ['c1', 'c2'],
      })

      expect(mockedCreateCustomerQuestionJob).toHaveBeenCalledWith({
        question: '客户问题内容',
        customer_ids: ['c1', 'c2'],
      })
      expect(mockedFetchPipelineJobs).toHaveBeenCalled()
      expect(resultId).toBe('j5')
    })
  })
})
