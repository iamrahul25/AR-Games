import { LANDMARK_COUNT } from './landmarks'
import type { PoseFrame } from './types'

/**
 * One-Euro filter (Casiez et al. 2012): low jitter when still, low lag when moving.
 * https://gery.casiez.net/1euro/
 */
export class OneEuroFilter {
  private prevValue: number | undefined
  private prevDerivative = 0
  private prevTime: number | undefined

  constructor(
    private readonly minCutoff = 1.2,
    private readonly beta = 0.02,
    private readonly derivativeCutoff = 1.0,
  ) {}

  filter(value: number, timeMs: number): number {
    if (this.prevValue === undefined || this.prevTime === undefined) {
      this.prevValue = value
      this.prevTime = timeMs
      return value
    }
    const dt = Math.max((timeMs - this.prevTime) / 1000, 1e-3)
    this.prevTime = timeMs

    const derivative = (value - this.prevValue) / dt
    const smoothedDerivative = lerp(this.prevDerivative, derivative, alpha(dt, this.derivativeCutoff))
    this.prevDerivative = smoothedDerivative

    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative)
    const result = lerp(this.prevValue, value, alpha(dt, cutoff))
    this.prevValue = result
    return result
  }

  reset() {
    this.prevValue = undefined
    this.prevTime = undefined
    this.prevDerivative = 0
  }
}

function alpha(dt: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export interface SmoothingOptions {
  minCutoff: number
  beta: number
}

/**
 * `stable`: low jitter for holding poses. `responsive`: less lag during fast moves
 * (jumps, hops), at the cost of a little more jitter when still.
 */
export const SMOOTHING_PRESETS = {
  stable: { minCutoff: 1.2, beta: 0.02 },
  responsive: { minCutoff: 2.5, beta: 2.0 },
} as const satisfies Record<string, SmoothingOptions>

export type SmoothingPreset = keyof typeof SMOOTHING_PRESETS

/** Smooths every landmark coordinate of a pose stream independently. */
export class PoseSmoother {
  private filters: OneEuroFilter[]

  constructor({ minCutoff, beta }: SmoothingOptions = SMOOTHING_PRESETS.stable) {
    this.filters = Array.from({ length: LANDMARK_COUNT * 3 }, () => new OneEuroFilter(minCutoff, beta))
  }

  smooth(frame: PoseFrame): PoseFrame {
    const t = frame.timestamp
    const landmarks = frame.landmarks.map((lm, i) => ({
      x: this.filters[i * 3].filter(lm.x, t),
      y: this.filters[i * 3 + 1].filter(lm.y, t),
      z: this.filters[i * 3 + 2].filter(lm.z, t),
      visibility: lm.visibility,
    }))
    return { ...frame, landmarks }
  }

  reset() {
    for (const f of this.filters) f.reset()
  }
}
