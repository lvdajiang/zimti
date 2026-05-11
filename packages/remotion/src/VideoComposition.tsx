import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useVideoConfig,
} from 'remotion'
import type { VideoCompositionProps } from './types'
import { buildFrameMap, totalDuration } from './utils'
import { ImageSegment } from './segments/ImageSegment'
import { VideoSegment } from './segments/VideoSegment'
import { TextOverlay } from './segments/TextOverlay'
import { TransitionEffect } from './segments/TransitionEffect'
import { PlaceholderSegment } from './segments/PlaceholderSegment'

export const VideoComposition: React.FC<VideoCompositionProps> = (props) => {
  const { segments, materials, bgm_url } = props
  const { fps } = useVideoConfig()
  const frameMap = buildFrameMap(props)
  const subtitleStyle = props.subtitle_style ?? {}

  if (segments.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#666', fontSize: 32, fontFamily: 'sans-serif' }}>暂无分镜内容</div>
      </AbsoluteFill>
    )
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {frameMap.map((info, index) => (
        <Sequence
          key={info.segment.id}
          from={info.startFrame}
          durationInFrames={info.durationInFrames}
        >
          <SegmentRenderer
            info={info}
            materials={materials}
            index={index}
            frameMap={frameMap}
            subtitleStyle={subtitleStyle}
          />
        </Sequence>
      ))}

      {bgm_url && (
        <Audio src={bgm_url} volume={0.3} />
      )}
    </AbsoluteFill>
  )
}

interface SegmentRendererProps {
  info: ReturnType<typeof buildFrameMap>[0]
  materials: VideoCompositionProps['materials']
  index: number
  frameMap: ReturnType<typeof buildFrameMap>
  subtitleStyle: Record<string, unknown>
}

const SegmentRenderer: React.FC<SegmentRendererProps> = ({
  info,
  materials,
  index,
  frameMap,
  subtitleStyle,
}) => {
  const { segment, mainMaterial } = info
  const nextSegment = frameMap[index + 1]
  const transition = segment.transition_type

  const isTransition = segment.segment_type === 'transition'

  if (isTransition && nextSegment) {
    return <TransitionEffect type={transition ?? 'fade'} />
  }

  const materialUrl = mainMaterial?.file_url
  const isVideoUrl = materialUrl ? /\.(mp4|mov|webm)(\?.*)?$/i.test(materialUrl) : false

  return (
    <AbsoluteFill>
      {materialUrl && isVideoUrl ? (
        <VideoSegment src={materialUrl} />
      ) : materialUrl ? (
        <ImageSegment src={materialUrl} />
      ) : (
        <PlaceholderSegment description={segment.visual_description} />
      )}

      {segment.oral_text && (
        <TextOverlay
          text={segment.oral_text}
          style={subtitleStyle}
        />
      )}
    </AbsoluteFill>
  )
}
