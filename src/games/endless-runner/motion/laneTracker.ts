import type { Lane } from '../types'

export interface LaneTrackerOptions {
  /** Inner lane boundaries [bL, bR], canonical x. */
  bounds: [number, number]
  /** Hysteresis margin past a boundary (canonical x), e.g. 0.15 × shoulder width. */
  margin: number
  /** Consecutive samples a new lane must hold before it registers. */
  dwell?: number
}

/**
 * Absolute lane model: the lane the hips stand in is the lane you run in.
 * Hysteresis stops flicker on a boundary; dwell filters single-frame glitches.
 */
export class LaneTracker {
  lane: Lane = 0
  private candidate: Lane = 0
  private count = 0
  private readonly dwell: number

  constructor(private opts: LaneTrackerOptions) {
    this.dwell = opts.dwell ?? 2
  }

  setBounds(bounds: [number, number], margin: number) {
    this.opts = { ...this.opts, bounds, margin }
  }

  reset(lane: Lane = 0) {
    this.lane = lane
    this.candidate = lane
    this.count = 0
  }

  /** Lane the hips are in, given the current lane (hysteresis applied). */
  zoneFor(hipX: number): Lane {
    const [bL, bR] = this.opts.bounds
    const m = this.opts.margin
    switch (this.lane) {
      case 0:
        if (hipX < bL - m) return -1
        if (hipX > bR + m) return 1
        return 0
      case -1:
        if (hipX > bR + m) return 1
        if (hipX > bL + m) return 0
        return -1
      case 1:
        if (hipX < bL - m) return -1
        if (hipX < bR - m) return 0
        return 1
    }
  }

  /** Returns the lanes passed through when the lane changes (e.g. [0, 1] for left → right), else null. */
  update(hipX: number): Lane[] | null {
    const zone = this.zoneFor(hipX)
    if (zone === this.lane) {
      this.count = 0
      this.candidate = zone
      return null
    }
    if (zone === this.candidate) this.count++
    else {
      this.candidate = zone
      this.count = 1
    }
    if (this.count < this.dwell) return null
    const from = this.lane
    this.lane = zone
    this.count = 0
    return Math.abs(zone - from) === 2 ? [0, zone] : [zone]
  }
}
