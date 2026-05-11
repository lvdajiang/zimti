import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring } from 'remotion'

interface ImageSegmentProps {
  src: string
  fit?: 'cover' | 'contain'
  zoomEffect?: boolean
}

export const ImageSegment: React.FC<ImageSegmentProps> = ({
  src,
  fit = 'cover',
  zoomEffect = true,
}) => {
  const frame = useCurrentFrame()

  const scale = zoomEffect
    ? interpolate(frame, [0, 30], [1, 1.05], { extrapolateRight: 'clamp' })
    : 1

  const resolvedSrc = src.startsWith('http') ? src : staticFile(src)

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${scale})`,
        }}
      >
        <Img
          src={resolvedSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: fit,
          }}
        />
      </div>
    </AbsoluteFill>
  )
}
