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

export function getAIProvider(): AIServiceProvider {
  if (!_provider) {
    _provider = new MockAIProvider()
  }
  return _provider
}

export function setAIProvider(provider: AIServiceProvider): void {
  _provider = provider
}
