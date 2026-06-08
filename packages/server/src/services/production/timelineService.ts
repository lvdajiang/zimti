/**
 * 时间轴编排服务
 *
 * 功能:
 *   - buildTimeline: 从分镜段 + 素材 + 配音构建时间轴
 *   - autoAlignByDubbing: 根据配音时长自动调整画面段时长
 *   - exportJianyingDraft: 生成剪映兼容的 draft JSON
 *   - remotionRender: 委托 Remotion 渲染
 */
import { prisma } from '../../db.js'
import { startRender } from '../render/renderService.js'
import { randomUUID } from 'node:crypto'

// ── 类型 ──────────────────────────────────────────────

interface TrackItem {
  segmentIndex: number
  segmentId: number
  segmentType: string
  materialId: string | null
  startTime: number
  endTime: number
  transition: string | null
  trimStart: number | null
  trimEnd: number | null
}

interface TimelineTracks {
  video: TrackItem[]
  audio: TrackItem[]
  subtitle: TrackItem[]
}

// ── 构建时间轴 ────────────────────────────────────────

export async function buildTimeline(videoProductId: string): Promise<{
  id: string
  tracks: TimelineTracks
  totalDuration: number
}> {
  const vp = await prisma.videoProduct.findUnique({
    where: { id: videoProductId },
    include: {
      script: {
        include: {
          storyboardSegments: { orderBy: { segmentIndex: 'asc' } },
        },
      },
    },
  })

  if (!vp || !vp.script) throw new Error('VideoProduct 或关联脚本不存在')

  const segments = vp.script.storyboardSegments
  const videoTrack: TrackItem[] = []
  const audioTrack: TrackItem[] = []
  const subtitleTrack: TrackItem[] = []
  let currentTime = 0

  for (const seg of segments) {
    const duration = Number(seg.duration)
    const materialId = seg.materialIds[0] || null

    // 视频轨：所有段都有画面
    videoTrack.push({
      segmentIndex: seg.segmentIndex,
      segmentId: seg.id,
      segmentType: seg.segmentType,
      materialId,
      startTime: currentTime,
      endTime: currentTime + duration,
      transition: seg.transitionType,
      trimStart: null,
      trimEnd: null,
    })

    // 音频轨：口播段有配音
    if (seg.segmentType === 'oral' && seg.oralAudioUrl) {
      audioTrack.push({
        segmentIndex: seg.segmentIndex,
        segmentId: seg.id,
        segmentType: seg.segmentType,
        materialId: seg.oralAudioUrl,
        startTime: currentTime,
        endTime: currentTime + duration,
        transition: null,
        trimStart: null,
        trimEnd: null,
      })
    }

    // 字幕轨：口播段有文本
    if (seg.segmentType === 'oral' && seg.oralText) {
      subtitleTrack.push({
        segmentIndex: seg.segmentIndex,
        segmentId: seg.id,
        segmentType: seg.segmentType,
        materialId: null,
        startTime: currentTime,
        endTime: currentTime + duration,
        transition: null,
        trimStart: null,
        trimEnd: null,
      })
    }

    currentTime += duration
  }

  const tracks: TimelineTracks = { video: videoTrack, audio: audioTrack, subtitle: subtitleTrack }

  // 创建或更新 Timeline
  const existing = await prisma.timeline.findUnique({
    where: { videoProductId },
  })

  let timeline
  if (existing) {
    timeline = await prisma.timeline.update({
      where: { id: existing.id },
      data: {
        tracks: tracks as any,
        totalDuration: currentTime,
        status: 'draft',
      },
    })
  } else {
    timeline = await prisma.timeline.create({
      data: {
        videoProductId,
        tracks: tracks as any,
        totalDuration: currentTime,
        fps: 30,
        resolution: vp.resolution || '1080x1920',
        status: 'draft',
      },
    })
  }

  return { id: timeline.id, tracks, totalDuration: currentTime }
}

// ── AI 自动对齐 ───────────────────────────────────────

export async function autoAlignByDubbing(videoProductId: string): Promise<{
  adjusted: number
  totalDuration: number
}> {
  const timeline = await prisma.timeline.findUnique({
    where: { videoProductId },
  })
  if (!timeline) throw new Error('时间轴不存在，请先构建')

  const vp = await prisma.videoProduct.findUnique({
    where: { id: videoProductId },
    include: {
      script: {
        include: {
          storyboardSegments: { orderBy: { segmentIndex: 'asc' } },
        },
      },
    },
  })
  if (!vp?.script) throw new Error('脚本不存在')

  const segments = vp.script.storyboardSegments
  const tracks = timeline.tracks as unknown as TimelineTracks

  // 根据口播时长调整后续画面段
  let adjusted = 0
  let currentTime = 0

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    let duration = Number(seg.duration)

    // 口播段：使用配音时长估算（5字/秒）
    if (seg.segmentType === 'oral' && seg.oralText) {
      const estimatedDuration = Math.max(2, Math.round(seg.oralText.length / 5))
      if (Math.abs(estimatedDuration - duration) > 1) {
        adjusted++
        duration = estimatedDuration
        // 同步更新分镜段时长
        await prisma.storyboardSegment.update({
          where: { id: seg.id },
          data: { duration },
        })
      }
    }

    // 更新视频轨
    const videoItem = tracks.video.find(v => v.segmentIndex === seg.segmentIndex)
    if (videoItem) {
      videoItem.startTime = currentTime
      videoItem.endTime = currentTime + duration
    }

    // 更新音频轨
    const audioItem = tracks.audio.find(a => a.segmentIndex === seg.segmentIndex)
    if (audioItem) {
      audioItem.startTime = currentTime
      audioItem.endTime = currentTime + duration
    }

    // 更新字幕轨
    const subtitleItem = tracks.subtitle.find(s => s.segmentIndex === seg.segmentIndex)
    if (subtitleItem) {
      subtitleItem.startTime = currentTime
      subtitleItem.endTime = currentTime + duration
    }

    currentTime += duration
  }

  // 保存更新
  await prisma.timeline.update({
    where: { id: timeline.id },
    data: {
      tracks: tracks as any,
      totalDuration: currentTime,
    },
  })

  return { adjusted, totalDuration: currentTime }
}

