import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion'

interface PlaceholderSegmentProps {
  description: string
}

export const PlaceholderSegment: React.FC<PlaceholderSegmentProps> = ({ description }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 15], [0.3, 0.6], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(20, 20, 30, ${opacity})`,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      <div
        style={{
          color: '#888',
          fontSize: 28,
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: '80%',
        }}
      >
        {description}
      </div>
    </AbsoluteFill>
  )
}
