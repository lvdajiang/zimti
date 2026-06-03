import { BrandMemoryService } from '../aiHub/brandMemory.js'

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
