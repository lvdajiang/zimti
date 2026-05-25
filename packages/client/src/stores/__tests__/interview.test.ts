// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInterviewStore } from '../interview'
import {
  fetchInterviewLayers,
  startInterview,
  nextInterviewQuestion,
  generateIpProfile,
  fetchIndustryTemplates,
  applyIndustryTemplate,
  initIndustryTemplates,
} from '../../api/interview'
import type {
  InterviewQuestionLayer,
  InterviewSession,
  InterviewNextResult,
  IpProfile,
  IndustryTemplate,
} from '../../api/interview'

vi.mock('../../api/interview', () => ({
  fetchInterviewLayers: vi.fn(),
  startInterview: vi.fn(),
  nextInterviewQuestion: vi.fn(),
  generateIpProfile: vi.fn(),
  fetchIndustryTemplates: vi.fn(),
  applyIndustryTemplate: vi.fn(),
  initIndustryTemplates: vi.fn(),
}))

const mockFetchInterviewLayers = vi.mocked(fetchInterviewLayers)
const mockStartInterview = vi.mocked(startInterview)
const mockNextInterviewQuestion = vi.mocked(nextInterviewQuestion)
const mockGenerateIpProfile = vi.mocked(generateIpProfile)
const mockFetchIndustryTemplates = vi.mocked(fetchIndustryTemplates)
const mockApplyIndustryTemplate = vi.mocked(applyIndustryTemplate)
const mockInitIndustryTemplates = vi.mocked(initIndustryTemplates)

// --- 测试数据 ---

const fakeLayers: InterviewQuestionLayer[] = [
  { layer: 1, type: 'basic', label: '基础经历', description: '了解你的基本背景' },
  { layer: 2, type: 'expertise', label: '专业能力', description: '核心技能与经验' },
  { layer: 3, type: 'style', label: '风格偏好', description: '创作风格与方向' },
  { layer: 4, type: 'audience', label: '受众定位', description: '目标受众分析' },
]

const fakeSession: InterviewSession = {
  topic: '短视频创作',
  currentLayer: 1,
  answers: [],
}

const fakeNextResult: InterviewNextResult = {
  session: { ...fakeSession, currentLayer: 2 },
  nextQuestion: '你平时用什么工具创作？',
  isComplete: false,
}

const fakeCompleteResult: InterviewNextResult = {
  session: { ...fakeSession, currentLayer: 4, answers: [{ layer: 1, type: 'basic', question: 'Q1', answer: 'A1' }] },
  nextQuestion: null,
  isComplete: true,
}

const fakeProfile: IpProfile = {
  profile: { tone: 'professional', style: 'educational' },
  canvas: { banner: 'https://example.com/banner.png' },
}

const fakeTemplates: IndustryTemplate[] = [
  { id: 'tpl-1', name: '美食博主', industry: '美食', description: '美食内容创作者模板', config: {} },
  { id: 'tpl-2', name: '旅行达人', industry: '旅行', description: '旅行内容创作者模板', config: {} },
]

