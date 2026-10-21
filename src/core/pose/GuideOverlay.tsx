import { memo, useEffect, useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { theme } from '@/core/ui/theme'
import { fitTransform, type FitMode, type FitTransform } from './fitTransform'

export type GuideLane = -1 | 0 | 1
export type GuideLineState = 'idle' | 'near' | 'hit'

export interface GuidePoint {
  x: number
  y: number
  /** Highlighted (e.g. head above the jump line). */
  active?: boolean
}

export interface GuideLine {
  id: string
  /** Canonical normalized y. */
  y: number
  color: string
  label: string
  state: GuideLineState
}

/** Guides in canonical (mirror-view) coordinates, the same space as pose landmarks. */
export interface GuideSpec {
  lanes?: {
    /** Inner boundaries [left|center, center|right]. */
    bounds: [number, number]
    /** Outer edges of the left and right lanes. */
    outer: [number, number]
    active: GuideLane | null
    labels: [string, string, string]
  }
  hLines?: GuideLine[]
  markers?: {
    head?: SharedValue<GuidePoint | null>
    hip?: SharedValue<GuidePoint | null>
    /** Head ring radius in image-height units. */
    headRadius?: number
  }
  /** Canonical side whose frame edge the user is getting close to. */
  edgeWarning?: 'left' | 'right' | null
}

interface GuideOverlayProps {
  spec: GuideSpec
  /** Width / height of the camera image. */
  imageAspect: number
  fit: FitMode
  /** True when the preview is not mirrored (back camera): display x = 1 − canonical x. */
  mirrorX: boolean
  style?: StyleProp<ViewStyle>
}

const ACTIVE_LANE = 'rgba(45, 212, 191, 0.28)'
const IDLE_LANE = 'rgba(255, 255, 255, 0.10)'
const HIT = theme.colors.success
const DASH = 14
const GAP = 10

interface Layout extends FitTransform {
  mirror: boolean
  radius: number
}

/**
 * Lanes, horizontal lines and body markers drawn over a camera view with the same
 * fit transform as the skeleton. Plain Views + Reanimated, so it works on every platform.
 */
export const GuideOverlay = memo(function GuideOverlay({ spec, imageAspect, fit, mirrorX, style }: GuideOverlayProps) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const tf = fitTransform({ width: imageAspect, height: 1 }, size, fit)
  const layout = useSharedValue<Layout>({ ...tf, mirror: mirrorX, radius: 0.05 })
  const headRadius = spec.markers?.headRadius ?? 0.05

  useEffect(() => {
    layout.value = { ...fitTransform({ width: imageAspect, height: 1 }, size, fit), mirror: mirrorX, radius: headRadius }
  }, [layout, imageAspect, size, fit, mirrorX, headRadius])

  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })

  const px = (x: number) => (mirrorX ? 1 - x : x) * tf.iw * tf.scale + tf.dx
  const py = (y: number) => y * tf.ih * tf.scale + tf.dy
  const top = Math.max(0, tf.dy)
  const bottom = Math.min(size.height, tf.dy + tf.ih * tf.scale)
  const left = Math.max(0, tf.dx)
  const right = Math.min(size.width, tf.dx + tf.iw * tf.scale)
  const ready = size.width > 0 && size.height > 0

  const lanes = spec.lanes
  const zones: { lane: GuideLane; from: number; to: number }[] = lanes
    ? [
        { lane: -1, from: lanes.outer[0], to: lanes.bounds[0] },
        { lane: 0, from: lanes.bounds[0], to: lanes.bounds[1] },
        { lane: 1, from: lanes.bounds[1], to: lanes.outer[1] },
      ]
    : []

  const edge = spec.edgeWarning
  const edgeOnDisplayLeft = edge ? (edge === 'left') !== mirrorX : false

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" onLayout={onLayout}>
      {ready &&
        zones.map(({ lane, from, to }, i) => {
          const a = Math.min(Math.max(px(from), left), right)
          const b = Math.min(Math.max(px(to), left), right)
          const x = Math.min(a, b)
          const w = Math.abs(b - a)
          if (w < 1) return null
          const active = lanes?.active === lane
          return (
            <View key={lane} style={[styles.zone, { left: x, width: w, top, height: bottom - top }]}>
              {active ? (
                <Animated.View
                  key={`active-${lane}`}
                  entering={FadeIn.duration(200)}
                  style={[StyleSheet.absoluteFill, { backgroundColor: ACTIVE_LANE }]}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: IDLE_LANE }]} />
              )}
              <Text style={[styles.laneLabel, active && styles.laneLabelActive]}>{lanes?.labels[i]}</Text>
            </View>
          )
        })}
      {ready &&
        lanes?.bounds.map((b, i) => (
          <DashedVLine key={i} x={px(b)} top={top} height={bottom - top} />
        ))}
      {ready &&
        spec.hLines?.map((line) => (
          <HLine key={line.id} line={line} y={py(line.y)} left={left} width={right - left} />
        ))}
      {ready && spec.markers?.hip && <HipMarker point={spec.markers.hip} layout={layout} />}
      {ready && spec.markers?.head && <HeadMarker point={spec.markers.head} layout={layout} />}
      {ready && edge && (
        <>
          <View style={[styles.edgeGlow, edgeOnDisplayLeft ? { left } : { left: right - 28 }, { top, height: bottom - top }]} />
          <View style={styles.edgeMessage}>
            <Text style={styles.edgeText}>Step back toward the middle</Text>
          </View>
        </>
      )}
    </View>
  )
})

