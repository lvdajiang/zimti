import { prisma } from '../../db.js'
import { DEMO_USER_ID } from '../../constants.js'
import { getAIProvider } from '../ai/provider.js'
import type { BrandMemoryCategory } from '@zimti/shared'

export class BrandMemoryService {
  private userId: string

  constructor(userId: string = DEMO_USER_ID) {
    this.userId = userId
  }

  async getProfile(): Promise<Record<string, unknown>> {
    const memories = await prisma.brandMemory.findMany({
      where: { userId: this.userId },
      orderBy: { weight: 'desc' },
    })

    const profile: Record<string, Record<string, unknown>> = {}
    for (const m of memories) {
      if (!profile[m.category]) profile[m.category] = {}
      profile[m.category][m.key] = m.value
    }
    return profile
  }

  async getCategory(category: BrandMemoryCategory): Promise<Record<string, unknown>> {
    const memories = await prisma.brandMemory.findMany({
      where: { userId: this.userId, category },
    })
    const result: Record<string, unknown> = {}
    for (const m of memories) {
      result[m.key] = m.value
    }
    return result
  }

  async upsert(category: BrandMemoryCategory, key: string, value: unknown, source = 'manual', weight = 1.0): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonValue = JSON.parse(JSON.stringify(value)) as any
    await prisma.brandMemory.upsert({
      where: { userId_category_key: { userId: this.userId, category, key } },
      update: { value: jsonValue, source, weight },
      create: { userId: this.userId, category, key, value: jsonValue, source, weight },
    })
  }

  async batchUpsert(items: Array<{ category: BrandMemoryCategory; key: string; value: unknown; source?: string; weight?: number }>): Promise<void> {
    for (const item of items) {
      await this.upsert(item.category, item.key, item.value, item.source ?? 'manual', item.weight ?? 1.0)
    }
  }

  async learnStyle(originalText: string, modifiedText: string): Promise<void> {
    const ai = getAIProvider()
    if (!ai) return

    const prompt = `分析用户对 AI 生成文案的修改，提炼用户偏好规则。

原始文案：
${originalText}

修改后文案：
${modifiedText}

请分析：
1. 用户把哪些词/句式替换了？（如：把"不可错过"改成"绝了"）
2. 用户的语言风格特征是什么？
3. 用户避免使用哪些表达？

返回 JSON 格式：
{
  "replacements": [{"from": "...", "to": "..."}],
  "style_rules": ["规则1", "规则2"],
  "avoid_expressions": ["表达1", "表达2"]
}`

    try {
      const result = await ai.generate(prompt)
      const parsed = JSON.parse(result)

      if (parsed.replacements?.length) {
        await this.upsert('style', 'word_replacements',
          parsed.replacements, 'learned', 0.8)
      }
      if (parsed.style_rules?.length) {
        const existing = await this.getCategory('style')
        const rules = [
          ...((existing.style_rules as string[]) ?? []),
          ...parsed.style_rules,
        ]
        await this.upsert('style', 'style_rules', [...new Set(rules)], 'learned')
      }
      if (parsed.avoid_expressions?.length) {
        const existing = await this.getCategory('preference')
        const avoid = [
          ...((existing.avoid_expressions as string[]) ?? []),
          ...parsed.avoid_expressions,
        ]
        await this.upsert('preference', 'avoid_expressions', [...new Set(avoid)], 'learned')
      }
    } catch {
      // LLM 解析失败，静默忽略
    }
  }

  async getContext(): Promise<string> {
    const profile = await this.getProfile()
    if (Object.keys(profile).length === 0) return ''

    const lines: string[] = ['品牌画像：']
    for (const [cat, items] of Object.entries(profile)) {
      const entries = items as Record<string, unknown>
      for (const [key, val] of Object.entries(entries)) {
        lines.push(`- [${cat}] ${key}: ${JSON.stringify(val)}`)
      }
    }
    return lines.join('\n')
  }

  async delete(category: BrandMemoryCategory, key: string): Promise<void> {
    await prisma.brandMemory.delete({
      where: { userId_category_key: { userId: this.userId, category, key } },
    })
  }
}
