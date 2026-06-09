/**
 * PromptEngine — 提示词引擎主入口
 *
 * 渲染优先级：用户自定义 > 系统预设(DB) > 内存种子 > 硬编码降级
 * 故障时不阻断业务，降级到 fallbackHardcoded
 */

import { prisma } from '../../db.js'
import { renderTemplate, type PromptVariables, type RenderedPrompt, type VariableDef } from './renderer.js'
import { SEED_PROMPTS } from './seedPrompts.js'

export type { PromptVariables, RenderedPrompt, VariableDef }

/**
 * 渲染指定步骤的提示词
 *
 * @param stepKey 步骤标识（如 'topic_generate'）
 * @param variables 模板变量值
 * @param userId 用户 ID（可选，传则查自定义模板）
 * @param fallbackHardcoded 硬编码降级函数
 */
export async function renderPrompt(
  stepKey: string,
  variables: PromptVariables,
  userId?: string,
  fallbackHardcoded?: (vars: PromptVariables) => RenderedPrompt,
): Promise<RenderedPrompt> {
  try {
    // 1. 查找用户自定义模板
    let template = null
    if (userId) {
      template = await prisma.promptTemplate.findFirst({
        where: { userId, stepKey, isActive: true },
      })
    }

    // 2. 查找系统预设
    if (!template) {
      template = await prisma.promptTemplate.findFirst({
        where: { userId: null, stepKey, isActive: true },
      })
    }

    // 3. 使用内存种子
    if (!template) {
      const seed = SEED_PROMPTS[stepKey]
      if (seed) {
        const variableDefs = seed.variableDefs as VariableDef[]
        return {
          systemPrompt: seed.systemPrompt ?? undefined,
          userPrompt: renderTemplate(seed.userPromptTemplate, variables, variableDefs),
        }
      }
    }

    // 4. 渲染数据库中的模板
    if (template) {
      const variableDefs = (template.variableDefs as unknown as VariableDef[]) ?? []
      return {
        systemPrompt: template.systemPrompt ?? undefined,
        userPrompt: renderTemplate(template.userPromptTemplate, variables, variableDefs),
      }
    }

    // 5. 硬编码降级
    if (fallbackHardcoded) {
      return fallbackHardcoded(variables)
    }

    throw new Error(`未找到步骤 "${stepKey}" 的提示词模板`)
  } catch (error) {
    // PromptEngine 故障不阻断业务
    if (fallbackHardcoded) {
      console.warn(`[PromptEngine] 渲染失败，降级到硬编码: ${error instanceof Error ? error.message : error}`)
      return fallbackHardcoded(variables)
    }
    throw error
  }
}

/**
 * 种子初始化：将系统预设提示词写入数据库（幂等）
 * 应用启动时调用一次
 */
export async function seedPromptTemplates(): Promise<void> {
  let count = 0
  for (const [stepKey, seed] of Object.entries(SEED_PROMPTS)) {
    await prisma.promptTemplate.upsert({
      where: {
        userId_stepKey: { userId: '', stepKey } as any,
      },
      update: {},  // 已存在不覆盖（用户可能通过管理界面修改过）
      create: {
        userId: null,
        stepKey,
        label: seed.label,
        description: seed.description,
        systemPrompt: seed.systemPrompt,
        userPromptTemplate: seed.userPromptTemplate,
        variableDefs: seed.variableDefs as any,
        isActive: true,
        version: 1,
      },
    })
    count++
  }
  console.log(`[PromptEngine] 已播种 ${count} 个系统预设模板`)
}
