/**
 * AI 销售分身人设系统 — 统一的销售人格，维持一致的沟通风格
 *
 * 核心能力：
 * 1. 从品牌记忆加载销售人设（名字、性格、风格、专长）
 * 2. 构建人设系统提示词（注入品牌知识 + 客户上下文）
 * 3. 加载客户记忆（标签、意向、备注、历史交互）
 *
 * 与战术调度器(salesTacticEngine)配合：
 *   人设 = "你是谁"（稳定不变）
 *   战术 = "你怎么做"（随客户阶段变化）
 *   最终 prompt = 人设系统词 + 战术策略词
 */

import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { getBrandContextForPrompt } from './brandContext.js'
import { BrandMemoryService } from '../aiHub/brandMemory.js'

// --- 类型定义 ---

export interface SalesPersona {
  /** 销售分身名字 */
  name: string
  /** 角色定位 */
  role: string
  /** 性格特点 */
  personality: string[]
  /** 沟通风格描述 */
  communicationStyle: string
  /** 专长领域 */
  expertise: string[]
  /** 问候语 */
  greeting: string
  /** 禁忌话题 */
  tabooTopics: string[]
}

// --- 默认人设 ---

const DEFAULT_PERSONA: SalesPersona = {
  name: '小林',
  role: '专属旅游顾问',
  personality: ['热情', '专业', '细心', '真诚'],
  communicationStyle: '朋友式沟通，自然亲切不造作，像认识很久的朋友聊天',
  expertise: ['新疆旅游', '定制路线', '自驾游'],
  greeting: '嗨~我是你的专属旅游顾问',
  tabooTopics: [],
}

// --- 销售人设服务 ---

export class SalesPersonaService {
  private userId: string

  constructor(userId: string = DEMO_USER_ID) {
    this.userId = userId
  }

  /**
   * 获取当前销售人设
   * 从品牌记忆加载，缺省用默认人设
   */
  async getPersona(): Promise<SalesPersona> {
    try {
      const brandMemory = new BrandMemoryService(this.userId)
      const profile = await brandMemory.getCategory('profile')

      return {
        name: (profile.sales_persona_name as string) || DEFAULT_PERSONA.name,
        role: (profile.sales_persona_role as string) || DEFAULT_PERSONA.role,
        personality: (profile.sales_persona_personality as string[]) || DEFAULT_PERSONA.personality,
        communicationStyle: (profile.sales_persona_style as string) || DEFAULT_PERSONA.communicationStyle,
        expertise: (profile.sales_persona_expertise as string[]) || DEFAULT_PERSONA.expertise,
        greeting: (profile.sales_persona_greeting as string) || DEFAULT_PERSONA.greeting,
        tabooTopics: (profile.sales_persona_taboo as string[]) || DEFAULT_PERSONA.tabooTopics,
      }
    } catch {
      return DEFAULT_PERSONA
    }
  }

  /**
   * 构建人设系统提示词（"你是谁"部分）
   * 可与战术调度器的 systemPrompt 合并使用
   */
  async buildPersonaSystemPrompt(stage?: string): Promise<string> {
    const persona = await this.getPersona()
    const brandContext = await getBrandContextForPrompt(this.userId)

    const parts: string[] = []

    // 核心人设
    parts.push(`你是${persona.name}，一位${persona.role}。`)
    parts.push(`性格特点：${persona.personality.join('、')}。`)
    parts.push(`沟通风格：${persona.communicationStyle}。`)

    if (persona.expertise.length > 0) {
      parts.push(`专长领域：${persona.expertise.join('、')}。`)
    }

    // 阶段行为指导
    if (stage) {
      const stageGuidance: Record<string, string> = {
        new_friend: '现在你刚加了一个新好友，要自然地打招呼和了解对方需求。',
        chatting: '你正在和客户聊天，自然地引导话题到旅行需求。',
        deep_consult: '客户在深度咨询中，展示你的专业度，用数据和案例说话。',
        hesitating: '客户在犹豫，用专业和真诚帮对方做决定，不要催促。',
        ordered: '客户已下单，做好行前服务和期待感营造。',
        traveling: '客户正在出行中，提供贴心关怀。',
        completed: '客户行程结束了，表达感谢，自然地引导复购或转介绍。',
        repurchase: '这是老客户，用专属感维持关系，推荐适合的新路线。',
      }
      const guidance = stageGuidance[stage]
      if (guidance) parts.push(guidance)
    }

    // 禁忌话题
    if (persona.tabooTopics.length > 0) {
      parts.push(`禁忌话题：${persona.tabooTopics.join('、')}。绝口不提。`)
    }

    // 品牌知识
    if (brandContext) {
      parts.push(`\n品牌背景信息：\n${brandContext}`)
    }

    return parts.join('\n')
  }

  /**
   * 获取客户记忆（用于个性化话术）
   */
  async getCustomerMemory(customerId: string): Promise<string> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        tags: { select: { tag: true } },
      },
    })
    if (!customer) return ''

    const parts: string[] = []
    parts.push(`客户姓名：${customer.name}`)

    if (customer.stage) parts.push(`当前阶段：${customer.stage}`)
    if (customer.intentLevel) parts.push(`意向等级：${customer.intentLevel}`)
    if (customer.tags.length > 0) parts.push(`标签：${customer.tags.map(t => t.tag).join('、')}`)

    if (customer.travelIntent) {
      const intent = customer.travelIntent as Record<string, unknown>
      const intentParts: string[] = []
      if (intent.destination) intentParts.push(`目的地:${intent.destination}`)
      if (intent.people) intentParts.push(`人数:${intent.people}`)
      if (intent.date) intentParts.push(`出行时间:${intent.date}`)
      if (intent.budget) intentParts.push(`预算:${intent.budget}`)
      if (intentParts.length) parts.push(`出行意向：${intentParts.join('、')}`)
    }

    if (customer.phone) parts.push(`手机：${customer.phone}`)
    if (customer.notes) parts.push(`备注：${customer.notes}`)

    // 最后跟进时间
    if (customer.lastFollowUpAt) {
      const daysSince = Math.floor((Date.now() - customer.lastFollowUpAt.getTime()) / (24 * 60 * 60 * 1000))
      parts.push(`最后跟进：${daysSince}天前`)
    }

    return parts.join('\n')
  }

  /**
   * 更新销售人设（写入品牌记忆）
   */
  async updatePersona(updates: Partial<SalesPersona>): Promise<void> {
    const brandMemory = new BrandMemoryService(this.userId)
    const items: Array<{ category: 'profile'; key: string; value: unknown }> = []

    if (updates.name !== undefined) items.push({ category: 'profile', key: 'sales_persona_name', value: updates.name })
    if (updates.role !== undefined) items.push({ category: 'profile', key: 'sales_persona_role', value: updates.role })
    if (updates.personality !== undefined) items.push({ category: 'profile', key: 'sales_persona_personality', value: updates.personality })
    if (updates.communicationStyle !== undefined) items.push({ category: 'profile', key: 'sales_persona_style', value: updates.communicationStyle })
    if (updates.expertise !== undefined) items.push({ category: 'profile', key: 'sales_persona_expertise', value: updates.expertise })
    if (updates.greeting !== undefined) items.push({ category: 'profile', key: 'sales_persona_greeting', value: updates.greeting })
    if (updates.tabooTopics !== undefined) items.push({ category: 'profile', key: 'sales_persona_taboo', value: updates.tabooTopics })

    if (items.length > 0) {
      await brandMemory.batchUpsert(items)
    }
  }
}
