import type { VideoCompositionProps, SegmentFrameInfo, MaterialInput } from './types'

const FPS = 30

export function buildFrameMap(props: VideoCompositionProps): SegmentFrameInfo[] {
  const { segments, materials } = props
  let currentFrame = 0

  return segments.map((segment) => {
    const durationInFrames = Math.max(FPS, Math.round(segment.duration * FPS))
    const startFrame = currentFrame
    const endFrame = startFrame + durationInFrames

    const mainMaterial = segment.material_ids.length > 0
      ? materials.find((m) => m.id === segment.material_ids[0] && m.usage_type === 'main')
        ?? materials.find((m) => m.id === segment.material_ids[0])
      : undefined

    const info: SegmentFrameInfo = {
      startFrame,
      endFrame,
      durationInFrames,
      segment,
      mainMaterial,
    }

    currentFrame = endFrame
    return info
  })
}

export function totalDuration(segments: { duration: number }[]): number {
  return segments.reduce((sum, s) => sum + s.duration, 0)
}

export function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|bmp|gif)(\?.*)?$/i.test(url)
}

export function isVideo(url: string): boolean {
  return /\.(mp4|mov|webm|avi)(\?.*)?$/i.test(url)
}

export function getPlatformConfig(platform: string) {
  switch (platform) {
    case 'douyin':
      return { width: 1080, height: 1920, label: '抖音 9:16' }
    case 'weixin':
      return { width: 1080, height: 1920, label: '微信 9:16' }
    case 'image_text':
      return { width: 1080, height: 1440, label: '图文 3:4' }
    default:
      return { width: 1080, height: 1920, label: '主视频 9:16' }
  }
}

export function getSubtitleDefaults() {
  return {
    font_size: 48,
    color: '#FFFFFF',
    position: 'bottom' as const,
    bg_color: '#000000',
    bg_opacity: 0.6,
  }
}

export function getMaterialById(materials: MaterialInput[], id: string): MaterialInput | undefined {
  return materials.find((m) => m.id === id)
}
