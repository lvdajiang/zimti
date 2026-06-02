import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchCustomers, createCustomer, updateCustomer, deleteCustomer,
  updateCustomerStage, addCustomerTags, removeCustomerTag,
  parseVoiceInput, fetchChatTemplates, generateChatTemplates,
  fetchFollowUpReminders, createFollowUpReminder, fetchSilentCustomers, fetchFunnelStats,
  fetchContactHealth, batchGenerateWakeScripts, fetchFunnelAnalysis,
} from '../api/crm'
import type { Customer, ChatTemplate, FollowUpReminder, FunnelStats, VoiceInputResult, ContactHealthItem, WakeScript, FunnelAnalysis } from '../api/crm'
import type { CustomerStage, IntentLevel } from '@zimti/shared'

export const useCrmStore = defineStore('crm', () => {
  // 客户列表
  const customers = ref<Customer[]>([])
  const total = ref(0)
  const loading = ref(false)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const filterStage = ref<CustomerStage | ''>('')
  const filterIntent = ref<IntentLevel | ''>('')
  const filterKeyword = ref('')

  // 漏斗统计
  const funnelStats = ref<FunnelStats>({})
  const funnelLoading = ref(false)

  // 沉默客户
  const silentCustomers = ref<Customer[]>([])
  const silentLoading = ref(false)

  // 话术模板
  const chatTemplates = ref<ChatTemplate[]>([])
  const templatesLoading = ref(false)
  const templatesGenerating = ref(false)

  // 跟进提醒
  const followUpReminders = ref<FollowUpReminder[]>([])
  const remindersLoading = ref(false)

  // 联系人健康度
  const contactHealthList = ref<ContactHealthItem[]>([])
  const healthLoading = ref(false)

  // 唤醒话术
  const wakeScripts = ref<WakeScript[]>([])
  const wakeGenerating = ref(false)

  // 漏斗分析（详细版）
  const funnelAnalysis = ref<FunnelAnalysis | null>(null)
  const funnelAnalysisLoading = ref(false)

  async function loadCustomers(): Promise<void> {
    loading.value = true
    try {
      const res = await fetchCustomers({
        stage: filterStage.value || undefined,
        intent_level: filterIntent.value || undefined,
        keyword: filterKeyword.value || undefined,
        page: currentPage.value,
        page_size: pageSize.value,
      })
      customers.value = res.items
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function addCustomer(data: Parameters<typeof createCustomer>[0]): Promise<string> {
    const res = await createCustomer(data)
    await loadCustomers()
    return res.id
  }

  async function editCustomer(id: string, data: Parameters<typeof updateCustomer>[1]): Promise<void> {
    await updateCustomer(id, data)
    await loadCustomers()
  }

  async function removeCustomer(id: string): Promise<void> {
    await deleteCustomer(id)
    await loadCustomers()
  }

  async function changeStage(id: string, stage: CustomerStage, note?: string): Promise<void> {
    await updateCustomerStage(id, stage, note)
    await loadCustomers()
  }

  async function addTags(id: string, tags: string[]): Promise<void> {
    await addCustomerTags(id, tags)
    await loadCustomers()
  }

  async function removeTag(id: string, tag: string): Promise<void> {
    await removeCustomerTag(id, tag)
    await loadCustomers()
  }

  async function voiceParse(text: string): Promise<VoiceInputResult> {
    return parseVoiceInput(text)
  }

  async function loadFunnelStats(): Promise<void> {
    funnelLoading.value = true
    try {
      funnelStats.value = await fetchFunnelStats()
    } finally {
      funnelLoading.value = false
    }
  }

  async function loadSilentCustomers(): Promise<void> {
    silentLoading.value = true
    try {
      const res = await fetchSilentCustomers()
      silentCustomers.value = res.items
    } finally {
      silentLoading.value = false
    }
  }

  async function loadChatTemplates(stage?: string): Promise<void> {
    templatesLoading.value = true
    try {
      const res = await fetchChatTemplates(stage ? { stage } : undefined)
      chatTemplates.value = res.items
    } finally {
      templatesLoading.value = false
    }
  }

  async function generateTemplates(stage: string, customerContext?: string): Promise<void> {
    templatesGenerating.value = true
    try {
      const res = await generateChatTemplates(stage, customerContext)
      chatTemplates.value = res.templates
    } finally {
      templatesGenerating.value = false
    }
  }

  async function loadReminders(): Promise<void> {
    remindersLoading.value = true
    try {
      const res = await fetchFollowUpReminders()
      followUpReminders.value = res.items
    } finally {
      remindersLoading.value = false
    }
  }

  async function createReminder(data: { customer_id: string; remind_at: string; message?: string }): Promise<void> {
    await createFollowUpReminder(data)
    await loadReminders()
  }

  async function loadContactHealth(params?: { health?: string }): Promise<void> {
    healthLoading.value = true
    try {
      const res = await fetchContactHealth(params)
      contactHealthList.value = res.items
    } finally {
      healthLoading.value = false
    }
  }

  async function generateWakeScripts(customerIds: string[]): Promise<void> {
    wakeGenerating.value = true
    try {
      const res = await batchGenerateWakeScripts(customerIds)
      wakeScripts.value = res.items
    } finally {
      wakeGenerating.value = false
    }
  }

  async function loadFunnelAnalysis(params?: {
    start_date?: string
    end_date?: string
    source_type?: string
    tags?: string[]
  }): Promise<void> {
    funnelAnalysisLoading.value = true
    try {
      funnelAnalysis.value = await fetchFunnelAnalysis(params)
    } finally {
      funnelAnalysisLoading.value = false
    }
  }

  return {
    customers, total, loading, currentPage, pageSize,
    filterStage, filterIntent, filterKeyword,
    funnelStats, funnelLoading,
    silentCustomers, silentLoading,
    chatTemplates, templatesLoading, templatesGenerating,
    followUpReminders, remindersLoading,
    loadCustomers, addCustomer, editCustomer, removeCustomer,
    changeStage, addTags, removeTag, voiceParse,
    loadFunnelStats, loadSilentCustomers,
    loadChatTemplates, generateTemplates,
    loadReminders, createReminder,
    contactHealthList, healthLoading, loadContactHealth,
    wakeScripts, wakeGenerating, generateWakeScripts,
    funnelAnalysis, funnelAnalysisLoading, loadFunnelAnalysis,
  }
})
