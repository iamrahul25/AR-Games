import type { Point } from '@/core/pose/bodyMetrics'

/** A sideways hop is a hop whose hips moved more than this × halfLane in 300 ms. */
export const LATERAL_HOP_RATIO = 0.5
export const LATERAL_WINDOW_MS = 300
export const JUMP_REFRACTORY_MS = 350
export const LAND_HOLD_MS = 100

export interface JumpThresholds {
  /** Head must go above this line (y decreases upward). */
  jumpY: number
  /** Hips must rise above this, so a neck stretch or tiptoe lean doesn't count. */
  hipJumpY: number
  /** Margin below the jump line before counting as landed (0.05 × torso). */
  exitMargin: number
  halfLane: number
}

export interface JumpSample {
  t: number
  head: Point
  hip: Point
  wrists: [Point, Point] | null
}

export type JumpResult = { jumped: boolean; lateral: boolean; landed: boolean }

/**
 * GROUNDED → AIRBORNE emits one jump; AIRBORNE → GROUNDED once the head has been back below
 * the line for 100 ms. With `hands-up` style (low impact), both wrists above the line count.
 */
export class JumpDetector {
  airborne = false
  lastJumpT = -Infinity
  lastLandT = -Infinity
  private belowSince: number | null = null
  private hipHistory: { t: number; x: number }[] = []

  constructor(private style: 'jump' | 'hands-up' = 'jump') {}

  reset() {
    this.airborne = false
    this.belowSince = null
    this.hipHistory = []
    this.lastJumpT = -Infinity
    this.lastLandT = -Infinity
  }

  update(s: JumpSample, th: JumpThresholds): JumpResult {
    this.hipHistory.push({ t: s.t, x: s.hip.x })
    while (this.hipHistory.length > 1 && s.t - this.hipHistory[1].t >= LATERAL_WINDOW_MS) this.hipHistory.shift()
    const result: JumpResult = { jumped: false, lateral: false, landed: false }

    if (!this.airborne) {
      if (!this.isUp(s, th) || s.t - this.lastJumpT < JUMP_REFRACTORY_MS) return result
      this.airborne = true
      this.belowSince = null
      const oldest = this.hipHistory[0]
      const dx = Math.abs(s.hip.x - oldest.x)
      if (this.style === 'jump' && dx > LATERAL_HOP_RATIO * th.halfLane) {
        result.lateral = true
        return result
      }
      this.lastJumpT = s.t
      result.jumped = true
      return result
    }

    if (this.isDown(s, th)) {
      if (this.belowSince === null) this.belowSince = s.t
      if (s.t - this.belowSince >= LAND_HOLD_MS) {
        this.airborne = false
        this.belowSince = null
        this.lastLandT = s.t
        result.landed = true
      }
    } else {
      this.belowSince = null
    }
    return result
  }

  private isUp(s: JumpSample, th: JumpThresholds): boolean {
    if (this.style === 'hands-up') {
      return !!s.wrists && s.wrists[0].y < th.jumpY && s.wrists[1].y < th.jumpY
    }
    return s.head.y < th.jumpY && s.hip.y < th.hipJumpY
  }

  private isDown(s: JumpSample, th: JumpThresholds): boolean {
    const line = th.jumpY + th.exitMargin
    if (this.style === 'hands-up') {
      return !s.wrists || s.wrists[0].y > line || s.wrists[1].y > line
    }
    return s.head.y > line
  }
}
