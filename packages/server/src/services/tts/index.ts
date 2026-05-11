import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface TTSOptions {
  text: string
  voice?: string
  rate?: string
  volume?: string
  outputDir?: string
}

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'
const TTS_CACHE_DIR = join(process.cwd(), 'uploads', 'tts')

export async function synthesizeSpeech(options: TTSOptions): Promise<{ filePath: string; duration: number }> {
  const { text, voice = DEFAULT_VOICE, rate = '+0%', volume = '+0%', outputDir = TTS_CACHE_DIR } = options

  await mkdir(outputDir, { recursive: true })
  const filename = `tts_${Date.now()}.mp3`
  const filePath = join(outputDir, filename)

  await new Promise<void>((resolve, reject) => {
    const args = [
      '--voice', voice, '--rate', rate, '--volume', volume,
      '--write-media', filePath, '--text', text,
    ]
    execFile('edge-tts', args, { timeout: 60000 }, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })

  const duration = estimateDuration(text)
  return { filePath, duration }
}

export async function previewTTS(text: string, voice?: string): Promise<string> {
  const result = await synthesizeSpeech({ text: text.slice(0, 200), voice })
  return result.filePath
}

function estimateDuration(text: string): number {
  const charCount = text.length
  return Math.max(1, Math.round(charCount / 5))
}
