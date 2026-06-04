import { GLMProvider } from './glmProvider.js'
import { DeepSeekProvider } from './deepseekProvider.js'

export interface AIServiceProvider {
  generate(prompt: string, systemPrompt?: string): Promise<string>
}

export class MockAIProvider implements AIServiceProvider {
  private delay: number

  constructor(delayMs = 500) {
    this.delay = delayMs
  }

  async generate(prompt: string, _systemPrompt?: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, this.delay))
    return `[Mock] 基于 prompt "${prompt.slice(0, 50)}..." 的模拟回复。当前使用 MockAIProvider，请配置真实 AI 提供者。`
  }
}

let _provider: AIServiceProvider | null = null

/**
 * 自动从环境变量初始化 AI Provider
 * 优先级：GLM → DeepSeek → Mock
 */
export function getAIProvider(): AIServiceProvider {
  if (!_provider) {
    // 1. 尝试 GLM
    const glmKey = process.env.GLM_API_KEY
    const glmBase = process.env.GLM_BASE_URL
    if (glmKey && glmBase) {
      const model = process.env.GLM_MODEL ?? 'glm-4-flash'
      console.log(`[AI Provider] 使用 GLM (${model})`)
      _provider = new GLMProvider(glmKey, glmBase, model)
      return _provider
    }

    // 2. 尝试 DeepSeek
    const dsProvider = DeepSeekProvider.createFromEnv()
    if (dsProvider) {
      console.log('[AI Provider] 使用 DeepSeek')
      _provider = dsProvider
      return _provider
    }

    // 3. 降级 Mock
    console.warn('[AI Provider] ⚠️ 未配置 GLM_API_KEY 或 DEEPSEEK_API_KEY，使用 MockAIProvider')
    _provider = new MockAIProvider()
  }
  return _provider
}

export function setAIProvider(provider: AIServiceProvider): void {
  _provider = provider
}
