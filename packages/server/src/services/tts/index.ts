/**
 * TTS 多引擎抽象层
 *
 * 支持:
 *   edge_tts   — Microsoft Edge-TTS（本地 CLI，免费）
 *   fish_audio — Fish Audio 云端 API（音色库 + 声音克隆）
 *   cosyvoice  — 阿里云百炼 CosyVoice（备选，中文质量最佳）
 *   uploaded   — 用户直接上传的录音文件（跳过合成）
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { TtsEngine, type TtsConfig, type TtsResult } from './types.js'
import { EdgeTtsEngine } from './edgeTtsEngine.js'
import { FishAudioEngine } from './fishAudioEngine.js'
import { CosyVoiceEngine } from './cosyVoiceEngine.js'
import { UploadedAudioEngine } from './uploadedAudioEngine.js'

export * from './types.js'
export { EdgeTtsEngine } from './edgeTtsEngine.js'
export { FishAudioEngine } from './fishAudioEngine.js'
export { CosyVoiceEngine } from './cosyVoiceEngine.js'
export { UploadedAudioEngine } from './uploadedAudioEngine.js'

const TTS_CACHE_DIR = join(process.cwd(), 'uploads', 'tts')

/** 引擎注册表 */
const engines: Partial<Record<TtsEngine, { synthesize(text: string, voiceId: string, config: TtsConfig): Promise<TtsResult> }>> = {}

export function registerEngine(name: TtsEngine, engine: { synthesize(text: string, voiceId: string, config: TtsConfig): Promise<TtsResult> }): void {
  engines[name] = engine
}

/** 初始化所有引擎 */
export function initTtsEngines(): void {
  registerEngine('edge_tts', new EdgeTtsEngine())
  registerEngine('fish_audio', new FishAudioEngine())
  registerEngine('uploaded', new UploadedAudioEngine())

  // CosyVoice 为备选引擎，需要配置 COSYVOICE_API_KEY 才可用
  if (process.env.COSYVOICE_API_KEY) {
    registerEngine('cosyvoice', new CosyVoiceEngine())
  }

  const registered = Object.keys(engines).join(', ')
  console.log(`[TTS] 引擎已注册: ${registered}`)
}

/**
 * 统一合成入口（向后兼容）
 */
export async function synthesizeSpeech(options: {
  text: string
  voice?: string
  rate?: string
  volume?: string
  outputDir?: string
  engine?: TtsEngine
}): Promise<{ filePath: string; duration: number }> {
  const engineName = options.engine || 'edge_tts'
  const engine = engines[engineName]
  if (!engine) throw new Error(`TTS engine "${engineName}" not registered`)

  const outputDir = options.outputDir || TTS_CACHE_DIR
  await mkdir(outputDir, { recursive: true })

  const result = await engine.synthesize(options.text, options.voice || 'zh-CN-XiaoxiaoNeural', {
    rate: options.rate || '+0%',
    volume: options.volume || '+0%',
    outputDir,
  })

  return { filePath: result.filePath, duration: result.duration }
}

/** 试听预览（截取前 200 字） */
export async function previewTTS(text: string, voice?: string, engine?: TtsEngine): Promise<string> {
  const result = await synthesizeSpeech({ text: text.slice(0, 200), voice, engine })
  return result.filePath
}
