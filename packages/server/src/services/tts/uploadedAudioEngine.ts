/**
 * 上传音频引擎 — 模式 C（自己录音）
 *
 * 不做合成，直接返回用户上传的音频文件路径。
 * 由 voiceProfiles 路由处理文件上传和存储。
 */
import { mkdir, copyFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { ITtsEngine, TtsConfig, TtsResult } from './types.js'

export class UploadedAudioEngine implements ITtsEngine {
  /**
   * voiceId 在这里是已上传的音频文件路径
   * 直接返回该路径（不合成）
   */
  async synthesize(_text: string, voiceId: string, config: TtsConfig): Promise<TtsResult> {
    const outputDir = config.outputDir || join(process.cwd(), 'uploads', 'tts')
    await mkdir(outputDir, { recursive: true })

    // voiceId 即上传的音频路径，直接复制到输出目录
    const filename = `uploaded_${Date.now()}_${basename(voiceId)}`
    const filePath = join(outputDir, filename)
    await copyFile(voiceId, filePath)

    // 上传音频无法精确估算时长，返回默认值
    // 实际时长由前端 audio 元素自动获取
    return { filePath, duration: 0 }
  }
}
