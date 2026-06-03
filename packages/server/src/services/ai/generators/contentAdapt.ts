/**
 * AI 内容适配器 — 将源内容适配到目标平台
 *
 * 根据目标平台的配置（字数限制、标签格式、语气风格），
 * 用 AI 将源内容重写为平台适配版本。
 */

import { getAIProvider } from '../provider.js'
import { PLATFORM_CONFIGS } from '../../distribution/platformConfigs.js'
import type { Platform } from '@zimti/shared'

interface AdaptInput {
  source_title: string
  source_content: string
  source_tags: string[]
  target_platform: Platform
  brand_context?: string
}

interface AdaptResult {
  adapted_title: string
  adapted_content: string
  adapted_tags: string[]
  character_count: number
}

export async function adaptContentForPlatform(input: AdaptInput): Promise<AdaptResult> {
  const config = PLATFORM_CONFIGS[input.target_platform]
  if (!config) throw new Error(`未知平台: ${input.target_platform}`)

  const provider = getAIProvider()
  const prompt = `你是一位资深自媒体运营专家，擅长将一条内容适配到不同平台。

## 源内容
- 标题：${input.source_title}
- 正文：${input.source_content}
- 标签：${input.source_tags.join('、')}

## 目标平台：${config.name}
- 最大字数：${config.maxLength}
- 标签上限：${config.tagLimit}
- 标签前缀：${config.tagPrefix || '无'}
- 内容格式：${config.contentFormat}
- 语气风格：${config.toneGuidance}
${input.brand_context ? `- 品牌人设：${input.brand_context}` : ''}

## 要求
1. 标题要有吸引力，适合${config.name}的推荐算法
2. 正文严格不超过${config.maxLength}字，风格符合${config.name}
3. 生成不超过${config.tagLimit}个标签，使用"${config.tagPrefix || '纯文字'}"格式
4. 保留核心信息，但用目标平台最合适的表达方式重写

返回 JSON 对象：{ "adapted_title": string, "adapted_content": string, "adapted_tags": string[] }`

  const result = await provider.generate(prompt)
  try {
    const parsed = JSON.parse(result) as AdaptResult
    return {
      adapted_title: parsed.adapted_title ?? input.source_title,
      adapted_content: parsed.adapted_content ?? input.source_content,
      adapted_tags: parsed.adapted_tags ?? input.source_tags,
      character_count: (parsed.adapted_content ?? '').length,
    }
  } catch {
    return {
      adapted_title: input.source_title,
      adapted_content: input.source_content.slice(0, config.maxLength),
      adapted_tags: input.source_tags.slice(0, config.tagLimit),
      character_count: Math.min(input.source_content.length, config.maxLength),
    }
  }
}

/** 批量适配：一个源内容 → 多个平台 */
export async function batchAdaptContent(
  input: Omit<AdaptInput, 'target_platform'> & { platforms: Platform[] },
): Promise<Record<Platform, AdaptResult>> {
  const results: Record<string, AdaptResult> = {}
  for (const platform of input.platforms) {
    results[platform] = await adaptContentForPlatform({
      ...input,
      target_platform: platform,
    })
  }
  return results as Record<Platform, AdaptResult>
}
