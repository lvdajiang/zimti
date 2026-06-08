/**
 * 音色管理 API（Voice Profiles）
 *
 * GET    /voice-profiles              列表（系统预设 + 用户自定义）
 * POST   /voice-profiles              创建自定义音色（手动指定 engine + engineRef）
 * POST   /voice-profiles/clone        上传录音 → Fish Audio 克隆 → 创建 VoiceProfile
 * POST   /voice-profiles/:id/preview  试听（生成 3 秒样本）
 * POST   /voice-profiles/upload       上传自己录音（模式 C，返回文件路径）
 * DELETE /voice-profiles/:id           删除自定义音色
 */

import { Router } from 'express'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '../../db.js'
import { getUserId, str } from '../../constants.js'
import { optionalAuth } from '../../services/auth/authService.js'
import { previewTTS } from '../../services/tts/index.js'
import { FishAudioEngine } from '../../services/tts/fishAudioEngine.js'
import { processRecording, isFFmpegAvailable } from '../../services/tts/recordingProcessor.js'
import type { Request, Response } from 'express'

const router: Router = Router()
router.use(optionalAuth)

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'voice-samples')

/** 系统预设音色（Edge-TTS） */
const SYSTEM_PRESETS = [
  { name: '晓晓（女声·温柔）', engine: 'edge_tts', engineRef: 'zh-CN-XiaoxiaoNeural', type: 'preset' },
  { name: '云希（男声·阳光）', engine: 'edge_tts', engineRef: 'zh-CN-YunxiNeural', type: 'preset' },
  { name: '云健（男声·磁性）', engine: 'edge_tts', engineRef: 'zh-CN-YunjianNeural', type: 'preset' },
  { name: '晓依（女声·活泼）', engine: 'edge_tts', engineRef: 'zh-CN-XiaoyiNeural', type: 'preset' },
  { name: '云扬（男声·新闻）', engine: 'edge_tts', engineRef: 'zh-CN-YunyangNeural', type: 'preset' },
]

/** 初始化系统预设（首次启动时调用） */
async function ensureSystemPresets(): Promise<void> {
  const count = await prisma.voiceProfile.count({ where: { userId: null } })
  if (count > 0) return

  for (const preset of SYSTEM_PRESETS) {
    await prisma.voiceProfile.create({
      data: {
        userId: null,
        name: preset.name,
        type: preset.type,
        engine: preset.engine,
        engineRef: preset.engineRef,
        config: {},
      },
    })
  }
  console.log(`[VoiceProfile] 已初始化 ${SYSTEM_PRESETS.length} 个系统预设音色`)
}

// ── 列表 ──────────────────────────────────────────────
router.get('/voice-profiles', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)

  await ensureSystemPresets()

  const list = await prisma.voiceProfile.findMany({
    where: {
      isActive: true,
      OR: [
        { userId: null },   // 系统预设
        { userId },         // 用户的自定义音色
      ],
    },
    orderBy: [
      { userId: 'asc' },   // 系统预设排前面
      { createdAt: 'desc' },
    ],
  })

  res.json(list)
})

// ── 创建自定义音色 ──────────────────────────────────────
router.post('/voice-profiles', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const { name, type, engine, engineRef, sampleUrl, config } = req.body

  if (!name || !type || !engine) {
    res.status(400).json({ error: 'name, type, engine 为必填' })
    return
  }

  const created = await prisma.voiceProfile.create({
    data: {
      userId,
      name,
      type,        // preset / clone / uploaded
      engine,      // edge_tts / fish_audio / uploaded
      engineRef: engineRef || null,
      sampleUrl: sampleUrl || null,
      config: config || {},
    },
  })
  res.status(201).json(created)
})

// ── 上传录音 → Fish Audio 克隆 ──────────────────────────
router.post('/voice-profiles/clone', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const { voiceName } = req.body as { voiceName?: string }

  if (!voiceName) {
    res.status(400).json({ error: 'voiceName 为必填' })
    return
  }

  // 检查是否有上传的音频文件（multipart）
  if (!req.file) {
    res.status(400).json({ error: '请上传音频文件' })
    return
  }

  try {
    const fishEngine = new FishAudioEngine()
    const result = await fishEngine.cloneVoice(req.file.buffer, req.file.originalname, voiceName)

    // 保存到 VoiceProfile
    const profile = await prisma.voiceProfile.create({
      data: {
        userId,
        name: voiceName,
        type: 'clone',
        engine: 'fish_audio',
        engineRef: result.referenceId,
        sampleUrl: result.audioUrl || null,
        config: {},
      },
    })

    res.status(201).json(profile)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[VoiceProfile] clone failed:', msg)
    res.status(500).json({ error: `声音克隆失败: ${msg}` })
  }
})

// ── 试听 ──────────────────────────────────────────────
router.post('/voice-profiles/:id/preview', async (req: Request, res: Response) => {
  const id = str(req.params.id)
  const { text } = req.body as { text?: string }
  const sampleText = text || '你好，这是一段试听样本，用于测试音色效果。'

  const profile = await prisma.voiceProfile.findUnique({ where: { id } })
  if (!profile) {
    res.status(404).json({ error: '音色不存在' })
    return
  }

  try {
    const engine: 'edge_tts' | 'fish_audio' | 'uploaded' = profile.engine as any
    const filePath = await previewTTS(sampleText, profile.engineRef || '', engine)
    res.json({ filePath, url: `/static/${filePath.split(/[/\\]/).slice(-2).join('/')}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `试听失败: ${msg}` })
  }
})

// ── 上传自己录音（模式 C）──────────────────────────────
router.post('/voice-profiles/upload', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const { voiceName } = req.body as { voiceName?: string }

  if (!req.file) {
    res.status(400).json({ error: '请上传音频文件' })
    return
  }

  const name = voiceName || `录音_${Date.now()}`
  await mkdir(UPLOAD_DIR, { recursive: true })

  const ext = req.file.originalname.split('.').pop() || 'mp3'
  const filename = `recording_${Date.now()}.${ext}`
  const rawPath = join(UPLOAD_DIR, filename)
  await writeFile(rawPath, req.file.buffer)

  // 尝试 FFmpeg 降噪处理（如果可用）
  let finalPath = rawPath
  let denoised = false
  try {
    if (await isFFmpegAvailable()) {
      finalPath = await processRecording(rawPath, { level: 'medium' })
      denoised = true
    }
  } catch (err) {
    console.warn('[voice-profiles/upload] 降噪处理失败，使用原始录音:', (err as Error).message)
  }

  // 创建 VoiceProfile 记录
  const profile = await prisma.voiceProfile.create({
    data: {
      userId,
      name,
      type: 'uploaded',
      engine: 'uploaded',
      engineRef: finalPath,
      sampleUrl: `/static/voice-samples/${filename}`,
      config: { denoised },
    },
  })

  res.status(201).json(profile)
})

// ── 删除 ──────────────────────────────────────────────
router.delete('/voice-profiles/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req as any)
  const id = str(req.params.id)

  const profile = await prisma.voiceProfile.findUnique({ where: { id } })
  if (!profile) {
    res.status(404).json({ error: '音色不存在' })
    return
  }
  if (!profile.userId) {
    res.status(403).json({ error: '系统预设音色不可删除' })
    return
  }
  if (profile.userId !== userId) {
    res.status(403).json({ error: '只能删除自己的音色' })
    return
  }

  await prisma.voiceProfile.update({
    where: { id },
    data: { isActive: false },
  })
  res.status(204).send()
})

export default router
