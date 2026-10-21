import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'

import { theme } from '@/core/ui/theme'
import { useLatest } from '@/core/utils/useLatest'
import { POSE_EMIT_INTERVAL_MS, type SimulatedPoseCameraProps } from './PoseCamera.types'
import { PoseSimulator } from './simulator'
import { StickFigure } from './StickFigure'
import type { PoseFrame } from './types'

export const SIMULATED_IMAGE_W = 480
export const SIMULATED_IMAGE_H = 640

/**
 * Demo mode: a simulated player that copies the target pose. Lets the game run
 * with no camera (simulators, desktop without webcam, UI development, demos).
 */
export function SimulatedPoseCamera({
  isActive,
  target,
  driver,
  showSkeleton = true,
  partColors,
  onPose,
  onStatus,
  resizeMode = 'cover',
  emitIntervalMs = POSE_EMIT_INTERVAL_MS,
  style,
}: SimulatedPoseCameraProps) {
  // A driven player (game bot) reacts instantly; the pose-copying player is deliberately human-paced.
  const [simulator] = useState(() =>
    driver
      ? new PoseSimulator(SIMULATED_IMAGE_W, SIMULATED_IMAGE_H, { reactionSeconds: 0, speedDegPerSec: 900, sloppinessDeg: 2 })
      : new PoseSimulator(SIMULATED_IMAGE_W, SIMULATED_IMAGE_H),
  )
  const [frame, setFrame] = useState<PoseFrame | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const onPoseRef = useLatest(onPose)
  const driverRef = useLatest(driver)

  useEffect(() => {
    simulator.setTarget(target, Date.now())
  }, [simulator, target])

  useEffect(() => {
    onStatus?.('running')
  }, [onStatus])

  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => {
      const now = Date.now()
      if (driverRef.current) simulator.setTarget(driverRef.current(now), now)
      const next = simulator.step(now)
      setFrame(next)
      onPoseRef.current(next)
    }, emitIntervalMs)
    return () => clearInterval(id)
  }, [isActive, simulator, onPoseRef, driverRef, emitIntervalMs])

  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <View style={styles.floor} />
      {showSkeleton && (
        <StickFigure
          landmarks={frame?.landmarks ?? null}
          imageAspect={SIMULATED_IMAGE_W / SIMULATED_IMAGE_H}
          width={size.width}
          height={size.height}
          partColors={partColors}
          lineWidth={8}
          jointRadius={7}
          fit={resizeMode}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>DEMO MODE · simulated player</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#101B3A',
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '22%',
    backgroundColor: '#17264F',
  },
  badge: {
    position: 'absolute',
    bottom: theme.spacing.xs,
    left: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255, 197, 61, 0.18)',
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  badgeText: {
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
