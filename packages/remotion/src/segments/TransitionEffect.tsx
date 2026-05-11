import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion'
import type { TransitionType } from '../types'

interface TransitionEffectProps {
  type: TransitionType
}

export const TransitionEffect: React.FC<TransitionEffectProps> = ({ type }) => {
  const frame = useCurrentFrame()
  const DURATION = 15

  switch (type) {
    case 'fade':
      return <FadeTransition frame={frame} duration={DURATION} />
    case 'dissolve':
      return <DissolveTransition frame={frame} duration={DURATION} />
    case 'slide_left':
      return <SlideTransition frame={frame} duration={DURATION} direction="left" />
    case 'slide_right':
      return <SlideTransition frame={frame} duration={DURATION} direction="right" />
    case 'wipe':
      return <WipeTransition frame={frame} duration={DURATION} />
    case 'zoom_in':
      return <ZoomTransition frame={frame} duration={DURATION} />
    default:
      return <FadeTransition frame={frame} duration={DURATION} />
  }
}

const FadeTransition: React.FC<{ frame: number; duration: number }> = ({ frame, duration }) => {
  const opacity = interpolate(frame, [0, duration], [1, 0], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity }} />
  )
}

const DissolveTransition: React.FC<{ frame: number; duration: number }> = ({ frame, duration }) => {
  const opacity = interpolate(frame, [0, duration], [1, 0], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ backgroundColor: '#111', opacity, mixBlendMode: 'screen' }} />
  )
}

const SlideTransition: React.FC<{ frame: number; duration: number; direction: 'left' | 'right' }> = ({
  frame, duration, direction,
}) => {
  const progress = interpolate(frame, [0, duration], [0, 100], { extrapolateRight: 'clamp' })
  const translateX = direction === 'left' ? -progress : progress
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', transform: `translateX(${translateX}%)` }} />
  )
}

const WipeTransition: React.FC<{ frame: number; duration: number }> = ({ frame, duration }) => {
  const progress = interpolate(frame, [0, duration], [0, 100], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${progress}%`,
          backgroundColor: '#000',
        }}
      />
    </AbsoluteFill>
  )
}

const ZoomTransition: React.FC<{ frame: number; duration: number }> = ({ frame, duration }) => {
  const scale = interpolate(frame, [0, duration], [1, 3], { extrapolateRight: 'clamp' })
  const opacity = interpolate(frame, [0, duration], [1, 0], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        transform: `scale(${scale})`,
        opacity,
      }}
    />
  )
}
