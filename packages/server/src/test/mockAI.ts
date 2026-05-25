import { AIServiceProvider, setAIProvider } from '../services/ai/provider.js'

export class TestableAIProvider implements AIServiceProvider {
  private responses: string[]
  private calls: Array<{ prompt: string; systemPrompt?: string }> = []
  private index = 0

  constructor(responses: string[]) {
    this.responses = responses
  }

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    this.calls.push({ prompt, systemPrompt })
    if (this.index >= this.responses.length) {
      throw new Error(`TestableAIProvider: 调用次数(${this.calls.length})超过预设响应数(${this.responses.length})`)
    }
    return this.responses[this.index++]
  }

  getCalls(): Array<{ prompt: string; systemPrompt?: string }> {
    return [...this.calls]
  }

  callCount(): number {
    return this.calls.length
  }
}

export function mockAI(responses: string[]): TestableAIProvider {
  const provider = new TestableAIProvider(responses)
  setAIProvider(provider)
  return provider
}

class NullAIProvider implements AIServiceProvider {
  async generate(): Promise<string> {
    throw new Error('No AI provider configured')
  }
}

export function clearMockAI(): void {
  setAIProvider(new NullAIProvider())
}
