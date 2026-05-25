// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  fetchCustomers, createCustomer, updateCustomer, deleteCustomer,
  updateCustomerStage, addCustomerTags, removeCustomerTag,
  parseVoiceInput, fetchChatTemplates, generateChatTemplates,
  fetchFollowUpReminders, createFollowUpReminder, fetchSilentCustomers, fetchFunnelStats,
} from '../../api/crm'
import { useCrmStore } from '../crm'

vi.mock('../../api/crm', () => ({
  fetchCustomers: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  updateCustomerStage: vi.fn(),
  addCustomerTags: vi.fn(),
  removeCustomerTag: vi.fn(),
  parseVoiceInput: vi.fn(),
  fetchChatTemplates: vi.fn(),
  generateChatTemplates: vi.fn(),
  fetchFollowUpReminders: vi.fn(),
  createFollowUpReminder: vi.fn(),
  fetchSilentCustomers: vi.fn(),
  fetchFunnelStats: vi.fn(),
}))

const mockCustomers = [
  {
    id: 'c1', name: '张三', aliases: '小张', phone: '13800001111',
    wechat: 'wx_zhang', source_type: 'manual', source_ref_id: null,
    intent_level: 'hot' as const, stage: 'new' as const,
    travel_intent: null, notes: 'VIP客户',
    last_follow_up_at: null,
    tags: [{ id: 't1', customer_id: 'c1', tag: 'VIP' }],
    created_at: '2026-01-01', updated_at: '2026-01-01',
  },
  {
    id: 'c2', name: '李四', aliases: '', phone: null,
    wechat: 'wx_li', source_type: 'voice', source_ref_id: null,
    intent_level: 'warm' as const, stage: 'following' as const,
    travel_intent: null, notes: null,
    last_follow_up_at: '2026-05-01',
    tags: [],
    created_at: '2026-02-01', updated_at: '2026-05-01',
  },
]

const mockFunnelStats = { new: 10, following: 5, negotiated: 3, closed_won: 8, closed_lost: 2 }

const mockTemplates = [
  { id: 'tpl1', stage: 'new', category: 'greeting', content: '您好！', effectiveness_score: 0.9, created_at: '2026-01-01' },
  { id: 'tpl2', stage: 'new', category: 'promotion', content: '我们有优惠', effectiveness_score: 0.8, created_at: '2026-01-02' },
]

const mockReminders = [
  { id: 'r1', customer_id: 'c1', customer: { name: '张三' }, remind_at: '2026-06-01T10:00:00Z', message: '跟进报价', status: 'pending' },
]

