import { BrandMemoryService } from '../aiHub/brandMemory.js'
import { prisma } from '../../db.js'
import { BRAND_KNOWLEDGE_CATEGORY_LABELS, type BrandKnowledgeCategory } from '@zimti/shared'

/**
 * 获取品牌画像上下文，用于注入 AI prompt。
 * 所有 AI generator 应通过此函数获取品牌记忆，确保统一的调用模式。
 *
 * @param userId 用户 ID
 * @returns 品牌画像文本摘要，若未建立则返回空字符串
 */
export async function getBrandContextForPrompt(userId: string): Promise<string> {
  try {
    const brandMemory = new BrandMemoryService(userId)
    const context = await brandMemory.getContext()
    return context || ''
  } catch {
    return ''
  }
}

/**
 * 获取 GEO 企业知识库上下文，用于注入 AI 内容生成。
 * 查询用户激活的知识条目，按分类分组格式化为结构化文本。
 *
 * @param userId 用户 ID
 * @returns 知识库文本摘要，若无激活条目则返回空字符串
 */
export async function getGeoKnowledgeContext(userId: string): Promise<string> {
  try {
    const items = await prisma.brandKnowledge.findMany({
      where: { userId, isActive: true },
      orderBy: { sortOrder: 'desc' },
      take: 50,
    })
    if (items.length === 0) return ''

    const lines: string[] = ['品牌知识库（GEO内容生成参考）：']
    const grouped: Record<string, typeof items> = {}
    for (const item of items) {
      const cat = item.category as BrandKnowledgeCategory
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    }
    for (const [cat, catItems] of Object.entries(grouped)) {
      const label = BRAND_KNOWLEDGE_CATEGORY_LABELS[cat as BrandKnowledgeCategory] ?? cat
      lines.push(`\n## ${label}`)
      for (const item of catItems) {
        lines.push(`### ${item.title}`)
        lines.push(item.content)
      }
    }
    return lines.join('\n')
  } catch {
    return ''
  }
}