// ── 导出剪映草稿 JSON ─────────────────────────────────

/**
 * 生成剪映兼容的 draft_content.json
 *
 * 遵循剪映 4.x 的 draft_content.json 格式，包含：
 * - materials: 素材列表（视频、音频、文本）
 * - tracks: 多轨道编排（视频轨、音频轨、文字轨）
 * - canvas_config: 画布配置（分辨率、帧率）
 *
 * 用户下载后放入剪映草稿目录即可打开编辑。
 */
export async function exportJianyingDraft(timelineId: string): Promise<Record<string, unknown>> {
  const timeline = await prisma.timeline.findUnique({ where: { id: timelineId } })
  if (!timeline) throw new Error('时间轴不存在')

  const tracks = timeline.tracks as unknown as TimelineTracks
  const vp = await prisma.videoProduct.findUnique({
    where: { id: timeline.videoProductId },
    include: { script: { include: { storyboardSegments: { orderBy: { segmentIndex: 'asc' } } } } },
  })

  const fps = timeline.fps || 30
  const [canvasWidth, canvasHeight] = (timeline.resolution || '1080x1920').split('x').map(Number)

  // 生成唯一 ID
  const uid = () => randomUUID()

  // ── 构建素材列表 ──
  const materials: Record<string, unknown>[] = []
  const videoMaterialMap = new Map<string, string>() // materialId → material UUID
  const audioMaterialMap = new Map<string, string>()

  // 视频素材
  for (const item of tracks.video) {
    if (item.materialId && !videoMaterialMap.has(item.materialId)) {
      const matId = uid()
      videoMaterialMap.set(item.materialId, matId)
      materials.push({
        id: matId,
        type: 'video',
        path: item.materialId,
        duration: Math.round((item.endTime - item.startTime) * fps),
        width: canvasWidth,
        height: canvasHeight,
      })
    }
  }

  // 音频素材
  for (const item of tracks.audio) {
    if (item.materialId && !audioMaterialMap.has(item.materialId)) {
      const matId = uid()
      audioMaterialMap.set(item.materialId, matId)
      materials.push({
        id: matId,
        type: 'audio',
        path: item.materialId,
        duration: Math.round((item.endTime - item.startTime) * fps),
      })
    }
  }

  // ── 构建轨道 ──
  const videoTrackItems = tracks.video.map(item => ({
    id: uid(),
    type: 'video',
    material_id: videoMaterialMap.get(item.materialId || '') || '',
    target_timerange: {
      start: Math.round(item.startTime * fps),
      duration: Math.round((item.endTime - item.startTime) * fps),
    },
    source_timerange: {
      start: 0,
      duration: Math.round((item.endTime - item.startTime) * fps),
    },
    segment_type: item.segmentType,
  }))

  const audioTrackItems = tracks.audio.map(item => ({
    id: uid(),
    type: 'audio',
    material_id: audioMaterialMap.get(item.materialId || '') || '',
    target_timerange: {
      start: Math.round(item.startTime * fps),
      duration: Math.round((item.endTime - item.startTime) * fps),
    },
    source_timerange: {
      start: 0,
      duration: Math.round((item.endTime - item.startTime) * fps),
    },
    volume: 1.0,
  }))

  const textTrackItems = tracks.subtitle.map(item => {
    const seg = vp?.script?.storyboardSegments.find(s => s.segmentIndex === item.segmentIndex)
    return {
      id: uid(),
      type: 'text',
      content: seg?.oralText || '',
      target_timerange: {
        start: Math.round(item.startTime * fps),
        duration: Math.round((item.endTime - item.startTime) * fps),
      },
      style: {
        font_size: 36,
        font_color: '#FFFFFF',
        stroke_color: '#000000',
        stroke_width: 2,
        alignment: 'center',
        position: { x: 0.5, y: 0.85 }, // 底部居中
      },
    }
  })

  // ── 组装完整 draft_content.json ──
  const draft = {
    platform: 'jianying',
    version: '4.0.0',
    config: {
      width: canvasWidth,
      height: canvasHeight,
      fps,
      duration: Math.round(Number(timeline.totalDuration) * fps),
    },
    materials,
    tracks: [
      {
        id: uid(),
        type: 'video',
        attribute: 0,
        items: videoTrackItems,
      },
      {
        id: uid(),
        type: 'audio',
        attribute: 0,
        items: audioTrackItems,
      },
      {
        id: uid(),
        type: 'text',
        attribute: 0,
        items: textTrackItems,
      },
    ],
    // 元数据
    metadata: {
      title: vp?.title || '未命名视频',
      created_at: new Date().toISOString(),
      source: 'zimti_pipeline',
      total_duration: Number(timeline.totalDuration),
      segment_count: tracks.video.length,
    },
  }

  // 保存到数据库
  await prisma.timeline.update({
    where: { id: timelineId },
    data: { jianyingDraft: draft as any },
  })

  return draft
}

// ── Remotion 渲染 ──────────────────────────────────────

export async function remotionRender(videoProductId: string): Promise<string> {
  // 委托给现有的 renderService
  const renderJobId = await startRender(videoProductId)

  // 更新 Timeline 状态
  await prisma.timeline.updateMany({
    where: { videoProductId },
    data: { status: 'rendering' },
  })

  return renderJobId
}