const mockVoiceResult = {
  name: '王五',
  travel_intent: { people: 2, date: '2026-07', destination: '三亚', budget: '5000' },
  tags: ['家庭游', '暑期'],
  notes: '需要海景房',
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useCrmStore', () => {
  describe('loadCustomers', () => {
    it('调 fetchCustomers，设置 customers/total/loading', async () => {
      vi.mocked(fetchCustomers).mockResolvedValue({ items: mockCustomers, total: 2 })

      const store = useCrmStore()
      expect(store.loading).toBe(false)

      const loadPromise = store.loadCustomers()
      // loading 在异步期间为 true
      expect(store.loading).toBe(true)
      await loadPromise

      expect(store.loading).toBe(false)
      expect(store.customers).toEqual(mockCustomers)
      expect(store.total).toBe(2)
      expect(fetchCustomers).toHaveBeenCalledWith({
        stage: undefined,
        intent_level: undefined,
        keyword: undefined,
        page: 1,
        page_size: 20,
      })
    })

    it('传递筛选参数', async () => {
      vi.mocked(fetchCustomers).mockResolvedValue({ items: [], total: 0 })

      const store = useCrmStore()
      store.filterStage = 'new'
      store.filterIntent = 'hot'
      store.filterKeyword = '张'
      store.currentPage = 2
      store.pageSize = 10

      await store.loadCustomers()

      expect(fetchCustomers).toHaveBeenCalledWith({
        stage: 'new',
        intent_level: 'hot',
        keyword: '张',
        page: 2,
        page_size: 10,
      })
    })

    it('失败时 loading 仍恢复 false', async () => {
      vi.mocked(fetchCustomers).mockRejectedValue(new Error('network'))

      const store = useCrmStore()
      await expect(store.loadCustomers()).rejects.toThrow('network')

      expect(store.loading).toBe(false)
    })
  })

  describe('addCustomer', () => {
    it('调 createCustomer → loadCustomers，返回新客户 id', async () => {
      vi.mocked(createCustomer).mockResolvedValue({ id: 'c-new' })
      vi.mocked(fetchCustomers).mockResolvedValue({ items: mockCustomers, total: 2 })

      const store = useCrmStore()
      const newId = await store.addCustomer({ name: '王五', phone: '13800009999' })

      expect(newId).toBe('c-new')
      expect(createCustomer).toHaveBeenCalledWith({ name: '王五', phone: '13800009999' })
      expect(fetchCustomers).toHaveBeenCalledTimes(1)
    })
  })

  describe('editCustomer', () => {
    it('调 updateCustomer → loadCustomers', async () => {
      vi.mocked(updateCustomer).mockResolvedValue({ id: 'c1' })
      vi.mocked(fetchCustomers).mockResolvedValue({ items: mockCustomers, total: 2 })

      const store = useCrmStore()
      await store.editCustomer('c1', { name: '张三丰' })

      expect(updateCustomer).toHaveBeenCalledWith('c1', { name: '张三丰' })
      expect(fetchCustomers).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeCustomer', () => {
    it('调 deleteCustomer → loadCustomers', async () => {
      vi.mocked(deleteCustomer).mockResolvedValue({ success: true })
      vi.mocked(fetchCustomers).mockResolvedValue({ items: [mockCustomers[0]], total: 1 })

      const store = useCrmStore()
      await store.removeCustomer('c2')

      expect(deleteCustomer).toHaveBeenCalledWith('c2')
      expect(fetchCustomers).toHaveBeenCalledTimes(1)
    })
  })

  describe('changeStage', () => {
    it('调 updateCustomerStage → loadCustomers', async () => {
      vi.mocked(updateCustomerStage).mockResolvedValue({ id: 'c1', stage: 'following' })
      vi.mocked(fetchCustomers).mockResolvedValue({ items: mockCustomers, total: 2 })

      const store = useCrmStore()
      await store.changeStage('c1', 'following', '客户有意向')

      expect(updateCustomerStage).toHaveBeenCalledWith('c1', 'following', '客户有意向')
      expect(fetchCustomers).toHaveBeenCalledTimes(1)
    })

    it('不传 note 时正常调用', async () => {
      vi.mocked(updateCustomerStage).mockResolvedValue({ id: 'c1', stage: 'negotiated' })
      vi.mocked(fetchCustomers).mockResolvedValue({ items: mockCustomers, total: 2 })

      const store = useCrmStore()
      await store.changeStage('c1', 'negotiated')

      expect(updateCustomerStage).toHaveBeenCalledWith('c1', 'negotiated', undefined)
    })
  })

  describe('addTags', () => {
    it('调 addCustomerTags → loadCustomers', async () => {
      vi.mocked(addCustomerTags).mockResolvedValue({ success: true })
      vi.mocked(fetchCustomers).mockResolvedValue({ items: mockCustomers, total: 2 })

      const store = useCrmStore()
      await store.addTags('c1', ['VIP', '回头客'])

      expect(addCustomerTags).toHaveBeenCalledWith('c1', ['VIP', '回头客'])
      expect(fetchCustomers).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeTag', () => {
    it('调 removeCustomerTag → loadCustomers', async () => {
      vi.mocked(removeCustomerTag).mockResolvedValue({ success: true })
      vi.mocked(fetchCustomers).mockResolvedValue({ items: mockCustomers, total: 2 })

      const store = useCrmStore()
      await store.removeTag('c1', 'VIP')

      expect(removeCustomerTag).toHaveBeenCalledWith('c1', 'VIP')
      expect(fetchCustomers).toHaveBeenCalledTimes(1)
    })
  })

  describe('voiceParse', () => {
    it('返回 parseVoiceInput 结果，不需要 loadCustomers', async () => {
      vi.mocked(parseVoiceInput).mockResolvedValue(mockVoiceResult)

      const store = useCrmStore()
      const result = await store.voiceParse('我想带家人去三亚玩，两个人，预算5000')

      expect(result).toEqual(mockVoiceResult)
      expect(parseVoiceInput).toHaveBeenCalledWith('我想带家人去三亚玩，两个人，预算5000')
      expect(fetchCustomers).not.toHaveBeenCalled()
    })
  })

  describe('loadFunnelStats', () => {
    it('设置 funnelStats，funnelLoading 切换', async () => {
      vi.mocked(fetchFunnelStats).mockResolvedValue(mockFunnelStats)

      const store = useCrmStore()
      const loadPromise = store.loadFunnelStats()
      expect(store.funnelLoading).toBe(true)
      await loadPromise

      expect(store.funnelLoading).toBe(false)
      expect(store.funnelStats).toEqual(mockFunnelStats)
    })

    it('失败时 funnelStats 保持空对象', async () => {
      vi.mocked(fetchFunnelStats).mockRejectedValue(new Error('network'))

      const store = useCrmStore()
      await expect(store.loadFunnelStats()).rejects.toThrow('network')

      expect(store.funnelLoading).toBe(false)
      expect(store.funnelStats).toEqual({})
    })
  })

  describe('loadSilentCustomers', () => {
    it('设置 silentCustomers，silentLoading 切换', async () => {
      vi.mocked(fetchSilentCustomers).mockResolvedValue({ items: [mockCustomers[1]] })

      const store = useCrmStore()
      const loadPromise = store.loadSilentCustomers()
      expect(store.silentLoading).toBe(true)
      await loadPromise

      expect(store.silentLoading).toBe(false)
      expect(store.silentCustomers).toEqual([mockCustomers[1]])
    })
  })

  describe('loadChatTemplates', () => {
    it('设置 chatTemplates，templatesLoading 切换', async () => {
      vi.mocked(fetchChatTemplates).mockResolvedValue({ items: mockTemplates })

      const store = useCrmStore()
      const loadPromise = store.loadChatTemplates('new')
      expect(store.templatesLoading).toBe(true)
      await loadPromise

      expect(store.templatesLoading).toBe(false)
      expect(store.chatTemplates).toEqual(mockTemplates)
      expect(fetchChatTemplates).toHaveBeenCalledWith({ stage: 'new' })
    })

    it('不传 stage 时传 undefined', async () => {
      vi.mocked(fetchChatTemplates).mockResolvedValue({ items: [] })

      const store = useCrmStore()
      await store.loadChatTemplates()

      expect(fetchChatTemplates).toHaveBeenCalledWith(undefined)
    })
  })

  describe('generateTemplates', () => {
    it('设置 chatTemplates，templatesGenerating 切换', async () => {
      vi.mocked(generateChatTemplates).mockResolvedValue({ templates: mockTemplates })

      const store = useCrmStore()
      const genPromise = store.generateTemplates('new', '客户想了解三亚游')
      expect(store.templatesGenerating).toBe(true)
      await genPromise

      expect(store.templatesGenerating).toBe(false)
      expect(store.chatTemplates).toEqual(mockTemplates)
      expect(generateChatTemplates).toHaveBeenCalledWith('new', '客户想了解三亚游')
    })
  })

  describe('loadReminders', () => {
    it('设置 followUpReminders，remindersLoading 切换', async () => {
      vi.mocked(fetchFollowUpReminders).mockResolvedValue({ items: mockReminders })

      const store = useCrmStore()
      const loadPromise = store.loadReminders()
      expect(store.remindersLoading).toBe(true)
      await loadPromise

      expect(store.remindersLoading).toBe(false)
      expect(store.followUpReminders).toEqual(mockReminders)
    })
  })

  describe('createReminder', () => {
    it('调 createFollowUpReminder → loadReminders', async () => {
      vi.mocked(createFollowUpReminder).mockResolvedValue({ id: 'r-new' })
      vi.mocked(fetchFollowUpReminders).mockResolvedValue({ items: mockReminders })

      const store = useCrmStore()
      await store.createReminder({
        customer_id: 'c1',
        remind_at: '2026-06-01T10:00:00Z',
        message: '跟进报价',
      })

      expect(createFollowUpReminder).toHaveBeenCalledWith({
        customer_id: 'c1',
        remind_at: '2026-06-01T10:00:00Z',
        message: '跟进报价',
      })
      expect(fetchFollowUpReminders).toHaveBeenCalledTimes(1)
    })
  })
})
