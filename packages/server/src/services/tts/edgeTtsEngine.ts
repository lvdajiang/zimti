/**
 * Edge-TTS 引擎 — 调用本地 edge-tts Python CLI
 */
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type { ITtsEngine, TtsConfig, TtsResult } from './types.js'

export class EdgeTtsEngine implements ITtsEngine {
  async synthesize(text: string, voiceId: string, config: TtsConfig): Promise<TtsResult> {
    const outputDir = config.outputDir || join(process.cwd(), 'uploads', 'tts')
    const filename = `tts_${Date.now()}.mp3`
    const filePath = join(outputDir, filename)

    const args = [
      '--voice', voiceId,
      '--rate', config.rate || '+0%',
      '--volume', config.volume || '+0%',
      '--write-media', filePath,
      '--text', text,
    ]

    await new Promise<void>((resolve, reject) => {
      execFile('edge-tts', args, { timeout: 60000 }, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    return { filePath, duration: estimateDuration(text) }
  }
}

function estimateDuration(text: string): number {
  return Math.max(1, Math.round(text.length / 5))
}
