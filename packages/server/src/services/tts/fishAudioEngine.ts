/**
 * Fish Audio TTS 引擎 — 调用 Fish Audio 云端 API
 *
 * 功能:
 *   - synthesize: 用指定音色合成语音
 *   - cloneVoice: 从音频文件创建克隆音色
 *   - listVoices: 列出可用音色
 *
 * API 文档: https://docs.fish.audio
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ITtsEngine, TtsConfig, TtsResult, FishCloneResult } from './types.js'

const FISH_API_KEY = () => process.env.FISH_AUDIO_API_KEY || ''
const FISH_BASE_URL = () => process.env.FISH_AUDIO_BASE_URL || 'https://api.fish.audio'

export class FishAudioEngine implements ITtsEngine {
  /** 合成语音 */
  async synthesize(text: string, voiceId: string, config: TtsConfig): Promise<TtsResult> {
    const apiKey = FISH_API_KEY()
    if (!apiKey) throw new Error('FISH_AUDIO_API_KEY 未配置')

    const outputDir = config.outputDir || join(process.cwd(), 'uploads', 'tts')
    await mkdir(outputDir, { recursive: true })

    // Fish Audio TTS API: POST /v1/tts
    const response = await fetch(`${FISH_BASE_URL()}/v1/tts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        speed: parseRateToSpeed(config.rate),
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Fish Audio TTS 失败 (${response.status}): ${errText}`)
    }

    // 响应是音频二进制流
    const buffer = Buffer.from(await response.arrayBuffer())
    const filename = `fish_${Date.now()}.mp3`
    const filePath = join(outputDir, filename)
    await writeFile(filePath, buffer)

    return { filePath, duration: estimateDuration(text) }
  }

  /** 从音频样本创建克隆音色 */
  async cloneVoice(audioBuffer: Buffer, audioName: string, voiceName: string): Promise<FishCloneResult> {
    const apiKey = FISH_API_KEY()
    if (!apiKey) throw new Error('FISH_AUDIO_API_KEY 未配置')

    // 上传音频文件到 Fish Audio
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' })
    formData.append('audio', blob, audioName)
    formData.append('name', voiceName)
    formData.append('description', `自定义克隆音色: ${voiceName}`)

    const response = await fetch(`${FISH_BASE_URL()}/v1/model`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Fish Audio 克隆失败 (${response.status}): ${errText}`)
    }

    const data = await response.json() as any
    return {
      referenceId: data.reference_id || data.id || data.model_id,
      name: voiceName,
      audioUrl: data.audio_url || '',
    }
  }

  /** 列出可用音色 */
  async listVoices(page: number = 1, pageSize: number = 20): Promise<any[]> {
    const apiKey = FISH_API_KEY()
    if (!apiKey) return []

    const response = await fetch(
      `${FISH_BASE_URL()}/v1/model?page=${page}&pageSize=${pageSize}&self=true`,
      {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      },
    )

    if (!response.ok) return []
    const data = await response.json() as any
    return data.items || data.data || []
  }
}

/** 语速字符串 "+10%" → Fish Audio speed 数值 */
function parseRateToSpeed(rate?: string): number {
  if (!rate) return 1.0
  const match = rate.match(/([+-]?\d+)%/)
  if (!match) return 1.0
  return 1.0 + parseInt(match[1]) / 100
}

function estimateDuration(text: string): number {
  return Math.max(1, Math.round(text.length / 5))
}
