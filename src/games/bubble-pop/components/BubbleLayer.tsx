import { memo, useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ZoomIn, type SharedValue } from 'react-native-reanimated'

import type { StageProjection } from '@/core/pose/fitTransform'
import { theme } from '@/core/ui/theme'
import { POPPER_RADIUS, type Popper } from '../engine/body'
import type { Bubble, BubbleKind, PopEffect, VisibleArea } from '../engine/bubbleGame'

const PALETTE = ['#5EEAD4', '#60A5FA', '#F472B6', '#A78BFA', '#34D399', '#FB923C']
const BURST_MS = 550
const DROPLETS = 8

function bubbleColor(kind: BubbleKind, id: number): string {
  if (kind === 'golden') return theme.colors.gold
  if (kind === 'bomb') return theme.colors.danger
  return PALETTE[id % PALETTE.length]
}

interface BubbleLayerProps {
  projection: StageProjection
  bubbles: Bubble[]
  effects: PopEffect[]
  poppers: Popper[]
  /** View pixels at the top covered by the HUD, where bubbles must not spawn. */
  topInset: number
  onVisibleArea: (area: VisibleArea) => void
}

export function BubbleLayer({ projection, bubbles, effects, poppers, topInset, onVisibleArea }: BubbleLayerProps) {
  useEffect(() => {
    const { visible } = projection
    onVisibleArea({ ...visible, top: Math.max(visible.top, projection.fromView(0, topInset).y) })
  }, [projection, topInset, onVisibleArea])
  return (
    <>
      {bubbles.map((b) => (
        <BubbleView key={b.id} bubble={b} projection={projection} />
      ))}
      {effects.map((e) => (
        <PopBurst key={e.id} effect={e} projection={projection} />
      ))}
      {poppers.map((p) => (
        <PopperRing key={p.id} popper={p} projection={projection} />
      ))}
    </>
  )
}

function BubbleView({ bubble: b, projection }: { bubble: Bubble; projection: StageProjection }) {
  const { x, y } = projection.toView(b.x, b.y)
  const r = b.r * projection.unit
  const color = bubbleColor(b.kind, b.id)
  // Fades out over the last 30% of its life, so players can see which bubbles are about to go.
  const opacity = 0.35 + 0.65 * Math.min(1, b.life / 0.3)
  const icon = b.kind === 'bomb' ? '💣' : b.kind === 'golden' ? '⭐' : b.low ? '🦶' : null
  return (
    <Animated.View
      entering={ZoomIn.duration(220)}
      style={[
        styles.bubble,
        {
          left: x - r,
          top: y - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderColor: color,
          backgroundColor: b.kind === 'bomb' ? 'rgba(45, 8, 20, 0.8)' : `${color}40`,
          shadowColor: color,
          opacity,
        },
      ]}
    >
      <View style={[styles.shine, { width: r * 0.55, height: r * 0.32, borderRadius: r, top: r * 0.3, left: r * 0.35 }]} />
      {icon && <Text style={{ fontSize: r * 0.9 }}>{icon}</Text>}
    </Animated.View>
  )
}

const PopBurst = memo(function PopBurst({ effect, projection }: { effect: PopEffect; projection: StageProjection }) {
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.cubic) })
  }, [progress])

  const { x, y } = projection.toView(effect.x, effect.y)
  const r = effect.r * projection.unit
  const color = effect.kind === 'bomb' ? theme.colors.danger : bubbleColor(effect.kind, effect.id)

  const ring = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 + progress.value * 0.8 }],
  }))
  const label = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * progress.value,
    transform: [{ translateY: -progress.value * 56 }],
  }))

  return (
    <>
      <Animated.View
        style={[styles.ring, { left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, borderColor: color }, ring]}
      />
      {Array.from({ length: DROPLETS }, (_, i) => (
        <Droplet key={i} angle={(i / DROPLETS) * Math.PI * 2} x={x} y={y} r={r} color={color} progress={progress} />
      ))}
      <Animated.Text style={[styles.points, { left: x - 60, top: y - 22, color }, label]}>{effect.text}</Animated.Text>
    </>
  )
})

function Droplet({ angle, x, y, r, color, progress }: { angle: number; x: number; y: number; r: number; color: string; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const d = r * (0.6 + progress.value * 1.1)
    return {
      opacity: 1 - progress.value,
      transform: [{ translateX: Math.cos(angle) * d }, { translateY: Math.sin(angle) * d }],
    }
  })
  return <Animated.View style={[styles.droplet, { left: x - 4, top: y - 4, backgroundColor: color }, style]} />
}

function PopperRing({ popper, projection }: { popper: Popper; projection: StageProjection }) {
  const { x, y } = projection.toView(popper.x, popper.y)
  const r = Math.max(10, POPPER_RADIUS[popper.kind] * projection.unit)
  return <View style={[styles.popper, { left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r }]} />
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  shine: { position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.7)', transform: [{ rotate: '-30deg' }] },
  ring: { position: 'absolute', borderWidth: 4 },
  droplet: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  points: {
    position: 'absolute',
    width: 120,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowRadius: 6,
  },
  popper: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(60, 200, 255, 0.35)',
  },
})
