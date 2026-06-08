/** TTS 引擎名称 */
export type TtsEngine = 'edge_tts' | 'fish_audio' | 'cosyvoice' | 'uploaded'

/** TTS 合成配置 */
export interface TtsConfig {
  rate?: string       // 语速，如 "+0%", "+10%"
  volume?: string     // 音量，如 "+0%"
  outputDir?: string  // 输出目录
  [key: string]: unknown
}

/** TTS 合成结果 */
export interface TtsResult {
  filePath: string
  duration: number    // 秒
}

/** Fish Audio API 克隆结果 */
export interface FishCloneResult {
  referenceId: string
  name: string
  audioUrl: string
}

/** 统一 TTS 引擎接口 */
export interface ITtsEngine {
  synthesize(text: string, voiceId: string, config: TtsConfig): Promise<TtsResult>
}
