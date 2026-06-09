/**
 * 双 AI 战术调度引擎 — 根据客户阶段/意向/健康度自动选择最优 AI 模型和策略
 *
 * 核心思路（借鉴博主"DeepSeek 破冰 + 豆包催单"方案）：
 * - 新客/跟进阶段 → DeepSeek（高情商、自然亲切，擅长建立信任）
 * - 犹豫催单阶段 → GLM（高爆发、紧迫感，擅长推动决策）
 * - 沉默流失客户 → DeepSeek（轻松种草，不施压）
 * - 出行后复购   → GLM（感恩关怀，引导复购/转介绍）
 *
 * 使用方式：
 *   const tactic = selectTactic(stage, intent, health)
 *   const provider = getProviderByName(tactic.provider) ?? getAIProvider()
 *   const result = await provider.generate(tactic.userPromptTemplate, tactic.systemPrompt)
 */

import { GLMProvider } from './glmProvider.js'
import { DeepSeekProvider } from './deepseekProvider.js'
import { getAIProvider } from './provider.js'
import type { AIServiceProvider } from './provider.js'

// --- 类型定义 ---

export type TacticProvider = 'glm' | 'deepseek'

export interface SalesTactic {
  /** 推荐的 AI 提供者 */
  provider: TacticProvider
  /** 人设标签（用于日志和前端展示） */
  persona: string
  /** 语气风格 */
  tone: string
  /** AI 系统提示词 */
  systemPrompt: string
  /** 用户提示词模板（{name}、{context} 为占位符） */
  userPromptTemplate: string
  /** 本次沟通目标 */
  goal: string
  /** 最多生成几条话术 */
  maxSentences: number
}

// --- 战术矩阵 ---

const TACTIC_MATRIX: Record<string, SalesTactic> = {
  new_friend: {
    provider: 'deepseek',
    persona: 'warm_professional',
    tone: '温暖专业',
    systemPrompt: `你是旅游私域运营专家，擅长自然地和新朋友建立联系。
语气要求：
- 像朋友间的关心，不要像客服
- 先了解对方需求，不急于推销
- 用旅行话题破冰（目的地、出行计划、旅行经历）
- 每条话术控制在 30 字以内，简短有力`,
    userPromptTemplate: `为新加好友"{name}"生成 {count} 条破冰消息。
客户背景：{context}

返回 JSON：{ "templates": [{ "content": "话术内容", "category": "greeting|probing|general" }] }`,
    goal: '了解出行需求',
    maxSentences: 3,
  },

  chatting: {
    provider: 'deepseek',
    persona: 'warm_professional',
    tone: '自然引导',
    systemPrompt: `你是旅游私域运营专家，擅长在聊天中自然引导话题到旅行需求。
语气要求：
- 分享旅行见闻或目的地推荐，不要直接推销
- 根据客户兴趣点深入聊
- 每条话术控制在 40 字以内`,
    userPromptTemplate: `为在聊阶段的客户"{name}"生成 {count} 条跟进消息。
客户背景：{context}

返回 JSON：{ "templates": [{ "content": "话术内容", "category": "probing|sharing|general" }] }`,
    goal: '深入了解需求',
    maxSentences: 3,
  },

  deep_consult: {
    provider: 'deepseek',
    persona: 'professional_expert',
    tone: '专业可信赖',
    systemPrompt: `你是资深旅游顾问，擅长用专业知识赢得客户信任。
语气要求：
- 提供具体的行程建议、路线对比、费用说明
- 用数据和案例说话（如"这条路线90%的客户反馈很好"）
- 不回避缺点，真诚地分析优劣势`,
    userPromptTemplate: `为深度咨询的客户"{name}"生成 {count} 条专业回复。
客户背景：{context}

返回 JSON：{ "templates": [{ "content": "话术内容", "category": "objection|closing|general" }] }`,
    goal: '建立专业信任',
    maxSentences: 3,
  },

  hesitating_high: {
    provider: 'glm',
    persona: 'urgent_exclusive',
    tone: '紧迫专属',
    systemPrompt: `你是旅游私域销售精英。客户意向很高但犹豫不决，你需要制造紧迫感推动成交。
关键策略：
- 限时优惠（"这个价格只保留到今晚"）
- 名额紧张（"这个团只剩 2 个位了"）
- 专属感（"我特意为你申请的"）
- 每条话术控制在 35 字以内，短促有力`,
    userPromptTemplate: `客户"{name}"意向很高但犹豫不决，生成 {count} 条促成交消息。
客户背景：{context}

返回 JSON：{ "templates": [{ "content": "话术内容", "category": "closing|objection" }] }`,
    goal: '推动付款决策',
    maxSentences: 2,
  },

  hesitating: {
    provider: 'deepseek',
    persona: 'professional_patient',
    tone: '耐心消除顾虑',
    systemPrompt: `你是旅游私域运营专家。客户在犹豫，需要更多信息和信任才能做决定。
关键策略：
- 提供具体价值：行程亮点、服务承诺、老客户评价
- 消除顾虑：退改政策、安全保障
- 不要催促，让客户自己判断
- 每条话术控制在 40 字以内`,
    userPromptTemplate: `为犹豫中的客户"{name}"生成 {count} 条消息，提供决策依据。
客户背景：{context}

返回 JSON：{ "templates": [{ "content": "话术内容", "category": "objection|closing|general" }] }`,
    goal: '消除顾虑',
    maxSentences: 3,
  },

  at_risk: {
    provider: 'deepseek',
    persona: 'light_engaging',
    tone: '轻松不施压',
    systemPrompt: `你是旅游私域运营专家。客户可能流失，需要重新引起兴趣。
关键策略：
- 发一条轻松的消息，完全不推销
- 分享有趣的目的地内容、旅行小知识、美景图片描述
- 像朋友分享生活一样自然
- 每条话术控制在 30 字以内`,
    userPromptTemplate: `为可能流失的客户"{name}"生成 {count} 条唤醒消息，要轻松自然。
客户背景：{context}

返回 JSON：{ "templates": [{ "content": "话术内容", "category": "general" }] }`,
    goal: '重新激活兴趣',
    maxSentences: 2,
  },

  completed: {
    provider: 'glm',
    persona: 'grateful_caring',
    tone: '感恩关怀',
    systemPrompt: `你是旅游私域运营专家。客户行程已结束，需要表达感谢并引导复购。
关键策略：
- 先真诚关心行程体验
- 自然地引导好评或转介绍
- 可以分享下次旅行的早鸟优惠
- 每条话术控制在 35 字以内`,
    userPromptTemplate: `为已完成行程的客户"{name}"生成 {count} 条感谢+复购引导消息。
客户背景：{context}

返回 JSON：{ "templates": [{ "content": "话术内容", "category": "closing|general" }] }`,
    goal: '复购/转介绍',
    maxSentences: 2,
  },

  repurchase: {
    provider: 'glm',
    persona: 'grateful_caring',
    tone: '老客户专属',
    systemPrompt: `你是旅游私域运营专家。客户是老客户，需要用专属感维持关系。
关键策略：
- 强调"老客户专属"待遇
- 推荐适合他的新路线或季节限定
- 每条话术控制在 35 字以内`,
    userPromptTemplate: `为复购阶段的老客户"{name}"生成 {count} 条推荐消息。
客户背景：{context}

返回 JSON：{ "templates": [{ "content": "话术内容", "category": "closing|probing|general" }] }`,
    goal: '促成二次购买',
    maxSentences: 2,
  },
}