const fakeAppliedConfig = {
  persona_default: { tone: 'casual' },
  content_types: ['video', 'article'],
  pipeline_presets: { auto_schedule: true },
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useInterviewStore', () => {
  // --- loadLayers ---
  describe('loadLayers', () => {
    it('应设置 4 层结构的 layers', async () => {
      mockFetchInterviewLayers.mockResolvedValue({ layers: fakeLayers })

      const store = useInterviewStore()
      await store.loadLayers()

      expect(store.layers).toEqual(fakeLayers)
      expect(store.layers).toHaveLength(4)
      expect(store.layers[0].layer).toBe(1)
      expect(store.layers[3].layer).toBe(4)
      expect(mockFetchInterviewLayers).toHaveBeenCalledOnce()
    })

    it('API 失败时应将 layers 设为空数组', async () => {
      mockFetchInterviewLayers.mockRejectedValue(new Error('网络错误'))

      const store = useInterviewStore()
      await store.loadLayers()

      expect(store.layers).toEqual([])
    })
  })

  // --- doStart ---
  describe('doStart', () => {
    it('应设置 session 和 currentQuestion，isComplete=false，profile=null', async () => {
      mockStartInterview.mockResolvedValue({ session: fakeSession })

      const store = useInterviewStore()
      // 先设置一些旧值确保被清空
      store.profile = fakeProfile
      store.isComplete = true

      await store.doStart('短视频创作')

      expect(store.session).toEqual(fakeSession)
      expect(store.currentQuestion).toContain('短视频创作')
      expect(store.isComplete).toBe(false)
      expect(store.profile).toBeNull()
      expect(store.loading).toBe(false)
      expect(mockStartInterview).toHaveBeenCalledWith('短视频创作')
    })

    it('结束后应重置 loading 状态', async () => {
      mockStartInterview.mockRejectedValue(new Error('启动失败'))

      const store = useInterviewStore()
      await expect(store.doStart('test')).rejects.toThrow('启动失败')
      expect(store.loading).toBe(false)
    })
  })

  // --- doNext ---
  describe('doNext', () => {
    it('session 为空时应直接返回，不调用 API', async () => {
      const store = useInterviewStore()

      await store.doNext()

      expect(mockNextInterviewQuestion).not.toHaveBeenCalled()
    })

    it('currentAnswer 为空时应直接返回', async () => {
      const store = useInterviewStore()
      store.session = fakeSession
      store.currentAnswer = '   '

      await store.doNext()

      expect(mockNextInterviewQuestion).not.toHaveBeenCalled()
    })

    it('有 session 和 answer 时应调用 API 并更新状态', async () => {
      mockNextInterviewQuestion.mockResolvedValue(fakeNextResult)

      const store = useInterviewStore()
      store.session = fakeSession
      store.currentAnswer = '我用剪映'

      await store.doNext()

      expect(mockNextInterviewQuestion).toHaveBeenCalledWith({
        session: fakeSession,
        answer: '我用剪映',
      })
      expect(store.session).toEqual(fakeNextResult.session)
      expect(store.currentQuestion).toBe('你平时用什么工具创作？')
      expect(store.isComplete).toBe(false)
      expect(store.currentAnswer).toBe('')
      expect(store.loading).toBe(false)
    })

    it('访谈完成时应设置 isComplete=true', async () => {
      mockNextInterviewQuestion.mockResolvedValue(fakeCompleteResult)

      const store = useInterviewStore()
      store.session = fakeSession
      store.currentAnswer = '最后一个回答'

      await store.doNext()

      expect(store.isComplete).toBe(true)
      expect(store.currentQuestion).toBeNull()
    })
  })

  // --- doGenerateProfile ---
  describe('doGenerateProfile', () => {
    it('session 为空时应直接返回', async () => {
      const store = useInterviewStore()

      await store.doGenerateProfile()

      expect(mockGenerateIpProfile).not.toHaveBeenCalled()
    })

    it('有 session 时应调用 API 并设置 profile', async () => {
      mockGenerateIpProfile.mockResolvedValue(fakeProfile)

      const store = useInterviewStore()
      store.session = fakeSession

      await store.doGenerateProfile()

      expect(mockGenerateIpProfile).toHaveBeenCalledWith({ session: fakeSession })
      expect(store.profile).toEqual(fakeProfile)
      expect(store.profileLoading).toBe(false)
    })
  })

  // --- loadTemplates ---
  describe('loadTemplates', () => {
    it('应设置 templates', async () => {
      mockFetchIndustryTemplates.mockResolvedValue({ items: fakeTemplates })

      const store = useInterviewStore()
      await store.loadTemplates()

      expect(store.templates).toEqual(fakeTemplates)
      expect(store.templates).toHaveLength(2)
      expect(store.templatesLoading).toBe(false)
      expect(mockFetchIndustryTemplates).toHaveBeenCalledWith(undefined)
    })

    it('传入行业参数时应传递给 API', async () => {
      mockFetchIndustryTemplates.mockResolvedValue({ items: [] })

      const store = useInterviewStore()
      await store.loadTemplates('美食')

      expect(mockFetchIndustryTemplates).toHaveBeenCalledWith({ industry: '美食' })
    })
  })

  // --- doApplyTemplate ---
  describe('doApplyTemplate', () => {
    it('成功时应设置 appliedConfig', async () => {
      mockApplyIndustryTemplate.mockResolvedValue(fakeAppliedConfig)

      const store = useInterviewStore()
      await store.doApplyTemplate('tpl-1')

      expect(store.appliedConfig).toEqual(fakeAppliedConfig)
      expect(mockApplyIndustryTemplate).toHaveBeenCalledWith('tpl-1')
    })

    it('失败时应将 appliedConfig 设为 null', async () => {
      mockApplyIndustryTemplate.mockRejectedValue(new Error('模板不存在'))

      const store = useInterviewStore()
      await store.doApplyTemplate('invalid')

      expect(store.appliedConfig).toBeNull()
    })
  })

  // --- doInitPresets ---
  describe('doInitPresets', () => {
    it('应调用 API 后刷新 templates，返回创建数量', async () => {
      mockInitIndustryTemplates.mockResolvedValue({ created: 5 })
      mockFetchIndustryTemplates.mockResolvedValue({ items: fakeTemplates })

      const store = useInterviewStore()
      const created = await store.doInitPresets()

      expect(created).toBe(5)
      expect(mockInitIndustryTemplates).toHaveBeenCalledOnce()
      expect(mockFetchIndustryTemplates).toHaveBeenCalledOnce()
      expect(store.templates).toEqual(fakeTemplates)
    })
  })
})
