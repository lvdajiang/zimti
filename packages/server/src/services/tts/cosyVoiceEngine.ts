/**
 * CosyVoice TTS 引擎 — 调用阿里云百炼平台 API（备选引擎）
 *
 * 功能:
 *   - synthesize: 用指定音色合成语音
 *   - 中文质量最佳，适合对音质要求高的场景
 *
 * API 文档: https://help.aliyun.com/zh/model-studio/
 * 定价: cosyvoice-v3-flash 约 0.14 元/次
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ITtsEngine, TtsConfig, TtsResult } from './types.js'

const COSYVOICE_API_KEY = () => process.env.COSYVOICE_API_KEY || ''
const COSYVOICE_BASE_URL = () => process.env.COSYVOICE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1'

export class CosyVoiceEngine implements ITtsEngine {
  /** 合成语音 */
  async synthesize(text: string, voiceId: string, config: TtsConfig): Promise<TtsResult> {
    const apiKey = COSYVOICE_API_KEY()
    if (!apiKey) throw new Error('COSYVOICE_API_KEY 未配置，请设置环境变量')

    const outputDir = config.outputDir || join(process.cwd(), 'uploads', 'tts')
    await mkdir(outputDir, { recursive: true })

    // 阿里云百炼 CosyVoice API: 异步提交任务
    const model = (config.model as string) || 'cosyvoice-v3-flash'
    const submitResponse = await fetch(`${COSYVOICE_BASE_URL()}/services/aigc/text2audio/generation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model,
        input: {
          text,
          voice: voiceId || 'longxiaochun',
        },
        parameters: {
          sample_rate: 22050,
          rate: parseRateToSpeed(config.rate),
          pitch_rate: 1.0,
        },
      }),
    })

    if (!submitResponse.ok) {
      const errText = await submitResponse.text()
      throw new Error(`CosyVoice 提交失败 (${submitResponse.status}): ${errText}`)
    }

    const submitData = await submitResponse.json() as any

    // 异步任务模式：轮询获取结果
    const taskId = submitData.output?.task_id
    if (!taskId) {
      // 同步模式：直接返回音频
      if (submitData.output?.audio) {
        const audioBuffer = Buffer.from(submitData.output.audio, 'base64')
        const filename = `cosyvoice_${Date.now()}.mp3`
        const filePath = join(outputDir, filename)
        await writeFile(filePath, audioBuffer)
        return { filePath, duration: estimateDuration(text) }
      }
      throw new Error(`CosyVoice 响应格式异常: ${JSON.stringify(submitData)}`)
    }

    // 轮询异步任务状态
    const resultUrl = `${COSYVOICE_BASE_URL()}/tasks/${taskId}`
    const audioUrl = await pollTaskResult(resultUrl, apiKey)

    // 下载音频文件
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) throw new Error(`CosyVoice 音频下载失败: ${audioResponse.status}`)

    const buffer = Buffer.from(await audioResponse.arrayBuffer())
    const filename = `cosyvoice_${Date.now()}.mp3`
    const filePath = join(outputDir, filename)
    await writeFile(filePath, buffer)

    return { filePath, duration: estimateDuration(text) }
  }
}

/** 轮询异步任务直到完成或超时 */
async function pollTaskResult(resultUrl: string, apiKey: string, maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))

    const response = await fetch(resultUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!response.ok) continue

    const data = await response.json() as any
    const status = data.output?.task_status

    if (status === 'SUCCEEDED') {
      const audioUrl = data.output?.results?.[0]?.url || data.output?.audio_url
      if (!audioUrl) throw new Error('CosyVoice 返回成功但无音频 URL')
      return audioUrl
    }

    if (status === 'FAILED') {
      const msg = data.output?.message || data.output?.code || '未知错误'
      throw new Error(`CosyVoice 合成失败: ${msg}`)
    }

    // PENDING / RUNNING → 继续轮询
  }

  throw new Error('CosyVoice 合成超时')
}

/** 语速字符串 → 数值 */
function parseRateToSpeed(rate?: string): number {
  if (!rate) return 1.0
  const match = rate.match(/([+-]?\d+)%/)
  if (!match) return 1.0
  return 1.0 + parseInt(match[1]) / 100
}

function estimateDuration(text: string): number {
  return Math.max(1, Math.round(text.length / 5))
}
