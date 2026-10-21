import { memo, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { theme } from './theme'

interface ProgressRingProps {
  /** 0..1 */
  progress: number
  size: number
  color?: string
  trackColor?: string
  /** Number of dots around the ring. */
  segments?: number
  dotSize?: number
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * A ring made of dots that light up clockwise from the top. Pure Views, so it
 * looks the same on every platform and needs no SVG/canvas dependency.
 */
export const ProgressRing = memo(function ProgressRing({
  progress,
  size,
  color = theme.colors.primary,
  trackColor = theme.colors.track,
  segments = 36,
  dotSize,
  children,
  style,
}: ProgressRingProps) {
  const dot = dotSize ?? Math.max(4, size * 0.075)
  const radius = size / 2 - dot / 2
  const lit = Math.round(Math.max(0, Math.min(1, progress)) * segments)
  return (
    <View style={[{ width: size, height: size }, style]}>
      {Array.from({ length: segments }, (_, i) => {
        const a = (i / segments) * Math.PI * 2
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                left: size / 2 + Math.sin(a) * radius - dot / 2,
                top: size / 2 - Math.cos(a) * radius - dot / 2,
                backgroundColor: i < lit ? color : trackColor,
              },
            ]}
          />
        )
      })}
      <View style={styles.center}>{children}</View>
    </View>
  )
})

const styles = StyleSheet.create({
  dot: { position: 'absolute' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
})
