import React from 'react'
import { AbsoluteFill, staticFile, Video } from 'remotion'

interface VideoSegmentProps {
  src: string
}

export const VideoSegment: React.FC<VideoSegmentProps> = ({ src }) => {
  const resolvedSrc = src.startsWith('http') ? src : staticFile(src)

  return (
    <AbsoluteFill>
      <Video
        src={resolvedSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        muted
      />
    </AbsoluteFill>
  )
}
