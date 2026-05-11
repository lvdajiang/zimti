export interface SegmentInput {
  id: number
  segment_type: 'oral' | 'visual' | 'transition'
  oral_text?: string
  visual_description: string
  duration: number
  material_ids: string[]
  oral_audio_url?: string
  transition_type?: TransitionType
}

export interface MaterialInput {
  id: string
  name: string
  type: 'image' | 'video' | 'audio'
  file_url: string
  thumbnail_url?: string
  usage_type: 'main' | 'bgm' | 'sfx' | 'subtitle'
  width?: number
  height?: number
  duration?: number
}

export type TransitionType = 'fade' | 'dissolve' | 'slide_left' | 'slide_right' | 'wipe' | 'zoom_in'

export interface VideoCompositionProps {
  segments: SegmentInput[]
  materials: MaterialInput[]
  title?: string
  platform: 'main' | 'douyin' | 'weixin' | 'image_text'
  resolution: '1080p' | '720p' | '480p'
  bgm_url?: string
  subtitle_style?: {
    font_size?: number
    color?: string
    position?: 'top' | 'center' | 'bottom'
    bg_color?: string
    bg_opacity?: number
  }
}

export interface SegmentFrameInfo {
  startFrame: number
  endFrame: number
  durationInFrames: number
  segment: SegmentInput
  mainMaterial?: MaterialInput
}