function DashedVLine({ x, top, height }: { x: number; top: number; height: number }) {
  const count = Math.max(1, Math.floor(height / (DASH + GAP)))
  return (
    <View style={[styles.vline, { left: x - 1.5, top, height }]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dash, { top: i * (DASH + GAP) }]} />
      ))}
    </View>
  )
}

function HLine({ line, y, left, width }: { line: GuideLine; y: number; left: number; width: number }) {
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (line.state === 'near') {
      pulse.value = withRepeat(withTiming(0.35, { duration: 350 }), -1, true)
    } else {
      cancelAnimation(pulse)
      pulse.value = 1
    }
  }, [line.state, pulse])
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }))
  const hit = line.state === 'hit'
  const color = hit ? HIT : line.color
  const thickness = hit ? 7 : 4
  return (
    <Animated.View style={[styles.hline, { top: y - thickness / 2, left, width }, animated]}>
      <View style={[styles.hlineBar, { height: thickness, backgroundColor: color }]} />
      <View style={[styles.hlineLabel, { borderColor: color }]}>
        <Text style={[styles.hlineText, { color }]}>{line.label}</Text>
      </View>
    </Animated.View>
  )
}

function HeadMarker({ point, layout }: { point: SharedValue<GuidePoint | null>; layout: SharedValue<Layout> }) {
  const style = useAnimatedStyle(() => {
    const p = point.value
    const l = layout.value
    if (!p) return { opacity: 0 }
    const r = Math.max(10, l.radius * l.ih * l.scale)
    const x = (l.mirror ? 1 - p.x : p.x) * l.iw * l.scale + l.dx
    const y = p.y * l.ih * l.scale + l.dy
    return {
      opacity: 1,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      borderColor: p.active ? HIT : '#FFFFFF',
      transform: [{ translateX: x - r }, { translateY: y - r }],
    }
  })
  return <Animated.View style={[styles.head, style]} />
}

function HipMarker({ point, layout }: { point: SharedValue<GuidePoint | null>; layout: SharedValue<Layout> }) {
  const style = useAnimatedStyle(() => {
    const p = point.value
    const l = layout.value
    if (!p) return { opacity: 0 }
    const x = (l.mirror ? 1 - p.x : p.x) * l.iw * l.scale + l.dx
    const y = p.y * l.ih * l.scale + l.dy
    return { opacity: 1, transform: [{ translateX: x - 9 }, { translateY: y - 9 }] }
  })
  return (
    <Animated.View style={[styles.hip, style]}>
      <View style={styles.hipTick} />
      <View style={styles.hipDot} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' },
  laneLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: theme.spacing.sm,
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  laneLabelActive: { color: '#5EEAD4' },
  vline: { position: 'absolute', width: 3 },
  dash: { position: 'absolute', width: 3, height: DASH, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.85)' },
  hline: { position: 'absolute', justifyContent: 'center' },
  hlineBar: { width: '100%', borderRadius: 3, opacity: 0.95 },
  hlineLabel: {
    position: 'absolute',
    left: 6,
    top: -26,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    backgroundColor: 'rgba(5, 10, 25, 0.7)',
  },
  hlineText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  head: { position: 'absolute', left: 0, top: 0, borderWidth: 3 },
  hip: { position: 'absolute', left: 0, top: 0, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  hipDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#5EEAD4', borderWidth: 2, borderColor: '#fff' },
  hipTick: { position: 'absolute', width: 3, height: 34, borderRadius: 1.5, backgroundColor: '#5EEAD4' },
  edgeGlow: {
    position: 'absolute',
    width: 28,
    backgroundColor: 'rgba(255, 93, 108, 0.45)',
    shadowColor: theme.colors.danger,
    shadowOpacity: 0.9,
    shadowRadius: 18,
  },
  edgeMessage: {
    position: 'absolute',
    top: theme.spacing.lg,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255, 93, 108, 0.85)',
  },
  edgeText: { color: '#fff', fontWeight: '900', fontSize: theme.font.small },
})
