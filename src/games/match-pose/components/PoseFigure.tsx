import { memo, useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { skeletonToFrame } from '@/core/pose/skeleton'
import { StickFigure } from '@/core/pose/StickFigure'
import { theme } from '@/core/ui/theme'
import type { PoseDefinition } from '../types'

/** Stick-figure illustration of a target pose, computed from its definition. */
export const PoseFigure = memo(function PoseFigure({
  pose,
  width,
  height,
  color = theme.colors.primary,
  style,
}: {
  pose: Pick<PoseDefinition, 'skeleton' | 'view'>
  width: number
  height: number
  color?: string
  style?: StyleProp<ViewStyle>
}) {
  const frame = useMemo(
    () => skeletonToFrame(pose.skeleton, pose.view, { imageWidth: width, imageHeight: height, fill: 0.86, centerY: 0.5 }),
    [pose.skeleton, pose.view, width, height],
  )
  const line = Math.max(3, Math.round(Math.min(width, height) / 24))
  return (
    <StickFigure
      landmarks={frame.landmarks}
      imageAspect={width / height}
      width={width}
      height={height}
      color={color}
      lineWidth={line}
      jointRadius={Math.max(2, line * 0.6)}
      style={style}
    />
  )
})
