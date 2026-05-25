import Anthropic from '@anthropic-ai/sdk'
import type { AIServiceProvider } from './provider.js'

export class DeepSeekProvider implements AIServiceProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, baseURL: string, model = 'deepseek-chat') {
    this.client = new Anthropic({ apiKey, baseURL })
    this.model = model
  }

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt ?? '你是一个专业的自媒体运营顾问。返回 JSON 格式的结果。',
      messages: [{ role: 'user', content: prompt }],
    })

    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from DeepSeek API')
    return block.text
  }

  static createFromEnv(): DeepSeekProvider | null {
    const apiKey = process.env.DEEPSEEK_API_KEY
    const baseURL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'
    if (!apiKey) return null
    return new DeepSeekProvider(apiKey, baseURL, model)
  }
}
