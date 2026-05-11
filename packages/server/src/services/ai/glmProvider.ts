import Anthropic from '@anthropic-ai/sdk'
import type { AIServiceProvider } from './provider.js'

export class GLMProvider implements AIServiceProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, baseURL: string, model = 'glm-5-turbo') {
    this.client = new Anthropic({ apiKey, baseURL })
    this.model = model
  }

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt ?? '你是一个专业的短视频内容创作助手。返回 JSON 格式的结果。',
      messages: [{ role: 'user', content: prompt }],
    })

    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from GLM API')
    return block.text
  }
}
