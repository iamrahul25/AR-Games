import { normalizeAngle, SEGMENT_NAMES } from './geometry'
import {
  fullSkeleton,
  NEUTRAL_SKELETON,
  skeletonFit,
  skeletonToFrame,
  type PoseView,
  type SkeletonSpec,
} from './skeleton'
import type { PoseFrame } from './types'

export interface SimulatorTarget {
  skeleton: SkeletonSpec
  view: PoseView
  /** Normalized x of the hips (stepping sideways). Setting any body offset pins the body size. */
  centerX?: number
  /** Upward offset of the whole body, in normalized image-height units (jumping). */
  liftY?: number
  /** Knee bend, 0 (standing) .. 1 (deep squat). */
  crouch?: number
}

export interface SimulatorOptions {
  /** Seconds the player "thinks" before starting to move after a new target. */
  reactionSeconds?: number
  /** Degrees per second the player rotates each limb. */
  speedDegPerSec?: number
  /** Constant error (degrees) the player keeps once posed: 0 = perfect. */
  sloppinessDeg?: number
}

const hasBodyOffsets = (t: SimulatorTarget) =>
  t.centerX !== undefined || t.liftY !== undefined || t.crouch !== undefined

function crouchSkeleton(spec: SkeletonSpec, crouch: number): SkeletonSpec {
  if (crouch <= 0.001) return spec
  const c = Math.min(1, crouch)
  const out = { ...spec }
  const thigh = (s: SkeletonSpec['leftThigh'], sign: number) => ({
    angle: normalizeAngle(s.angle - sign * 30 * c),
    length: (s.length ?? 1) * (1 - 0.55 * c),
  })
  const shin = (s: SkeletonSpec['leftShin'], sign: number) => ({
    angle: normalizeAngle(s.angle + sign * 18 * c),
    length: s.length,
  })
  out.leftThigh = thigh(spec.leftThigh, -1)
  out.rightThigh = thigh(spec.rightThigh, 1)
  out.leftShin = shin(spec.leftShin, -1)
  out.rightShin = shin(spec.rightShin, 1)
  out.torso = { angle: spec.torso.angle, length: (spec.torso.length ?? 1) * (1 - 0.15 * c) }
  return out
}

/**
 * A fake player that moves toward a target pose with human-like lag and wobble.
 * Used for "Demo mode" (play without a camera), UI development and tests.
 */
export class PoseSimulator {
  private current: SkeletonSpec = { ...NEUTRAL_SKELETON }
  private target: SimulatorTarget = { skeleton: NEUTRAL_SKELETON, view: 'front' }
  private view: PoseView = 'front'
  private lastTime: number | undefined
  private targetChangedAt = 0
  private readonly reactionSeconds: number
  private readonly speedDegPerSec: number
  private readonly sloppinessDeg: number
  private readonly body: { scale: number; groundY: number }
  private centerX = 0.5
  private lift = 0
  private crouch = 0

  constructor(
    private readonly imageWidth = 480,
    private readonly imageHeight = 640,
    reactionSecondsOrOptions: number | SimulatorOptions = 0.8,
    speedDegPerSec = 140,
    sloppinessDeg = 6,
  ) {
    const o: SimulatorOptions =
      typeof reactionSecondsOrOptions === 'number'
        ? { reactionSeconds: reactionSecondsOrOptions, speedDegPerSec, sloppinessDeg }
        : reactionSecondsOrOptions
    this.reactionSeconds = o.reactionSeconds ?? 0.8
    this.speedDegPerSec = o.speedDegPerSec ?? 140
    this.sloppinessDeg = o.sloppinessDeg ?? 6
    this.body = skeletonFit(NEUTRAL_SKELETON, 'front', { imageWidth, imageHeight })
  }

  setTarget(target: SimulatorTarget | null, now: number) {
    const next = target ?? { skeleton: NEUTRAL_SKELETON, view: 'front' as const }
    const poseChanged = next.skeleton !== this.target.skeleton || next.view !== this.target.view
    if (!poseChanged && !hasBodyOffsets(next) && !hasBodyOffsets(this.target)) return
    this.target = next
    if (poseChanged) this.targetChangedAt = now
  }

  step(now: number): PoseFrame {
    const dt = this.lastTime === undefined ? 0 : Math.min((now - this.lastTime) / 1000, 0.25)
    this.lastTime = now
    const reacting = (now - this.targetChangedAt) / 1000 < this.reactionSeconds

    if (!reacting) {
      this.view = this.target.view
      const maxStep = this.speedDegPerSec * dt
      const next: Partial<SkeletonSpec> = {}
      for (const name of SEGMENT_NAMES) {
        const cur = this.current[name]
        const tgt = this.target.skeleton[name]
        const wobble = Math.sin(now / 900 + name.length) * this.sloppinessDeg
        const goal = tgt.angle + wobble
        const diff = normalizeAngle(goal - cur.angle)
        const angle = cur.angle + Math.max(-maxStep, Math.min(maxStep, diff))
        const curLen = cur.length ?? 1
        const tgtLen = tgt.length ?? 1
        const length = curLen + Math.max(-dt, Math.min(dt, tgtLen - curLen))
        next[name] = { angle: normalizeAngle(angle), length }
      }
      this.current = fullSkeleton(next)
    }

    const sway = Math.sin(now / 1300) * 0.01
    if (!hasBodyOffsets(this.target)) {
      return skeletonToFrame(
        this.current,
        this.view,
        { imageWidth: this.imageWidth, imageHeight: this.imageHeight, centerX: 0.5 + sway },
        now,
      )
    }

    const ease = (tau: number) => (dt <= 0 ? 1 : 1 - Math.exp(-dt / tau))
    this.centerX += ((this.target.centerX ?? 0.5) - this.centerX) * ease(0.07)
    this.lift += ((this.target.liftY ?? 0) - this.lift) * ease(0.045)
    this.crouch += ((this.target.crouch ?? 0) - this.crouch) * ease(0.07)
    return skeletonToFrame(
      crouchSkeleton(this.current, this.crouch),
      this.view,
      {
        imageWidth: this.imageWidth,
        imageHeight: this.imageHeight,
        centerX: this.centerX + sway * 0.4,
        scale: this.body.scale,
        groundY: this.body.groundY - this.lift,
      },
      now,
    )
  }
}
