import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion'

interface TextOverlayProps {
  text: string
  style?: Record<string, unknown>
}

export const TextOverlay: React.FC<TextOverlayProps> = ({ text, style = {} }) => {
  const frame = useCurrentFrame()

  const fontSize = (style.font_size as number) ?? 48
  const color = (style.color as string) ?? '#FFFFFF'
  const position = (style.position as string) ?? 'bottom'
  const bgColor = (style.bg_color as string) ?? '#000000'
  const bgOpacity = (style.bg_opacity as number) ?? 0.6

  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' })
  const translateY = interpolate(frame, [0, 10], [20, 0], { extrapolateRight: 'clamp' })

  const positionStyle: React.CSSProperties = (() => {
    switch (position) {
      case 'top':
        return { top: 80 }
      case 'center':
        return { top: '50%', transform: `translateY(calc(-50% + ${translateY}px))` }
      default:
        return { bottom: 120 }
    }
  })()

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          ...positionStyle,
          opacity,
          transform: position === 'center'
            ? `translateY(calc(-50% + ${translateY}px))`
            : `translateY(${translateY}px)`,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '8px 20px',
            borderRadius: 8,
            backgroundColor: `${bgColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
          }}
        >
          <span
            style={{
              color,
              fontSize,
              fontWeight: 600,
              fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
              lineHeight: 1.5,
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {text}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}
