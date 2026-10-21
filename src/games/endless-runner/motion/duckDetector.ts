import type { Point } from '@/core/pose/bodyMetrics'

/** Ducks are ignored this long after a jump lands (landing knees bend and dip the head). */
export const LANDING_SUPPRESS_MS = 250
const EXIT_SAMPLES = 2

export interface DuckThresholds {
  duckY: number
  /** Hips must drop below this too in `squat` style. */
  hipDuckY: number
  exitMargin: number
}

/**
 * Ducking while the head is below the duck line (`head` style: bow, bend forward or bend
 * the knees), or head and hips are both down (`squat` style).
 */
export class DuckDetector {
  ducking = false
  private exitCount = 0

  constructor(private style: 'head' | 'squat' = 'head') {}

  reset() {
    this.ducking = false
    this.exitCount = 0
  }

  update(
    s: { t: number; head: Point; hip: Point },
    th: DuckThresholds,
    ctx: { airborne: boolean; lastLandT: number },
  ): 'start' | 'end' | null {
    if (!this.ducking) {
      if (ctx.airborne || s.t - ctx.lastLandT < LANDING_SUPPRESS_MS) return null
      const headDown = s.head.y > th.duckY
      const hipsDown = this.style === 'head' || s.hip.y > th.hipDuckY
      if (!headDown || !hipsDown) return null
      this.ducking = true
      this.exitCount = 0
      return 'start'
    }
    const headUp = s.head.y < th.duckY - th.exitMargin
    const hipsUp = this.style === 'squat' && s.hip.y < th.hipDuckY - th.exitMargin
    if (headUp || hipsUp) {
      this.exitCount++
      if (this.exitCount >= EXIT_SAMPLES) {
        this.ducking = false
        this.exitCount = 0
        return 'end'
      }
    } else {
      this.exitCount = 0
    }
    return null
  }
}
