/**
 * 录音降噪处理器 — 使用 FFmpeg 对上传录音进行降噪
 *
 * 功能:
 *   - denoiseAudio: 对音频文件应用 FFT 降噪滤波器
 *   - normalizeAudio: 音量标准化
 *   - processRecording: 完整处理流程（降噪 + 标准化）
 *
 * 依赖: 系统需安装 FFmpeg（ffmpeg 命令可用）
 * 降噪算法: FFmpeg afftdn 滤波器（自适应 FFT 降噪）
 */

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'

/** 检查 FFmpeg 是否可用 */
export async function isFFmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-version'])
    proc.on('error', () => resolve(false))
    proc.on('close', (code) => resolve(code === 0))
  })
}

/** 降噪处理选项 */
export interface DenoiseOptions {
  /** 降噪强度: 'light' | 'medium' | 'heavy'，默认 'medium' */
  level?: 'light' | 'medium' | 'heavy'
  /** 输出采样率，默认 16000（语音优化） */
  sampleRate?: number
  /** 是否转为单声道，默认 true */
  mono?: boolean
  /** 自定义输出路径 */
  outputPath?: string
}

const NOISE_FILTERS: Record<string, string> = {
  light: 'afftdn=nf=-35',
  medium: 'afftdn=nf=-25',
  heavy: 'afftdn=nf=-15,highpass=f=80,lowpass=f=8000',
}

/**
 * 对音频文件进行降噪处理
 * @returns 降噪后的文件路径
 */
export async function denoiseAudio(inputPath: string, options?: DenoiseOptions): Promise<string> {
  const level = options?.level || 'medium'
  const sampleRate = options?.sampleRate || 16000
  const mono = options?.mono !== false

  const outputDir = options?.outputPath
    ? dirname(options.outputPath)
    : join(process.cwd(), 'uploads', 'denoised')
  await mkdir(outputDir, { recursive: true })

  const ext = extname(inputPath) || '.wav'
  const outputFile = options?.outputPath || join(outputDir, `denoised_${Date.now()}${ext}`)

  const filter = NOISE_FILTERS[level]
  const args: string[] = [
    '-i', inputPath,
    '-af', filter + (mono ? ',' + `aresample=${sampleRate},aformat=channel_layouts=mono` : `,aresample=${sampleRate}`),
    '-y',
    outputFile,
  ]

  await runFFmpeg(args)
  return outputFile
}

/**
 * 音量标准化
 * @returns 标准化后的文件路径
 */
export async function normalizeAudio(inputPath: string, targetDb: number = -3.0): Promise<string> {
  const outputDir = join(process.cwd(), 'uploads', 'denoised')
  await mkdir(outputDir, { recursive: true })

  const ext = extname(inputPath) || '.wav'
  const outputFile = join(outputDir, `normalized_${Date.now()}${ext}`)

  const args: string[] = [
    '-i', inputPath,
    '-af', `loudnorm=I=${targetDb}:TP=-1:LRA=11`,
    '-y',
    outputFile,
  ]

  await runFFmpeg(args)
  return outputFile
}

/**
 * 完整录音处理流程：降噪 → 音量标准化
 * @returns 处理后的文件路径
 */
export async function processRecording(inputPath: string, options?: DenoiseOptions): Promise<string> {
  // 步骤 1: 降噪
  const denoisedPath = await denoiseAudio(inputPath, options)

  // 步骤 2: 音量标准化
  const normalizedPath = await normalizeAudio(denoisedPath)

  return normalizedPath
}

/** 执行 FFmpeg 命令 */
function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args)
    let stderr = ''

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg 执行失败: ${err.message}`))
    })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg 退出码 ${code}: ${stderr.slice(-200)}`))
    })
  })
}
