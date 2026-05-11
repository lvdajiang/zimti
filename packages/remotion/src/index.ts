import { VideoComposition } from './VideoComposition'
import type { VideoCompositionProps } from './types'

export const ZimtiVideo = {
  id: 'ZimtiVideo',
  component: VideoComposition,
  dimensions: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
  calculateMetadata: ({ inputProps }: { inputProps: VideoCompositionProps }) => {
    const totalSeconds = inputProps.segments.reduce(
      (sum: number, s: VideoCompositionProps['segments'][0]) => sum + s.duration, 0,
    )
    return {
      durationInFrames: Math.max(30, Math.ceil(totalSeconds * 30)),
    }
  },
}

export { VideoComposition }
export type { VideoCompositionProps, SegmentInput, MaterialInput, TransitionType } from './types'
