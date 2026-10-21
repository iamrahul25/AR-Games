import { normalizeAngle, SEGMENT_NAMES } from './geometry'
import { fullSkeleton, NEUTRAL_SKELETON, skeletonToFrame, type PoseView, type SkeletonSpec } from './skeleton'
import type { PoseFrame } from './types'

export interface SimulatorTarget {
  skeleton: SkeletonSpec
  view: PoseView
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

  constructor(
    private readonly imageWidth = 480,
    private readonly imageHeight = 640,
    /** Seconds the player "thinks" before starting to move after a new target. */
    private readonly reactionSeconds = 0.8,
    /** Degrees per second the player rotates each limb. */
    private readonly speedDegPerSec = 140,
    /** Constant error (degrees) the player keeps once posed: 0 = perfect. */
    private readonly sloppinessDeg = 6,
  ) {}

  setTarget(target: SimulatorTarget | null, now: number) {
    const next = target ?? { skeleton: NEUTRAL_SKELETON, view: 'front' as const }
    if (next.skeleton === this.target.skeleton && next.view === this.target.view) return
    this.target = next
    this.targetChangedAt = now
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
    return skeletonToFrame(
      this.current,
      this.view,
      { imageWidth: this.imageWidth, imageHeight: this.imageHeight, centerX: 0.5 + sway },
      now,
    )
  }
}
