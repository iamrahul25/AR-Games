import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'

import { headPoint, torsoLength } from '@/core/pose/bodyMetrics'
import { GuideOverlay, type GuideSpec } from '@/core/pose/GuideOverlay'
import { NEUTRAL_SKELETON } from '@/core/pose/skeleton'
import { PoseSimulator, type SimulatorTarget } from '@/core/pose/simulator'
import { StickFigure } from '@/core/pose/StickFigure'
import type { Landmark } from '@/core/pose/types'
import { theme } from '@/core/ui/theme'
import { JUMP_FACTOR, DUCK_FACTOR, LANE_WIDTH_FACTOR } from '../config/difficulty'
import { laneGeometry, lineYs } from '../motion/calibration'
import { DUCK_LINE_COLOR, JUMP_LINE_COLOR } from '../motion/guides'
import type { Lane } from '../types'

export type DemoMove = 'stand' | 'lanes' | 'jump' | 'duck'

const IMAGE_W = 480
const IMAGE_H = 640
const STEP_MS = 50

interface Keyframe {
  lane: Lane
  jump?: boolean
  duck?: boolean
  ms: number
}

const SCRIPTS: Record<DemoMove, Keyframe[]> = {
  stand: [{ lane: 0, ms: 1000 }],
  lanes: [
    { lane: 0, ms: 900 },
    { lane: -1, ms: 1100 },
    { lane: 0, ms: 900 },
    { lane: 1, ms: 1100 },
  ],
  jump: [
    { lane: 0, ms: 1200 },
    { lane: 0, jump: true, ms: 450 },
    { lane: 0, ms: 900 },
  ],
  duck: [
    { lane: 0, ms: 1200 },
    { lane: 0, duck: true, ms: 1300 },
    { lane: 0, ms: 700 },
  ],
}

/** Body geometry of the simulated figure, measured once from a neutral frame. */
function measureNeutral() {
  const sim = new PoseSimulator(IMAGE_W, IMAGE_H, { reactionSeconds: 0, speedDegPerSec: 900, sloppinessDeg: 0 })
  sim.setTarget({ skeleton: NEUTRAL_SKELETON, view: 'front', centerX: 0.5, liftY: 0, crouch: 0 }, 0)
  const frame = sim.step(0)
  const head = headPoint(frame) ?? { x: 0.5, y: 0.16 }
  const T = torsoLength(frame) ?? 0.24
  const shoulderW = Math.abs(frame.landmarks[11].x - frame.landmarks[12].x)
  return {
    T,
    geometry: laneGeometry(0.5, shoulderW, LANE_WIDTH_FACTOR.normal),
    lines: lineYs(head.y, T, JUMP_FACTOR.normal, DUCK_FACTOR.normal),
    head,
  }
}

/** Looping stick-figure demo of one move, with the same camera guides the game shows. */
export function MoveDemoFigure({ move, height = 240 }: { move: DemoMove; height?: number }) {
  const [body] = useState(measureNeutral)
  const [sim] = useState(() => new PoseSimulator(IMAGE_W, IMAGE_H, { reactionSeconds: 0, speedDegPerSec: 600, sloppinessDeg: 0 }))
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null)
  const [frameKey, setFrameKey] = useState<Keyframe>(SCRIPTS[move][0])
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const script = SCRIPTS[move]
    let t = 0
    let i = 0
    let elapsed = 0
    const id = setInterval(() => {
      t += STEP_MS
      elapsed += STEP_MS
      if (elapsed >= script[i].ms) {
        elapsed = 0
        i = (i + 1) % script.length
      }
      const k = script[i]
      setFrameKey(k)
      const target: SimulatorTarget = {
        skeleton: NEUTRAL_SKELETON,
        view: 'front',
        centerX: 0.5 + k.lane * 2 * body.geometry.halfLane,
        liftY: k.jump ? body.head.y - body.lines.jumpY + 0.12 * body.T : 0,
        crouch: k.duck ? 1 : 0,
      }
      sim.setTarget(target, t)
      setLandmarks(sim.step(t).landmarks)
    }, STEP_MS)
    return () => clearInterval(id)
  }, [move, sim, body])

  const spec = useMemo<GuideSpec>(() => {
    const hLines: NonNullable<GuideSpec['hLines']> = []
    if (move === 'jump') hLines.push({ id: 'jump', y: body.lines.jumpY, color: JUMP_LINE_COLOR, label: '▲ JUMP', state: frameKey.jump ? 'hit' : 'idle' })
    if (move === 'duck') hLines.push({ id: 'duck', y: body.lines.duckY, color: DUCK_LINE_COLOR, label: '▼ DUCK', state: frameKey.duck ? 'hit' : 'idle' })
    return {
      lanes: { bounds: body.geometry.laneBounds, outer: body.geometry.outer, active: frameKey.lane, labels: ['L', 'C', 'R'] },
      hLines,
    }
  }, [move, body, frameKey])

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  return (
    <View style={[styles.box, { height }]} onLayout={onLayout}>
      <View style={styles.floor} />
      {width > 0 && (
        <>
          <GuideOverlay spec={spec} imageAspect={IMAGE_W / IMAGE_H} fit="contain" mirrorX={false} />
          <StickFigure
            landmarks={landmarks}
            imageAspect={IMAGE_W / IMAGE_H}
            width={width}
            height={height}
            lineWidth={6}
            jointRadius={5}
            fit="contain"
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: '#101B3A' },
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '14%', backgroundColor: '#17264F' },
})