// --- 核心函数 ---

/**
 * 根据客户画像选择最优 AI 战术
 *
 * 优先级：health override > stage+intent 组合 > 默认 stage
 */
export function selectTactic(
  stage: string,
  intent?: string,
  health?: string,
): SalesTactic {
  // 1. 健康度覆盖：流失风险客户优先唤醒
  if (health === 'at_risk' || health === 'lost') {
    return TACTIC_MATRIX.at_risk
  }

  // 2. 犹豫+高意向 → 催单战术
  if (stage === 'hesitating' && intent === 'high') {
    return TACTIC_MATRIX.hesitating_high
  }

  // 3. 已完成 → 复购战术
  if (stage === 'completed') {
    return TACTIC_MATRIX.completed
  }

  // 4. 复购阶段
  if (stage === 'repurchase') {
    return TACTIC_MATRIX.repurchase
  }

  // 5. 按 stage 查找
  return TACTIC_MATRIX[stage] || TACTIC_MATRIX.new_friend
}

/**
 * 按名称获取指定的 AI Provider（用于战术调度）
 * 不可用时返回 null，调用方应 fallback 到 getAIProvider()
 */
export function getProviderByName(name: TacticProvider): AIServiceProvider | null {
  if (name === 'glm') {
    const key = process.env.GLM_API_KEY
    const base = process.env.GLM_BASE_URL
    if (key && base) {
      return new GLMProvider(key, base, process.env.GLM_MODEL ?? 'glm-4-flash')
    }
  }
  if (name === 'deepseek') {
    return DeepSeekProvider.createFromEnv()
  }
  return null
}

/**
 * 根据战术获取 AI Provider（优先用战术指定的，不可用则 fallback）
 */
export function getTacticProvider(tactic: SalesTactic): AIServiceProvider {
  return getProviderByName(tactic.provider) || getAIProvider()
}

/**
 * 格式化战术的用户提示词（替换占位符）
 */
export function formatTacticPrompt(
  template: string,
  vars: { name?: string; context?: string; count?: number },
): string {
  return template
    .replace(/\{name\}/g, vars.name || '客户')
    .replace(/\{context\}/g, vars.context || '暂无背景信息')
    .replace(/\{count\}/g, String(vars.count || 3))
}
